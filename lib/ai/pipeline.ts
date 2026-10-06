// lib/ai/pipeline.ts
// artice-cream 콘텐츠 파이프라인 엔진.
//
// 사용 예 (Vercel Cron 배치에서):
//   for (const level of [1, 2, 3] as Level[]) {
//     const variant = await processArticle({ title, text }, level);
//     await db.insert("article_variants", { article_id, ...variant });  // spec §8
//   }
//
// 설계 요점
//  - 재작성 → (용어 ‖ 퀴즈) 순서. 용어/퀴즈는 "재작성된 본문"을 입력으로 받는다.
//  - 하이라이트 <mark> 삽입은 LLM이 아니라 코드가 결정론적으로 수행(본문 무결성 + 한국어 조사 대응).
//  - 각 콜 출력은 Zod로 검증하고, 실패 시 오류를 붙여 1회만 리페어.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { withLlmSlot } from "./request-limit";
import { trace, type TraceContext } from "./trace";
import { GLOSSARY_MAX, SUMMARY_CHARS, SUMMARY_MIN_RATIO } from "../policy";
import {
  RewriteSchema,
  GlossarySchema,
  QuizSchema,
  ClassifySchema,
  type Glossary,
  type Level,
  type ProcessedVariant,
  type Classify,
} from "./schemas";
import {
  REWRITE_SYSTEM,
  GLOSSARY_SYSTEM,
  QUIZ_SYSTEM,
  CLASSIFY_SYSTEM,
  buildRewriteUser,
  buildGlossaryUser,
  buildQuizUser,
  buildClassifyUser,
  type ClassifyCandidate,
} from "./prompts";

// LLM 백엔드는 두 갈래다. BASE_URL + API_KEY 가 있으면 OpenAI 호환 게이트웨이로
// 보내고, 없으면 Anthropic SDK 를 쓴다. 게이트웨이는 /v1/messages 를 제공하지
// 않으므로 SDK 의 baseURL 로는 붙지 않는다 — chat/completions 를 직접 친다.
const GATEWAY_URL = process.env.BASE_URL?.replace(/[/]+$/, "");
const GATEWAY_KEY = process.env.API_KEY;
const USE_GATEWAY = Boolean(GATEWAY_URL && GATEWAY_KEY);
const GATEWAY_TIMEOUT_MS = 120_000;

// 생성을 미루는 이유: 모듈 최상위에서 만들면 ANTHROPIC_API_KEY 가 없을 때
// import 만으로 던진다. 게이트웨이만 쓰는 배포에는 그 키가 아예 없다.
let anthropic: Anthropic | null = null;
const getAnthropic = () => (anthropic ??= new Anthropic());

export const CONTENT_MODEL =
  process.env.LLM_MODEL ??
  (USE_GATEWAY ? (process.env.MODEL_ID ?? "pickle-general") : "claude-haiku-4-5");

/* ------------------------------------------------------------------ */
/* 토큰/비용 계측 (spec §10 단위 경제성 게이트)                           */
/* ------------------------------------------------------------------ */

/** Haiku 4.5 기준 100만 토큰당 달러. 모델을 바꾸면 여기도 바꾼다. */
const PRICE = USE_GATEWAY
  ? { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }
  : { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 };

export interface UsageMeter {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  calls: number;
  retries: number;
}

export const newMeter = (): UsageMeter => ({
  input: 0,
  output: 0,
  cacheWrite: 0,
  cacheRead: 0,
  calls: 0,
  retries: 0,
});

export function addMeter(a: UsageMeter, b: UsageMeter): UsageMeter {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    cacheRead: a.cacheRead + b.cacheRead,
    calls: a.calls + b.calls,
    retries: a.retries + b.retries,
  };
}

/** 대략적인 USD. Phase 0 비용 게이트 판단용. */
export function estimateCost(m: UsageMeter): number {
  return (
    (m.input * PRICE.input +
      m.output * PRICE.output +
      m.cacheWrite * PRICE.cacheWrite +
      m.cacheRead * PRICE.cacheRead) /
    1_000_000
  );
}

/* ------------------------------------------------------------------ */
/* 모델 호출 + JSON 검증(+ 리페어 1회)                                   */
/* ------------------------------------------------------------------ */

async function rawCall(
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
  meter?: UsageMeter,
  signal?: AbortSignal,
  context?: TraceContext,
): Promise<string> {
  signal?.throwIfAborted();
  for (let attempt = 0; ; attempt += 1) {
    signal?.throwIfAborted();
    const queuedAt = performance.now();
    let sentAt: number | undefined;
    try {
      const response = await withLlmSlot(() => {
        sentAt = performance.now();
        return (USE_GATEWAY ? gatewayCall : anthropicCall)(system, user, maxTokens, temperature, meter, signal);
      }, signal);
      trace(context, { event: "call", attempt: attempt + 1, model: CONTENT_MODEL, maxTokens,
        ok: true, queueMs: Math.round(sentAt! - queuedAt), requestMs: Math.round(performance.now() - sentAt!),
        finishReason: response.finishReason, outputTokens: response.outputTokens, outputChars: response.text.length });
      return response.text;
    } catch (cause) {
      trace(context, { event: "call", attempt: attempt + 1, model: CONTENT_MODEL, maxTokens,
        ok: false, queueMs: Math.round((sentAt ?? performance.now()) - queuedAt),
        requestMs: sentAt === undefined ? 0 : Math.round(performance.now() - sentAt),
        httpStatus: cause instanceof GatewayError ? cause.status : undefined,
        errorType: cause instanceof Error ? cause.name : "Error", aborted: signal?.aborted ?? false });
      if (!USE_GATEWAY || !signal || attempt > 0 || signal.aborted || !(cause instanceof GatewayError) ||
          ![429, 502, 503, 504].includes(cause.status)) throw cause;
      if (meter) meter.retries += 1;
      console.warn("[llm:retry]", JSON.stringify({ status: cause.status, attempt: attempt + 1 }));
      // 기사 전체 signal은 그대로 쓴다. 재시도로 시간 한도가 새로 시작되지 않는다.
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 500);
        const abort = () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", abort);
          reject(signal.reason);
        };
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      });
    }
  }
}

class GatewayError extends Error {
  constructor(readonly status: number, detail: string) {
    super(`LLM gateway ${status}: ${detail.slice(0, 300)}`);
    this.name = "GatewayError";
  }
}

class ModelOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelOutputError";
  }
}

type ModelResponse = { text: string; finishReason?: string | null; outputTokens?: number };

async function anthropicCall(
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
  meter?: UsageMeter,
  signal?: AbortSignal,
): Promise<ModelResponse> {
  const msg = await getAnthropic().messages.create({
    model: CONTENT_MODEL,
    max_tokens: maxTokens,
    temperature,
    // 시스템 프롬프트는 정적이므로 캐싱(반복 컨텍스트 최대 90% 절감)
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  }, { signal, ...(signal ? { timeout: GATEWAY_TIMEOUT_MS, maxRetries: 0 } : {}) });

  if (meter) {
    meter.input += msg.usage.input_tokens ?? 0;
    meter.output += msg.usage.output_tokens ?? 0;
    meter.cacheWrite += msg.usage.cache_creation_input_tokens ?? 0;
    meter.cacheRead += msg.usage.cache_read_input_tokens ?? 0;
    meter.calls += 1;
  }

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("\n");
  return { text, finishReason: msg.stop_reason, outputTokens: msg.usage.output_tokens };
}

/**
 * OpenAI 호환 게이트웨이(POST /chat/completions).
 *
 * Anthropic 쪽 프롬프트 캐싱에 대응하는 것이 없다 — 시스템 프롬프트가 매 콜
 * 전체 토큰으로 들어간다. 게이트웨이가 cached_tokens 를 보고하면 그만큼만
 * 캐시 읽기로 옮겨 적는다(지금 게이트웨이는 null 을 준다).
 */
async function gatewayCall(
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
  meter?: UsageMeter,
  signal?: AbortSignal,
): Promise<ModelResponse> {
  const res = await fetch(`${GATEWAY_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${GATEWAY_KEY}`,
    },
    body: JSON.stringify({
      model: CONTENT_MODEL,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(GATEWAY_TIMEOUT_MS)])
      : AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new GatewayError(res.status, detail);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number } | null;
    };
  };

  if (meter) {
    const usage = json.usage;
    // OpenAI 규약의 prompt_tokens 는 캐시 적중분을 포함한다 — 겹쳐 세지 않게 뺀다.
    const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
    meter.input += Math.max(0, (usage?.prompt_tokens ?? 0) - cached);
    meter.output += usage?.completion_tokens ?? 0;
    meter.cacheRead += cached;
    meter.calls += 1;
  }

  return { text: json.choices?.[0]?.message?.content ?? "",
    finishReason: json.choices?.[0]?.finish_reason, outputTokens: json.usage?.completion_tokens };
}

/** 코드펜스/앞뒤 잡텍스트를 걷어내고 가장 바깥 JSON 객체만 남긴다. */
function extractJson(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  return s;
}

function tryParse(raw: string): { ok: true; value: unknown } | { ok: false; err: string } {
  const json = extractJson(raw);
  try {
    return { ok: true, value: JSON.parse(json) };
  } catch {
    // Some gateways emit literal line breaks inside quoted strings. Escape only
    // those control characters: preserve content, quotes, backslashes and structure.
    let quoted = false;
    let escaped = false;
    let normalized = "";
    for (const char of json) {
      if (quoted && !escaped && char.charCodeAt(0) < 0x20) {
        normalized += JSON.stringify(char).slice(1, -1);
        continue;
      }
      normalized += char;
      if (escaped) { escaped = false; continue; }
      if (quoted && char === "\\") { escaped = true; continue; }
      if (char === '"') quoted = !quoted;
    }
    try {
      return { ok: true, value: JSON.parse(normalized) };
    } catch (e) {
      return { ok: false, err: `JSON 파싱 실패: ${String(e)}` };
    }
  }
}

function zodErr(e: z.ZodError): string {
  return e.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}

/** 모델을 호출해 JSON을 받고 schema로 검증. 실패하면 오류를 붙여 1회 리페어. */
export async function callJSON<T>(
  schema: z.ZodType<T>,
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
  meter?: UsageMeter,
  signal?: AbortSignal,
  context?: TraceContext,
): Promise<T> {
  const raw1 = await rawCall(system, user, maxTokens, temperature, meter, signal, context);

  let reason: string;
  const p1 = tryParse(raw1);
  if (p1.ok) {
    const v = schema.safeParse(p1.value);
    if (v.success) return v.data;
    reason = zodErr(v.error);
    trace(context, { event: "validation", reason: "schema", paths: v.error.issues.map((i) => i.path.join(".")) });
  } else {
    reason = p1.err;
    trace(context, { event: "validation", reason: "parse" });
  }

  // ── 리페어 1회 (temperature=0) ──
  const repairUser =
    `${user}\n\n---\n직전 응답이 형식에 맞지 않았습니다.\n` +
    `오류: ${reason}\n직전 응답:\n${raw1}\n\n` +
    `스키마에 정확히 맞는 JSON만, 다른 텍스트 없이 다시 출력하세요.`;

  const raw2 = await rawCall(system, repairUser, maxTokens, 0, meter, signal,
    context ? { ...context, repair: true } : undefined);
  const p2 = tryParse(raw2);
  if (!p2.ok) throw new ModelOutputError(`${p2.err} (리페어 후)`);
  const v2 = schema.safeParse(p2.value);
  if (!v2.success) throw new ModelOutputError(`JSON 스키마 검증 실패(리페어 후): ${zodErr(v2.error)}`);
  return v2.data;
}

/* ------------------------------------------------------------------ */
/* 하이라이트 마킹 (코드 사이드)                                         */
/* ------------------------------------------------------------------ */

const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/**
 * 기존 <mark> 바깥의 텍스트에서 needle의 "첫 출현 하나만" 감싼다(정책.md §4).
 * `marked`는 이미 이 용어를 마킹했는지를 문단 루프 바깥에서 들고 있는 상태다.
 */
function wrapFirstOutsideMarks(
  html: string,
  needleEsc: string,
  id: string,
  marked: Set<string>,
): string {
  if (!needleEsc || marked.has(id)) return html;
  const parts = html.split(/(<mark\b[^>]*>[\s\S]*?<\/mark>)/g);
  let done = false;
  const next = parts.map((seg) => {
    if (seg.startsWith("<mark") || done) return seg; // 이미 마크된 구간은 건드리지 않음
    const i = seg.indexOf(needleEsc);
    if (i === -1) return seg;
    done = true;
    return (
      seg.slice(0, i) +
      `<mark data-w="${id}">${needleEsc}</mark>` +
      seg.slice(i + needleEsc.length)
    );
  });
  if (done) marked.add(id);
  return next.join("");
}

/**
 * 재작성 본문에 하이라이트를 삽입하고 glossary 맵을 만든다.
 * - 본문에 실제로 존재하는 surface만 채택(환각/불일치 방어).
 * - 본문에서 못 찾을 용어를 골라내는 필터를 통과한 **뒤에** 수준별 상한(GLOSSARY_MAX)으로
 *   자른다 — 순서가 바뀌면 어차피 버려질 용어가 상한 자리를 차지한다(정책.md §4).
 * - 긴 표현부터 감싸 부분 겹침을 방지.
 * - 같은 surface는 첫 출현에만 마킹한다(정책.md §4) — 나머지 출현은 그대로 둔다.
 */
export function markTerms(
  paragraphs: string[],
  terms: Glossary["terms"],
  level: Level,
  keyParagraphs: number[] = [],
): { content_html: string; glossary: ProcessedVariant["glossary"] } {
  const seen = new Set<string>();
  const found: { surface: string; definition: string }[] = [];

  for (const t of terms) {
    const surface = t.surface.trim();
    if (!surface || seen.has(surface)) continue;
    if (!paragraphs.some((p) => p.includes(surface))) continue; // 본문에서 못 찾으면 버림
    seen.add(surface);
    found.push({ surface, definition: t.definition.trim() });
  }

  const cap = GLOSSARY_MAX[level];
  const kept = found.slice(0, cap).map((t, i) => ({ id: `w${i + 1}`, ...t }));

  const glossary: ProcessedVariant["glossary"] = {};
  for (const k of kept) glossary[k.id] = { term: k.surface, definition: k.definition };

  const ordered = [...kept].sort((a, b) => b.surface.length - a.surface.length);
  const marked = new Set<string>();
  const key = new Set(keyParagraphs);
  const content_html = paragraphs
    .map((p, i) => {
      let html = escapeHtml(p);
      for (const k of ordered) {
        html = wrapFirstOutsideMarks(html, escapeHtml(k.surface), k.id, marked);
      }
      // 중요 대목(plan.md phase6 §3) — 문단 인덱스로 받아 코드가 마킹한다.
      return key.has(i) ? `<p class="ac-key">${html}</p>` : `<p>${html}</p>`;
    })
    .join("\n");

  return { content_html, glossary };
}

/* ------------------------------------------------------------------ */
/* 오케스트레이션                                                       */
/* ------------------------------------------------------------------ */

export interface OriginalArticle {
  title: string;
  text: string;
}

const charsNoSpace = (s: string): number => s.replace(/\s/g, "").length;

/**
 * 재작성 길이가 정책.md §3의 목표 안에 드는지 본다.
 * 하한은 원문 대비 SUMMARY_MIN_RATIO를 넘으면 양보한다 — 짧은 원문에 없는 내용을
 * 보태느니 짧은 편이 낫다.
 */
function lengthOk(bodyChars: number, originalChars: number, level: Level): boolean {
  const [lo, hi] = SUMMARY_CHARS[level];
  if (bodyChars > hi) return false;
  if (bodyChars >= lo) return true;
  return originalChars > 0 && bodyChars / originalChars > SUMMARY_MIN_RATIO;
}

/** 원본 아티클 1건을 특정 수준(level)의 가공본 1개로 변환한다. */
export async function processArticle(
  article: OriginalArticle,
  level: Level,
  meter?: UsageMeter,
  signal?: AbortSignal,
  context?: TraceContext,
): Promise<ProcessedVariant> {
  const originalChars = charsNoSpace(article.text);
  const [lo, hi] = SUMMARY_CHARS[level];
  const stageContext = (stage: TraceContext["stage"], pass: TraceContext["pass"] = "initial") =>
    context ? { ...context, level, stage, pass } : undefined;

  // 1) 재작성 — 길이가 정책.md §3 목표를 벗어나면 측정값을 붙여 1회만 재요청한다.
  //    2회차도 벗어나면 그대로 쓴다: 아티클을 통째로 버리는 것보다 낫다.
  let rewrite = await callJSON(
    RewriteSchema,
    REWRITE_SYSTEM,
    buildRewriteUser(level, article),
    3000,
    0.2,
    meter,
    signal,
    stageContext("rewrite"),
  );
  let bodyChars = charsNoSpace(rewrite.paragraphs.join(""));

  if (!lengthOk(bodyChars, originalChars, level)) {
    trace(stageContext("rewrite"), { event: "length", bodyChars, originalChars, lo, hi });
    // Overlong drafts already contain source facts; shorten that draft instead of
    // translating the long original again. Short drafts still need the original.
    const retryArticle = bodyChars > hi
      ? { title: rewrite.title, text: rewrite.paragraphs.join("\n\n") } : article;
    const retryUser =
      `${buildRewriteUser(level, retryArticle)}\n\n---\n` +
      `직전 응답은 공백 제외 ${bodyChars}자였습니다(목표 ${lo}~${hi}자). ` +
      `목표 분량에 맞게, 원문에 없는 내용은 추가하지 말고 다시 쓰세요.`;
    try {
      const retried = await callJSON(RewriteSchema, REWRITE_SYSTEM, retryUser, 3000, 0.2, meter, signal,
        stageContext("rewrite", "length"));
      rewrite = retried;
      bodyChars = charsNoSpace(rewrite.paragraphs.join(""));
    } catch (cause) {
      // Length adjustment is optional. A malformed replacement must not discard
      // the already validated draft; deadlines and upstream errors still propagate.
      if (signal?.aborted || !(cause instanceof ModelOutputError)) throw cause;
      trace(stageContext("rewrite", "length"), { event: "length", fallback: true, bodyChars,
        errorType: cause.name });
    }
  }

  // 2) 용어 · 3) 퀴즈 — 재작성 본문 입력, 서로 독립이므로 병렬
  const body = rewrite.paragraphs.join("\n\n");
  // 실패한 형제 호출도 종료될 때까지 기다려 다음 기사와 요청이 겹치지 않게 한다.
  const controller = new AbortController();
  const childSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const cancelOnError = <T>(promise: Promise<T>): Promise<T> => promise.catch((cause: unknown) => {
    controller.abort(cause);
    throw cause;
  });
  const children = await Promise.allSettled([
    cancelOnError(callJSON(GlossarySchema, GLOSSARY_SYSTEM, buildGlossaryUser(level, body), 1500, 0.2, meter, childSignal, stageContext("glossary"))),
    cancelOnError(callJSON(QuizSchema, QUIZ_SYSTEM, buildQuizUser(level, body), 1800, 0.4, meter, childSignal, stageContext("quiz"))),
  ]);
  const [glossaryResult, quizResult] = children;
  if (glossaryResult.status === "rejected") throw glossaryResult.reason;
  if (quizResult.status === "rejected") throw quizResult.reason;
  const glossary = glossaryResult.value;
  const quiz = quizResult.value;

  // 4) 코드에서 하이라이트 삽입 + 수준별 상한 + 중요 대목 마킹
  const { content_html, glossary: glossaryMap } = markTerms(
    rewrite.paragraphs,
    glossary.terms,
    level,
    rewrite.keyParagraphs,
  );

  // 5) 읽기 시간 추정(한국어 ~500자/분 heuristic) — 재작성 본문 기준
  const reading_minutes = Math.max(1, Math.round(bodyChars / 500));

  return {
    level,
    title: rewrite.title,
    summary: rewrite.summary,
    content_html,
    glossary: glossaryMap,
    reading_minutes,
    quiz: quiz.questions,
  };
}

/** 세 수준은 서로 독립이다. 하나라도 실패하면 취소하고 전부 정리한 뒤 반환한다. */
export async function processArticleLevels(
  article: OriginalArticle,
  meter: UsageMeter,
  signal: AbortSignal,
  context?: TraceContext,
): Promise<ProcessedVariant[]> {
  const controller = new AbortController();
  const childSignal = AbortSignal.any([signal, controller.signal]);
  const levels: Level[] = [1, 2, 3];
  const results = await Promise.allSettled(levels.map(async (level) => {
    try {
      return await processArticle(article, level, meter, childSignal, context);
    } catch (cause) {
      controller.abort(cause);
      throw cause;
    }
  }));
  return results.map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
}

/* ------------------------------------------------------------------ */
/* 분류 (classify) — 소스분류.md §3. 후보 묶음을 여덟 분류 + reject로 나눈다   */
/* ------------------------------------------------------------------ */

export async function classifyCandidates(
  candidates: ClassifyCandidate[],
  meter?: UsageMeter,
): Promise<Classify["items"]> {
  if (candidates.length === 0) return [];
  const result = await callJSON(
    ClassifySchema,
    CLASSIFY_SYSTEM,
    buildClassifyUser(candidates),
    // 후보 20건 기준 여유 있게. 항목당 ~15토큰이면 20건에 400토큰 안팎이다.
    Math.max(500, candidates.length * 40),
    0,
    meter,
  );
  return result.items;
}

/*
 * ── 선택: 신뢰도 업그레이드 ──
 * 1) 구조화 출력 강제: 프롬프트 대신 Claude tool_use(input_schema)로 JSON을 강제하면
 *    파싱 실패가 거의 사라진다. rawCall을 tools=[{name,input_schema}] +
 *    tool_choice={type:"tool",name} 로 바꾸고 tool_use 블록의 input을 그대로 검증하면 됨.
 * 2) 사실성 크리틱 콜: 생성된 quiz를 본문과 함께 한 번 더 모델에 넣어
 *    "각 문항의 정답 근거가 본문에 있는가"를 검증/폐기하는 4번째 콜을 붙일 수 있다(비용↑).
 *    MVP에서는 위 스키마 검증 + 본문근거 프롬프트로 충분.
 */
