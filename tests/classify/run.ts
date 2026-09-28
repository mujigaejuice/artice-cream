/**
 * 분류 스파이크. 소스분류.md §1의 분류 기준을 LLM에 맡겼을 때 사람의 분류와
 * 얼마나 맞는지 잰다.
 *
 * 정답 세트는 `tests/classify/golden.json`이다(tests/README.md). 프롬프트에 경계
 * 예시로 들어간 제목은 채점에서 뺀다.
 *
 *   npm run test:classify
 *   SPLIT=dev npm run test:classify
 *   SPIKE_BATCH=10 SPIKE_JSON_SCHEMA=0 npm run test:classify
 *
 * 앞선 실행에서 틀린 것만 다시 보려면(모델을 바꿔 볼 때):
 *   MODEL_ID=openai/gpt-4.1-nano:batch \
 *   SPIKE_RETRY_FROM=spike-out/classify.json SPIKE_OUT=spike-out/classify-retry.json \
 *   npm run spike:classify
 *
 * .env의 BASE_URL·MODEL_ID·API_KEY를 쓴다(OpenAI 호환 /chat/completions). 셸에서
 * 넘긴 값이 .env보다 우선한다.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  CLASSIFY_EXAMPLES,
  CLASSIFY_SYSTEM,
  buildClassifyUser,
  type ClassifyCandidate,
} from "../../lib/ai/prompts";
import { CATEGORY_SLUGS, ClassifySchema, type ClassifyLabel } from "../../lib/ai/schemas";

// 셸에서 넘긴 값을 파일이 덮지 않게 먼저 집어 둔다.
const shell = { ...process.env };
for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // 없으면 넘어간다. 실제로 필요한 값은 아래에서 확인한다.
  }
}

const BASE_URL = shell.BASE_URL ?? process.env.BASE_URL;
const MODEL_ID = shell.MODEL_ID ?? process.env.MODEL_ID;
const API_KEY = shell.API_KEY ?? process.env.API_KEY;
const BATCH = Number(process.env.SPIKE_BATCH ?? 20);
/** 이 파일에서 틀린 항목만 다시 채점한다. */
const RETRY_FROM = process.env.SPIKE_RETRY_FROM;
/** dev | holdout | all. 프롬프트는 dev만 보고 고치고, holdout으로 확인한다. */
const SPLIT = process.env.SPLIT ?? "all";
const GOLDEN = process.env.GOLDEN ?? "tests/classify/golden.json";
const OUT = process.env.SPIKE_OUT ?? "spike-out/classify.json";
/** 구조화 출력. 게이트웨이가 거부하면 0으로 끄고 본문 파싱에만 기댄다. */
const USE_JSON_SCHEMA = process.env.SPIKE_JSON_SCHEMA !== "0";

const LABELS = [...CATEGORY_SLUGS, "reject"] as const;

type Golden = {
  source: string;
  title: string;
  summary: string;
  label: ClassifyLabel;
  /** 사람이 분류하며 망설인 건. 이것만 따로 센다. */
  ambiguous: boolean;
  split: "dev" | "holdout";
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

type Usage = { prompt: number; completion: number };

async function chat(
  messages: { role: string; content: string }[],
  usage: Usage,
): Promise<string> {
  const body: Record<string, unknown> = {
    model: MODEL_ID,
    messages,
    temperature: 0,
    seed: 7,
    max_tokens: 1500,
  };
  if (USE_JSON_SCHEMA) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "classification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  i: { type: "integer" },
                  category: { type: "string", enum: [...LABELS] },
                },
                required: ["i", "category"],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    };
  }

  // 게이트웨이가 502(upstream_error)를 자주 낸다. 잠깐 쉬었다 다시 보낸다.
  const waits = [2000, 5000, 15000, 40000];
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });

    if (response.ok) {
      const json = await response.json();
      usage.prompt += json.usage?.prompt_tokens ?? 0;
      usage.completion += json.usage?.completion_tokens ?? 0;
      return json.choices?.[0]?.message?.content ?? "";
    }

    const text = (await response.text()).slice(0, 200);
    if (attempt >= waits.length || (response.status < 500 && response.status !== 429)) {
      throw new Error(`${response.status} ${text}`);
    }
    process.stderr.write(`  ${response.status} 재시도 ${attempt + 1}\n`);
    await sleep(waits[attempt]);
  }
}

/** 코드펜스나 앞뒤 설명이 붙어 와도 JSON 객체만 떼어 낸다. */
function parseItems(raw: string): { i: number; category: ClassifyLabel }[] | null {
  const fenced = raw.replace(/```(?:json)?/g, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = ClassifySchema.safeParse(JSON.parse(fenced.slice(start, end + 1)));
    return parsed.success ? parsed.data.items : null;
  } catch {
    return null;
  }
}

async function classifyBatch(
  batch: ClassifyCandidate[],
  usage: Usage,
): Promise<(ClassifyLabel | null)[]> {
  const messages = [
    { role: "system", content: CLASSIFY_SYSTEM },
    { role: "user", content: buildClassifyUser(batch) },
  ];

  let raw = await chat(messages, usage);
  let items = parseItems(raw);
  if (!items) {
    // 형식만 어긋난 경우가 많다. pipeline.callJSON과 같은 모양으로 한 번만 고쳐 받는다.
    process.stderr.write("  JSON 파싱 실패, 리페어 1회\n");
    raw = await chat(
      [
        ...messages,
        { role: "assistant", content: raw.slice(0, 2000) },
        {
          role: "user",
          content: '위 응답이 형식에 맞지 않습니다. {"items":[{"i":0,"category":"..."}]} JSON만 다시 출력하세요.',
        },
      ],
      usage,
    );
    items = parseItems(raw);
  }

  const out: (ClassifyLabel | null)[] = new Array(batch.length).fill(null);
  for (const item of items ?? []) {
    if (item.i >= 0 && item.i < batch.length) out[item.i] = item.category;
  }
  return out;
}

function table(rows: (string | number)[][]) {
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => String(r[c]).length)));
  for (const row of rows) {
    console.log(row.map((cell, c) => String(cell).padEnd(widths[c])).join("  "));
  }
}

async function main() {
  if (!BASE_URL || !MODEL_ID || !API_KEY) {
    console.error(".env에 BASE_URL, MODEL_ID, API_KEY가 필요합니다.");
    process.exit(1);
  }

  const golden: Golden[] = JSON.parse(readFileSync(GOLDEN, "utf-8"));
  const exampleTitles = new Set(CLASSIFY_EXAMPLES.map((e) => norm(e.title)));
  let scored = golden.filter((g) => !exampleTitles.has(norm(g.title)));
  if (SPLIT !== "all") scored = scored.filter((g) => g.split === SPLIT);
  console.log(
    `정답 ${golden.length}건 중 프롬프트 예시 ${golden.filter((g) => exampleTitles.has(norm(g.title))).length}건을 빼고 ${scored.length}건을 채점한다. split=${SPLIT}, 모델 ${MODEL_ID}, 배치 ${BATCH}.`,
  );

  if (RETRY_FROM) {
    const before = JSON.parse(readFileSync(RETRY_FROM, "utf-8"));
    const failed = new Set(
      (before.results as { title: string; label: string; predicted: string | null }[])
        .filter((r) => r.predicted !== r.label)
        .map((r) => norm(r.title)),
    );
    scored = scored.filter((g) => failed.has(norm(g.title)));
    console.log(
      `${RETRY_FROM}(${before.model})에서 틀린 ${failed.size}건 중 ${scored.length}건만 다시 채점한다. 이 숫자는 전체 정확도가 아니라 "그때 틀린 것이 이번엔 맞는가"만 말한다.`,
    );
  }

  const usage: Usage = { prompt: 0, completion: 0 };
  const startedAt = Date.now();
  const predictions: (ClassifyLabel | null)[] = [];
  for (let start = 0; start < scored.length; start += BATCH) {
    const batch = scored.slice(start, start + BATCH);
    predictions.push(...(await classifyBatch(batch, usage)));
    process.stderr.write(`${Math.min(start + BATCH, scored.length)}/${scored.length}\n`);
  }

  const results = scored.map((g, n) => ({ ...g, predicted: predictions[n] }));
  const hit = (r: (typeof results)[number]) => r.predicted === r.label;
  const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "-");

  /**
   * split별로 따로 낸다. 프롬프트는 dev만 보고 고치고, holdout 숫자가 실제 성적이다.
   */
  function report(name: string, rows: typeof results) {
    if (rows.length === 0) return;
    const ok = rows.filter(hit).length;
    const clear = rows.filter((r) => !r.ambiguous);
    const ambiguous = rows.filter((r) => r.ambiguous);
    // 버릴 것을 버리는가. 카드 품질에는 이 이분법이 분류 정확도보다 먼저다.
    const keepTruth = (r: (typeof rows)[number]) => r.label !== "reject";
    const keepPred = (r: (typeof rows)[number]) => r.predicted !== null && r.predicted !== "reject";
    const tp = rows.filter((r) => keepTruth(r) && keepPred(r)).length;
    const fp = rows.filter((r) => !keepTruth(r) && keepPred(r)).length;
    const fn = rows.filter((r) => keepTruth(r) && !keepPred(r)).length;
    console.log(
      `\n[${name}] 일치 ${ok}/${rows.length} (${pct(ok, rows.length)})` +
        ` · 안 갈린 건 ${pct(clear.filter(hit).length, clear.length)}` +
        ` · 망설인 건 ${pct(ambiguous.filter(hit).length, ambiguous.length)}`,
    );
    console.log(
      `  싣는다/버린다: 정밀도 ${pct(tp, tp + fp)} (버려야 할 ${fp}건을 실었다) · 재현율 ${pct(tp, tp + fn)} (실어야 할 ${fn}건을 버렸다)`,
    );
  }

  report("전체", results);
  if (SPLIT === "all") {
    report("dev", results.filter((r) => r.split === "dev"));
    report("holdout", results.filter((r) => r.split === "holdout"));
  }

  const rows: (string | number)[][] = [["분류", "정답", "예측", "맞음", "정밀도", "재현율"]];
  for (const label of LABELS) {
    const truth = results.filter((r) => r.label === label);
    const pred = results.filter((r) => r.predicted === label);
    const correct = truth.filter(hit).length;
    rows.push([
      label,
      truth.length,
      pred.length,
      correct,
      pct(correct, pred.length),
      pct(correct, truth.length),
    ]);
  }
  console.log();
  table(rows);

  const missing = results.filter((r) => r.predicted === null);
  if (missing.length) console.log(`\n응답에 빠진 항목 ${missing.length}건`);

  console.log("\n## 다른 판단");
  for (const r of results.filter((r) => !hit(r))) {
    console.log(
      `${r.split.padEnd(7)} ${r.label}${r.ambiguous ? "?" : ""} → ${r.predicted ?? "(없음)"}  [${r.source}] ${r.title.slice(0, 80)}`,
    );
  }

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `\n${seconds}초, 입력 ${usage.prompt.toLocaleString()} 토큰, 출력 ${usage.completion.toLocaleString()} 토큰`,
  );

  mkdirSync("spike-out", { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({ model: MODEL_ID, batch: BATCH, usage, seconds, results }, null, 2),
    "utf-8",
  );
  console.log(`원자료 → ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
