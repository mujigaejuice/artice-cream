/**
 * Before/after check for an approval batch prepared by scripts/prepare-article-approvals.ts
 * (and optionally a source migration such as 0005).
 *   --snapshot            record the current state (run before applying)
 *   (default)             compare the live state with the snapshot and the planned approvals
 *   --sources-changed=a,b these sources are expected to have become collect-only permitted
 * Read-only against the DB.
 *
 * Run: BATCH=batch2 node --env-file=.env.local --import=tsx scripts/verify-article-approvals.ts [--snapshot]
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createAdminClient } from "../lib/supabase/admin";
import { articleAllows, getSourceRights, sourceAllows } from "../lib/content-rights";

const BATCH = process.env.BATCH ?? "batch1";
const DIR = `spike-out/article-approvals/${BATCH}`;
const changedArg = process.argv.find((a) => a.startsWith("--sources-changed="));
const CHANGED = changedArg ? changedArg.split("=")[1].split(",").filter(Boolean) : [];

async function state() {
  const admin = createAdminClient();
  const { data: sources, error: sourceError } = await admin.from("content_source_rights").select("*").order("source");
  if (sourceError) throw new Error(sourceError.message);
  const counts: Record<string, number> = {};
  for (const table of ["articles", "article_variants", "quiz_questions"]) {
    const { count, error } = await admin.from(table).select("id", { head: true, count: "exact" });
    if (error) throw new Error(error.message);
    counts[table] = count ?? 0;
  }
  const byRights: Record<string, number> = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("articles").select("rights_status").order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) byRights[row.rights_status] = (byRights[row.rights_status] ?? 0) + 1;
    if (!data || data.length < 1000) break;
  }
  return { admin, sources: sources ?? [], counts, byRights };
}

async function main() {
  assert.match(BATCH, /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "BATCH must be a simple directory name");
  if (process.argv.includes("--snapshot")) {
    assert.ok(!existsSync(`${DIR}/snapshot.json`), "snapshot already exists; preserve the pre-approval state");
  }
  const live = await state();
  if (process.argv.includes("--snapshot")) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(`${DIR}/snapshot.json`, JSON.stringify({ at: new Date().toISOString(), sources: live.sources, counts: live.counts, byRights: live.byRights }, null, 2), { flag: "wx" });
    console.log(JSON.stringify({ snapshot: true, counts: live.counts, byRights: live.byRights }));
    return;
  }

  assert.ok(existsSync(`${DIR}/snapshot.json`), "run with --snapshot before applying");
  const before = JSON.parse(readFileSync(`${DIR}/snapshot.json`, "utf8"));
  const planned: Array<{ id: number; url: string; attribution: unknown; note: string }> = JSON.parse(readFileSync(`${DIR}/planned.json`, "utf8"));

  // 1. Source table: only the named rows changed, and only to collect-only.
  const beforeBySource = new Map<string, Record<string, unknown>>(before.sources.map((row: Record<string, unknown>) => [row.source as string, row]));
  for (const row of live.sources) {
    const old = beforeBySource.get(row.source);
    assert.ok(old, `unexpected new source row ${row.source}`);
    if (CHANGED.includes(row.source)) {
      assert.equal(row.rights_status, "permitted");
      assert.equal(row.allow_collect, true);
      assert.equal(row.allow_process, false);
      assert.equal(row.allow_publish, false);
      assert.match(row.evidence_url, /^https:\/\//);
    } else {
      assert.deepEqual(row, old, `source ${row.source} changed unexpectedly`);
    }
  }
  assert.equal(live.sources.length, before.sources.length);
  const rights = await getSourceRights(live.admin);
  const collectingBefore = before.sources.filter((row: Record<string, unknown>) => row.allow_collect && row.rights_status === "permitted").map((row: Record<string, unknown>) => row.source as string);
  const collecting = [...rights.values()].filter((row) => sourceAllows(row, "collect")).map((row) => row.source).sort();
  assert.deepEqual(collecting, [...new Set([...collectingBefore, ...CHANGED])].sort());
  assert.ok([...rights.values()].every((row) => !sourceAllows(row, "process") && !sourceAllows(row, "publish")), "no source may process/publish");

  // 2. Planned articles: exactly as prepared, still blocked from processing and publication.
  const result = [];
  for (const expected of planned) {
    const { data, error } = await live.admin.from("articles").select("*").eq("id", expected.id).single();
    if (error) throw new Error(error.message);
    assert.equal(data.source_url, expected.url);
    assert.equal(data.rights_status, "permitted");
    assert.deepEqual(data.rights_attribution, expected.attribution);
    assert.equal(data.rights_review_note, expected.note);
    assert.equal(data.status, "pending");
    assert.equal(articleAllows(data, rights, "process"), false, `article ${data.id} must not process yet`);
    assert.equal(articleAllows(data, rights, "publish"), false, `article ${data.id} must not publish`);
    result.push({ id: data.id, source: data.source, rights: data.rights_status, status: data.status });
  }

  // 3. Nothing else moved: exactly the planned rows went unreviewed -> permitted.
  const expectedRights = { ...before.byRights };
  expectedRights.unreviewed = (expectedRights.unreviewed ?? 0) - planned.length;
  expectedRights.permitted = (expectedRights.permitted ?? 0) + planned.length;
  assert.deepEqual(live.byRights, expectedRights, "rights_status distribution changed beyond the planned rows");
  assert.deepEqual(live.counts, before.counts, "article/variant/quiz counts changed");

  const report = { checkedAt: new Date().toISOString(), sourcesChanged: CHANGED, approvedArticles: result, counts: live.counts, byRights: live.byRights };
  writeFileSync(`${DIR}/verified.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

main().catch((cause: unknown) => { console.error(cause instanceof Error ? cause.message : "Verification failed"); process.exitCode = 1; });
