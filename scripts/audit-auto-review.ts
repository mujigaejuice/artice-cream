/** Read-only dry run of automatic article approval; no LLM calls or remote writes. */
import { mkdirSync, writeFileSync } from "node:fs";
import { createAdminClient } from "../lib/supabase/admin";
import { getSourceRights, sourceAllows } from "../lib/content-rights";
import { AUTO_REVIEW_SOURCES, createAutoReviewer } from "../lib/news/auto-review";
import { mapPool } from "../lib/news/ingest";

async function main() {
  const db = createAdminClient();
  const rights = await getSourceRights(db);
  const sources = AUTO_REVIEW_SOURCES.filter(s => sourceAllows(rights.get(s), "process"));
  if (!sources.length) { console.log("No processing sources enabled."); return; }
  const { data, error } = await db.from("articles").select("id,source,source_url,title")
    .eq("status", "pending").eq("rights_status", "unreviewed").in("source", sources)
    .order("fetched_at", { ascending: false }).order("id", { ascending: false }).limit(32);
  if (error) throw error;
  const review = createAutoReviewer();
  const results = await mapPool(data ?? [], 4, async row => {
    const result = await review(row, AbortSignal.timeout(20_000));
    return { id: row.id, source: row.source, url: row.source_url, ...result };
  });
  const report = { checkedAt: new Date().toISOString(), databaseWrites: 0,
    reviewed: results.length, approved: results.filter(r => r.approved).length, results };
  mkdirSync("spike-out", { recursive: true });
  writeFileSync("spike-out/auto-review-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, results: results.map(r => ({ id: r.id, source: r.source,
    approved: r.approved, ...(!r.approved ? { reason: r.reason } : { author: r.author, title: r.title }) })) }, null, 2));
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
