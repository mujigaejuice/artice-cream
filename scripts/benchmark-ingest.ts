/** Real generation benchmark (1 or 2 articles); no DB writes. */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import type { TraceEvent } from "../lib/ai/trace";
import type { ProcessedVariant } from "../lib/ai/schemas";
import { CONTENT_MODEL, newMeter, processArticleLevels } from "../lib/ai/pipeline";
import { LLM_CONCURRENCY } from "../lib/ai/request-limit";
import { extractArticle } from "../lib/news/extract";
import { SOURCES } from "../lib/news/feeds";
import { startDeadline } from "../lib/news/ingest";
import { ARTICLE_CONCURRENCY, ARTICLE_START_SECONDS, ARTICLE_TIMEOUT_SECONDS,
  articleTimeoutMs, processQueue } from "../lib/news/process-queue";

async function main() {
  const audit = JSON.parse(readFileSync("spike-out/ingest-audit.json", "utf8")) as {
    categories: { category: string; head: { id: number; source: string; source_url: string }[] }[];
  };
  const selectedId = process.argv.find((arg) => arg.startsWith("--article="))?.split("=")[1];
  const cap = process.argv.includes("--four") ? 4 : process.argv.includes("--two") ? 2 : 1;
  const rows = audit.categories.find((c) => c.category === "cloud")?.head
    .filter((row) => !selectedId || row.id === Number(selectedId)).slice(0, cap);
  if (!rows?.length) throw new Error("Run audit-ingest first; cloud queue is empty");
  const reportPath = `spike-out/ingest-benchmark-${selectedId ?? cap}`;
  const traces: TraceEvent[] = [];
  const samples: { articleId: number; variants: ProcessedVariant[] }[] = [];
  writeFileSync(`${reportPath}.jsonl`, "");
  const start = Date.now();
  const clock = startDeadline(start);
  const meter = newMeter();
  const articles: Record<string, unknown>[] = [];
  const summary = await processQueue(rows, {
    cap, concurrency: ARTICLE_CONCURRENCY,
    canStart: () => clock.remainingSeconds() < ARTICLE_START_SECONDS ? "time" : null,
    process: async (row) => {
      const articleStart = Date.now();
      const signal = AbortSignal.timeout(articleTimeoutMs(clock.remainingSeconds()));
      try {
        const extracted = await extractArticle({ url: row.source_url, title: "" },
          SOURCES.find((source) => source.id === row.source)?.kind ?? "news", signal);
        if (!extracted.ok) throw new Error(`extract: ${extracted.reason}`);
        const extractSeconds = (Date.now() - articleStart) / 1000;
        const variants = await processArticleLevels({ title: extracted.title, text: extracted.text }, meter, signal,
          { articleId: row.id, onTrace: (event) => {
            traces.push(event);
            appendFileSync(`${reportPath}.jsonl`, JSON.stringify(event) + "\n");
          } });
        samples.push({ articleId: row.id, variants });
        articles.push({ articleId: row.id, extractSeconds, seconds: (Date.now() - articleStart) / 1000,
          variants: variants.map((variant) => ({ level: variant.level, quizCount: variant.quiz.length })) });
        return true;
      } catch (cause) {
        articles.push({ articleId: row.id, seconds: (Date.now() - articleStart) / 1000,
          error: cause instanceof Error ? cause.message : String(cause) });
        return false;
      }
    },
  });
  const result = { checkedAt: new Date().toISOString(), model: CONTENT_MODEL,
    articleConcurrency: ARTICLE_CONCURRENCY, llmConcurrency: LLM_CONCURRENCY,
    articleStartSeconds: ARTICLE_START_SECONDS,
    articleTimeoutSeconds: ARTICLE_TIMEOUT_SECONDS,
    ...summary, totalSeconds: (Date.now() - start) / 1000, usage: meter, articles, databaseWrites: 0 };
  writeFileSync(`${reportPath}.json`, JSON.stringify({ ...result, traces }, null, 2));
  writeFileSync(`${reportPath}.variants.json`, JSON.stringify(samples, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (summary.processed !== cap) process.exitCode = 1;
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
