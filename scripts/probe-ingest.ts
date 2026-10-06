/** Recheck a small sample of publisher pages. No LLM calls or database writes. */
import { readFileSync, writeFileSync } from "node:fs";
import { extractArticle } from "../lib/news/extract";
import { SOURCES } from "../lib/news/feeds";

async function main() {
  const report = JSON.parse(readFileSync("spike-out/ingest-audit.json", "utf8")) as {
    categories: { category: string; head: Row[]; recentFailures: Row[] }[];
  };
  type Row = { id: number; source: string; source_url: string; status: string };
  const kinds = new Map(SOURCES.map((source) => [source.id, source.kind]));
  const originalFetch = globalThis.fetch;
  const httpStatuses = new Map<string, number>();
  // Record publisher HTTP status and independently bound diagnostic requests.
  globalThis.fetch = async (input, init) => {
    const timeout = AbortSignal.timeout(20_000);
    const response = await originalFetch(input, { ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
    httpStatuses.set(String(input), response.status);
    return response;
  };
  const results = [];
  try {
    for (const group of report.categories.filter((g) => ["cloud", "infra", "data"].includes(g.category))) {
      for (const row of [...group.recentFailures, ...group.head.slice(0, 2)]) {
        const start = Date.now();
        try {
          const result = await extractArticle({ url: row.source_url, title: "" }, kinds.get(row.source) ?? "news");
          const summary = { category: group.category, id: row.id, source: row.source, status: row.status,
            url: row.source_url, httpStatus: httpStatuses.get(row.source_url), seconds: (Date.now() - start) / 1000,
            ...(result.ok ? { ok: true, chars: result.charCount } : { ok: false, reason: result.reason }) };
          results.push(summary);
          console.log(JSON.stringify(summary));
        } catch (cause) {
          const summary = { category: group.category, id: row.id, url: row.source_url, error: String(cause) };
          results.push(summary);
          console.log(JSON.stringify(summary));
        }
      }
    }
    writeFileSync("spike-out/ingest-probe.json", JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
