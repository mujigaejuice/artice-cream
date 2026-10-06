/** Read-only ingest audit. No LLM requests, cron invocation, or database writes. */
import { mkdirSync, writeFileSync } from "node:fs";
import { createAdminClient } from "../lib/supabase/admin";

type Article = {
  id: number; domain_id: number | null; source: string | null; source_url: string;
  status: string; published_at: string | null; fetched_at: string;
};
type Variant = { article_id: number; level: number; created_at: string };

async function main() {
  const admin = createAdminClient();
  async function articles() {
    const rows: Article[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.from("articles")
        .select("id,domain_id,source,source_url,status,published_at,fetched_at")
        .order("id").range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }
  async function variants() {
    const rows: Variant[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.from("article_variants")
        .select("article_id,level,created_at").order("id").range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }
  const [domainResult, allArticles, allVariants] = await Promise.all([
    admin.from("domains").select("id,slug"), articles(), variants(),
  ]);
  if (domainResult.error) throw domainResult.error;
  const domains = new Map(domainResult.data.map((d) => [d.id, d.slug as string]));
  const byId = new Map(allArticles.map((a) => [a.id, a]));
  const coverage = new Map<number, Set<number>>();
  const daily: Record<string, Record<string, Set<number>>> = {};
  for (const variant of allVariants) {
    const article = byId.get(variant.article_id);
    const category = domains.get(article?.domain_id) ?? "unknown";
    const levels = coverage.get(variant.article_id) ?? new Set<number>();
    levels.add(variant.level);
    coverage.set(variant.article_id, levels);
    if (variant.level !== 1) continue;
    const day = variant.created_at.slice(0, 10);
    daily[day] ??= {};
    (daily[day][category] ??= new Set()).add(variant.article_id);
  }
  const categories = [...domains.entries()].map(([id, category]) => {
    const rows = allArticles.filter((a) => a.domain_id === id);
    const statuses: Record<string, number> = {};
    for (const row of rows) statuses[row.status] = (statuses[row.status] ?? 0) + 1;
    const queue = rows.filter((a) => a.status === "pending").sort((a, b) =>
      (b.published_at ?? "").localeCompare(a.published_at ?? "") || a.id - b.id);
    const head = queue.slice(0, 40);
    const headSources: Record<string, number> = {};
    for (const row of head) headSources[row.source ?? "unknown"] = (headSources[row.source ?? "unknown"] ?? 0) + 1;
    return { category, statuses, headSources, head: head.slice(0, 8),
      recentFailures: rows.filter((a) => a.status === "extract_failed" || a.status === "paywalled")
        .sort((a, b) => b.id - a.id).slice(0, 5) };
  });
  const report = {
    checkedAt: new Date().toISOString(),
    articles: allArticles.length,
    variants: allVariants.length,
    dailyLevel1ArticlesUTC: Object.fromEntries(Object.entries(daily).sort().map(([day, counts]) =>
      [day, Object.fromEntries(Object.entries(counts).map(([category, ids]) => [category, ids.size]))])),
    incompleteArticles: [...coverage].filter(([id, levels]) => levels.size !== 3 || byId.get(id)?.status !== "ready")
      .map(([id, levels]) => ({ ...byId.get(id), levels: [...levels] })),
    categories,
  };
  mkdirSync("spike-out", { recursive: true });
  writeFileSync("spike-out/ingest-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, categories: categories.map(({ head, recentFailures, ...summary }) => summary) }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
