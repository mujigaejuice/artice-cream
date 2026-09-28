/**
 * Spike B — LLM quality and cost (plan §2, risk gate 2).
 *
 * Reads the articles Spike A managed to extract, runs `processArticle` at all
 * three levels, and reports measured cost per variant. Run Spike A first.
 *
 *   npm run spike:llm
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

import {
  addMeter,
  estimateCost,
  newMeter,
  processArticle,
  type UsageMeter,
} from "../lib/ai/pipeline";
import type { Level } from "../lib/ai/schemas";
import { extractArticle } from "../lib/news/extract";

const SAMPLE = Number(process.env.SPIKE_SAMPLE ?? 3);
const LEVELS: Level[] = [1, 2, 3];

type SpikeRow = { url: string; title: string; host: string; ok: boolean };

async function main() {
  const gateway = process.env.BASE_URL && process.env.API_KEY;
  if (gateway) {
    console.log(`LLM 게이트웨이: ${process.env.BASE_URL} (${process.env.MODEL_ID ?? "기본 모델"})`);
  } else if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY도 BASE_URL/API_KEY도 없습니다. ant auth login 프로필을 사용합니다.");
  }

  let rows: SpikeRow[];
  try {
    rows = JSON.parse(readFileSync("spike-out/extract.json", "utf-8")).rows;
  } catch {
    console.error("spike-out/extract.json이 없습니다. 먼저 `npm run spike:extract`를 실행하세요.");
    process.exit(1);
  }

  const candidates = rows.filter((r) => r.ok).slice(0, SAMPLE);
  if (candidates.length === 0) {
    console.error("추출에 성공한 기사가 없습니다. 게이트 1을 먼저 통과해야 합니다.");
    process.exit(1);
  }

  let total: UsageMeter = newMeter();
  let variants = 0;
  const output: unknown[] = [];

  for (const candidate of candidates) {
    const extracted = await extractArticle(candidate);
    if (!extracted.ok) {
      console.log(`SKIP ${candidate.url} — 재추출 실패(${extracted.reason})`);
      continue;
    }

    console.log(`\n${"=".repeat(60)}\n${extracted.title}\n${extracted.host} · ${extracted.charCount}자`);

    for (const level of LEVELS) {
      const started = Date.now();
      // 콜마다 누적되는 미터를 variant별로 새로 만들어 개별 비용을 잰다.
      const meter = newMeter();
      const variant = await processArticle(
        { title: extracted.title, text: extracted.text },
        level,
        meter,
      );
      const seconds = ((Date.now() - started) / 1000).toFixed(1);

      total = addMeter(total, meter);
      variants += 1;
      output.push({ url: extracted.url, ...variant });

      console.log(`\n--- 수준 ${level} (${seconds}s, $${estimateCost(meter).toFixed(4)}) ---`);
      const terms = Object.values(variant.glossary);
      console.log(`제목: ${variant.title}`);
      console.log(`읽기 ${variant.reading_minutes}분`);
      console.log(`용어 ${terms.length}개: ${terms.map((t) => t.term).join(", ")}`);
      console.log(`문항 ${variant.quiz.length}개`);
      console.log(variant.content_html.replace(/<[^>]+>/g, "").slice(0, 300) + "...");
    }
  }

  const cost = estimateCost(total);
  console.log("\n" + "=".repeat(60));
  console.log(`variant ${variants}개 처리`);
  console.log(
    `토큰 — 입력 ${total.input} / 출력 ${total.output} / 캐시쓰기 ${total.cacheWrite} / 캐시읽기 ${total.cacheRead} (${total.calls}콜)`,
  );
  console.log(`총 비용 $${cost.toFixed(4)} · variant당 $${(cost / Math.max(1, variants)).toFixed(4)}`);
  console.log(`Batch API 적용 시(50%) variant당 약 $${(cost / Math.max(1, variants) / 2).toFixed(4)}`);

  mkdirSync("spike-out", { recursive: true });
  writeFileSync("spike-out/llm.json", JSON.stringify({ total, variants, cost, output }, null, 2), "utf-8");
  console.log("\n산출물 → spike-out/llm.json (품질은 육안 검수)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
