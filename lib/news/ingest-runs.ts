// lib/news/ingest-runs.ts — 인제스트 cron 한 번 = ingest_runs 한 줄.
//
// 지금까지 런 결과는 Vercel 로그에만 있었다. 가공이 0편으로 끝난 런의 원인을
// 나중에 찾을 수 없었던 이유다. 라우트가 이미 만드는 요약(JSON 응답)에서
// 숫자·멈춘 이유·실패 메타데이터만 골라 한 줄로 남긴다.
//
// 원칙
//   - 기록은 cron을 절대 깨뜨리지 않는다. 짧은 타임아웃, 실패는 삼키고 console.error.
//   - 프롬프트, 본문, 모델 출력, 게이트웨이 응답 본문, 비밀값은 남기지 않는다.
//     허용 목록에 있는 키만 옮기고 문자열은 잘라낸다.
//   - 인증 실패(401)·잘못된 분류(404)는 라우트가 래퍼 밖에서 돌려보내므로 기록하지 않는다.

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

export type IngestRoute = "collect" | "collect-documents" | "process";
export type IngestRunStatus = "ok" | "partial" | "failed";

/** supabase/migrations/20261116090000_ingest_runs.sql 행. */
export type IngestRunRow = {
  run_id: string;
  route: IngestRoute;
  category: string | null;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  status: IngestRunStatus;
  http_status: number | null;
  collected: number | null;
  classified: number | null;
  extracted: number | null;
  processed: number | null;
  failed: number | null;
  stopped_by: string | null;
  llm_calls: number | null;
  http_retries: number | null;
  error: string | null;
  details: Record<string, unknown>;
};

export type IngestRunMeta = { runId: string; route: IngestRoute; category: string | null };

/** 기록 한 번에 쓰는 최대 시간. 라우트는 플랫폼 상한 30초 전에 멈추므로 여유가 있다. */
export const INGEST_RUN_WRITE_TIMEOUT_MS = 3_000;

const MAX_STRING = 200;
const MAX_FAILURES = 20;
const MAX_DETAILS_CHARS = 32_000;
const MAX_ERROR_CHARS = 500;

/**
 * 라우트 본문을 감싸 끝날 때 한 줄을 남긴다. 응답은 그대로 돌려주고, 던진 예외는
 * 기록한 뒤 다시 던진다. 기록 실패는 절대 바깥으로 나가지 않는다.
 */
export async function recordIngestRun(
  meta: IngestRunMeta,
  run: () => Promise<Response>,
  options: { timeoutMs?: number; client?: () => SupabaseClient } = {},
): Promise<Response> {
  const startedAt = new Date();
  let response: Response | undefined;
  let thrown: unknown;
  let threw = false;
  try {
    response = await run();
    return response;
  } catch (cause) {
    threw = true;
    thrown = cause;
    throw cause;
  } finally {
    try {
      const body = response ? await readJson(response) : undefined;
      const row = buildIngestRunRow(meta, startedAt, new Date(),
        threw ? { thrown } : { httpStatus: response?.status ?? null, body });
      await writeIngestRun(row, options);
    } catch (cause) {
      console.error("[ingest:run-log] build failed", meta.runId, errorName(cause));
    }
  }
}

/** Best-effort insert. Never throws; returns whether the row was stored. */
export async function writeIngestRun(
  row: IngestRunRow,
  options: { timeoutMs?: number; client?: () => SupabaseClient } = {},
): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? INGEST_RUN_WRITE_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const admin = (options.client ?? createAdminClient)();
    const insert = Promise.resolve(admin.from("ingest_runs").insert(row)
      .abortSignal(AbortSignal.timeout(timeoutMs)))
      // Aborts and network errors come back with code "" — never treat them as stored.
      .then(({ error }) => error
        ? { failed: error.code || error.message?.split(":")[0].slice(0, 40) || "error" }
        : { failed: null });
    // abortSignal이 안 먹는 경로(클라이언트 생성 지연 등)에서도 기다림을 끊는다.
    const deadline = new Promise<{ failed: string }>((resolve) => {
      timer = setTimeout(() => resolve({ failed: "timeout" }), timeoutMs + 250);
    });
    const { failed } = await Promise.race([insert, deadline]);
    if (failed) {
      console.error("[ingest:run-log] insert failed", JSON.stringify({ runId: row.run_id, code: failed }));
      return false;
    }
    return true;
  } catch (cause) {
    console.error("[ingest:run-log] insert failed", JSON.stringify({ runId: row.run_id, error: errorName(cause) }));
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type Outcome = { thrown: unknown } | { httpStatus: number | null; body: unknown };
type Json = Record<string, unknown>;

/** 응답 요약에서 한 줄을 만든다. 순수 함수 — 검사에서 직접 부른다. */
export function buildIngestRunRow(meta: IngestRunMeta, startedAt: Date, finishedAt: Date,
  outcome: Outcome): IngestRunRow {
  const row: IngestRunRow = {
    run_id: meta.runId, route: meta.route, category: meta.category,
    started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
    duration_ms: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    status: "failed", http_status: null,
    collected: null, classified: null, extracted: null, processed: null, failed: null,
    stopped_by: null, llm_calls: null, http_retries: null, error: null, details: {},
  };
  if ("thrown" in outcome) {
    row.error = clip(`thrown ${safeError(outcome.thrown)}`, MAX_ERROR_CHARS);
    return row;
  }
  row.http_status = outcome.httpStatus;
  const body = isObject(outcome.body) ? outcome.body : {};
  const usage = isObject(body.usage) ? body.usage : null;
  row.llm_calls = int(usage?.calls);
  row.http_retries = int(usage?.retries);
  row.stopped_by = shortStr(body.stoppedBy) ?? (body.ranOutOfTime === true ? "time" : null);

  // 요약이 아닌 오류 응답({ error }) — 단계 전에 멈췄다.
  if (typeof body.stage !== "string") {
    row.error = clip(str(body.error) ?? `HTTP ${outcome.httpStatus ?? "?"}`, MAX_ERROR_CHARS);
    row.details = { httpStatus: outcome.httpStatus };
    return row;
  }

  const failures = Array.isArray(body.failures) ? body.failures.filter(isObject).map(safeFailure) : [];
  if (body.stage === "process") {
    const extractFailed = int(body.extractFailed) ?? 0;
    const retryLater = int(body.retryLater) ?? 0;
    const buildFailed = int(body.failed) ?? 0;
    row.extracted = int(body.extracted);
    row.processed = int(body.processed) ?? 0;
    row.failed = extractFailed + retryLater + buildFailed;
    row.status = row.failed === 0 ? "ok" : row.processed > 0 ? "partial" : "failed";
    row.details = pick(body, ["queueDepth", "scanned", "blockedRights", "allowedSources", "skippedSource",
      "extractFailed", "retryLater", "failed", "articleCap", "model", "estimatedCostUsd", "seconds",
      "budgetUsd", "priceSource"]);
  } else if (body.stage === "documents") {
    const documents = isObject(body.documents) ? body.documents : {};
    row.collected = int(documents.discovered);
    row.stopped_by = shortStr(documents.stoppedBy);
    row.failed = 0;
    row.status = outcome.httpStatus !== null && outcome.httpStatus >= 400 ? "failed" : "ok";
    row.details = { documents: safeCounts(documents) };
  } else {
    const classifyFailed = int(body.classifyFailed) ?? 0;
    const saveFailed = failures.filter((f) => f.stage === "save" || f.stage === "permissions").length;
    row.collected = int(body.discovered);
    row.classified = int(body.classified);
    row.processed = int(body.queued);
    row.failed = classifyFailed + saveFailed;
    const ok = body.ok === true && (outcome.httpStatus ?? 200) < 400;
    const nothingQueued = (row.processed ?? 0) === 0 && (row.classified ?? 0) === 0;
    row.status = ok ? "ok" : row.failed > 0 && nothingQueued ? "failed" : "partial";
    row.details = {
      ...pick(body, ["feedItems", "afterDedupe", "alreadyKnown", "discovered", "queued", "rejected",
        "expired", "awaitingRightsReview", "classificationCandidates", "classifyFailed", "ranOutOfTime",
        "allowedSources", "allowedDocumentSources", "processingSources", "blockedSources",
        "estimatedCostUsd", "seconds"]),
      ...(isObject(body.byCategory) ? { byCategory: safeCounts(body.byCategory) } : {}),
      ...(isObject(body.autoReview) ? { autoReview: safeCounts(body.autoReview) } : {}),
      ...(isObject(body.documents) ? { documents: safeCounts(body.documents) } : {}),
      ...(Array.isArray(body.sources) ? { sources: body.sources.filter(isObject).map((s) => ({
        id: str(s.id), latest: int(s.latest), archive: int(s.archive),
        ...(typeof s.error === "string" ? { error: clip(s.error, MAX_STRING) } : {}) })) } : {}),
    };
  }
  if (usage) row.details.usage = pick(usage, ["input", "output", "cacheWrite", "cacheRead", "calls", "retries"]);
  if (failures.length) {
    row.details.failures = failures.slice(0, MAX_FAILURES);
    if (failures.length > MAX_FAILURES) row.details.failuresOmitted = failures.length - MAX_FAILURES;
    row.error = clip(summarizeFailures(failures), MAX_ERROR_CHARS);
  }
  if (JSON.stringify(row.details).length > MAX_DETAILS_CHARS) {
    // 상한을 넘으면 실패 목록과 소스 목록을 줄인다. 숫자는 남긴다.
    delete row.details.sources;
    row.details.failures = failures.slice(0, 5);
    row.details.truncated = true;
  }
  return row;
}

/** "extract:http-error ×2; build:LLM gateway 504 ×1" */
export function summarizeFailures(failures: Json[]): string {
  const counts = new Map<string, number>();
  for (const f of failures) {
    const why = str(f.reason) ?? str(f.errorType) ?? str(f.code) ?? str(f.error)?.slice(0, 60) ??
      (f.timedOut === true ? "timeout" : "unknown");
    const key = `${str(f.stage) ?? "?"}:${why}${typeof f.httpStatus === "number" ? ` http=${f.httpStatus}` : ""}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, n]) => `${key} ×${n}`).join("; ");
}

/**
 * 게이트웨이 오류 메시지에는 응답 본문 300자가 붙는다(lib/ai/pipeline.ts GatewayError).
 * DB에는 상태 코드까지만 남긴다.
 */
export function safeError(cause: unknown): string {
  const name = cause instanceof Error ? cause.name : typeof cause;
  const message = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";
  const gateway = message.match(/^LLM gateway (\d+)/);
  const text = gateway ? `LLM gateway ${gateway[1]}` : message.split("\n")[0];
  return clip(text ? `${name}: ${text}` : name, MAX_STRING);
}

const FAILURE_KEYS = ["stage", "articleId", "articleIds", "source", "reason", "retryable", "httpStatus",
  "charCount", "timedOut", "errorType", "code", "seconds"] as const;

function safeFailure(f: Json): Json {
  const out: Json = {};
  for (const key of FAILURE_KEYS) {
    const value = f[key];
    if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    else if (typeof value === "string") out[key] = clip(value, MAX_STRING);
    else if (key === "articleIds" && Array.isArray(value)) out[key] = value.filter((v) => typeof v === "number").slice(0, 50);
  }
  if (f.error !== undefined) out.error = safeError(typeof f.error === "string" ? new Error(f.error) : f.error);
  return out;
}

/** 숫자·짧은 문자열·숫자 맵만. 리뷰 사유 집계 같은 것. */
function safeCounts(value: Json): Json {
  const out: Json = {};
  for (const [key, v] of Object.entries(value).slice(0, 50)) {
    if (typeof v === "number" || typeof v === "boolean") out[key] = v;
    else if (typeof v === "string") out[key] = clip(v, MAX_STRING);
    else if (isObject(v)) out[key] = Object.fromEntries(Object.entries(v).slice(0, 50)
      .filter(([, n]) => typeof n === "number"));
  }
  return out;
}

function pick(source: Json, keys: string[]): Json {
  const out: Json = {};
  for (const key of keys) {
    const v = source[key];
    if (typeof v === "number" || typeof v === "boolean" || v === null) out[key] = v;
    else if (typeof v === "string") out[key] = clip(v, MAX_STRING);
  }
  return out;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    return undefined;
  }
}

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const int = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
const str = (v: unknown): string | null => typeof v === "string" && v ? v : null;
const shortStr = (v: unknown): string | null => typeof v === "string" && v ? v.slice(0, 40) : null;
const clip = (s: string, n: number) => s.length > n ? `${s.slice(0, n - 1)}…` : s;
const errorName = (cause: unknown) => cause instanceof Error ? cause.name : typeof cause;

/* ------------------------------------------------------------------ */
/* 읽기 — scripts/report-ingest-runs.ts                                */
/* ------------------------------------------------------------------ */

export type RunRate = { key: string; total: number; ok: number; partial: number; failed: number;
  processed: number; successRate: number };

/** 라우트·분류별 성공률. 수집은 "collect", 가공은 분류 이름이 키다. */
export function runRates(rows: Pick<IngestRunRow, "route" | "category" | "status" | "processed" | "started_at">[],
  since: Date): RunRate[] {
  const byKey = new Map<string, RunRate>();
  for (const row of rows) {
    if (Date.parse(row.started_at) < since.getTime()) continue;
    const key = row.route === "process" ? row.category ?? "?" : row.route;
    const rate = byKey.get(key) ?? { key, total: 0, ok: 0, partial: 0, failed: 0, processed: 0, successRate: 0 };
    rate.total += 1;
    rate[row.status] += 1;
    if (row.route === "process") rate.processed += row.processed ?? 0;
    byKey.set(key, rate);
  }
  return [...byKey.values()].map((r) => ({ ...r, successRate: r.total ? r.ok / r.total : 0 }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
