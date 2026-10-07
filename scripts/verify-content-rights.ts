/** Live production gate check: only a uniquely tagged temporary user is created/deleted. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../lib/supabase/env";
import { sourceAllows, type SourceRights } from "../lib/content-rights";

async function main() {
  if (!process.argv.includes("--production")) throw new Error("Pass --production for this explicit production check");
  const base = "https://artice-cream.vercel.app";
  const admin = createAdminClient();
  const run = randomUUID();
  const email = `rights-check-${run}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  let userId: string | undefined;
  const results: Record<string, unknown> = { checkedAt: new Date().toISOString() };
  try {
    const registry = await admin.from("content_source_rights").select("*");
    assert.equal(registry.error, null);
    assert.ok(registry.data?.length);
    assert.ok((registry.data as SourceRights[]).every((row) => !sourceAllows(row, "publish") &&
      !sourceAllows(row, "collect") && !sourceAllows(row, "process")), "initial registry must have no operational approvals");
    const domains = await admin.from("domains").select("id").eq("active", true).limit(1);
    assert.equal(domains.error, null); assert.ok(domains.data?.length);
    const variant = await admin.from("article_variants").select("id,article_id,articles!inner(rights_status,status)")
      .eq("articles.status", "ready").eq("articles.rights_status", "unreviewed").limit(1);
    assert.equal(variant.error, null); assert.ok(variant.data?.length, "an unreviewed stored variant is required");
    const fixtureArticle = variant.data[0];
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { content_rights_test: run } });
    if (created.error) throw new Error(`Fixture creation failed (${created.error.code ?? created.error.status})`);
    userId = created.data.user?.id; assert.ok(userId);
    assert.equal((await admin.from("user_domain_levels").insert({ user_id: userId, domain_id: domains.data[0].id, level: 2 })).error, null);
    assert.equal((await admin.from("user_article_progress").insert({ user_id: userId, article_id: fixtureArticle.article_id,
      variant_id: fixtureArticle.id, status: "saved", quiz_score: 1, completed_at: new Date().toISOString() })).error, null);
    const client = createClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw new Error(`Fixture sign-in failed (${signed.error.code ?? signed.error.status})`);
    assert.ok(signed.data.session);
    const token = signed.data.session.access_token;
    for (const [table, column, id] of [
      ["articles", "id", fixtureArticle.article_id], ["article_variants", "id", fixtureArticle.id],
      ["quiz_questions", "variant_id", fixtureArticle.id], ["user_article_progress", "article_id", fixtureArticle.article_id],
    ] as const) {
      const read = await client.from(table).select("id").eq(column, id);
      assert.equal(read.error, null, `${table}: valid client query`);
      assert.deepEqual(read.data, [], `${table}: denied via direct PostgREST`);
    }
    const original = await client.from("articles").select("original_text").eq("id", fixtureArticle.article_id);
    assert.ok(original.error, "original text column remains inaccessible");
    const terms = await client.from("domain_terms").select("term");
    assert.equal(terms.error, null); assert.deepEqual(terms.data, [], "old derived glossary cache is hidden");
    const request = (path: string, body?: unknown) => fetch(`${base}${path}`, {
      method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Origin: "https://localhost" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    for (const [path, body] of [
      ["/api/read/open", { variantId: fixtureArticle.id }], [`/api/quiz?v=${fixtureArticle.id}`, undefined],
      ["/api/quiz/grade", { variantId: fixtureArticle.id, answers: {} }],
      ["/api/progress/save", { articleId: fixtureArticle.article_id }],
    ] as const) {
      const response = await request(path, body);
      assert.equal(response.status, 404, `${path}: unpublished article`);
      assert.equal(response.headers.get("cache-control"), "no-store");
      results[path.split("?")[0]] = response.status;
    }
    const feedResponse = await request("/api/feed"); assert.equal(feedResponse.status, 200);
    const feed = await feedResponse.json(); assert.equal(feed.status, "ok"); assert.deepEqual(feed.picks, []);
    const coneResponse = await request("/api/cone"); assert.equal(coneResponse.status, 200);
    const cone = await coneResponse.json(); assert.deepEqual(cone.scoops, []); assert.deepEqual(cone.months, []);
    const quota = await admin.from("daily_quota").select("user_id").eq("user_id", userId);
    assert.equal(quota.error, null); assert.deepEqual(quota.data, [], "blocked read consumes no quota");
    const retained = await admin.from("user_article_progress").select("status").eq("user_id", userId);
    assert.equal(retained.error, null); assert.equal(retained.data?.[0]?.status, "saved", "private learning record is preserved");
    assert.equal((await admin.from("article_variants").select("id").eq("id", fixtureArticle.id).single()).error, null);
    results.directDbDenied = true; results.feedPicks = feed.picks.length; results.savedScoops = cone.scoops.length;
    results.quotaConsumed = false; results.learningRecordPreserved = true;
    if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET required for stop verification");
    for (const category of ["", "cloud", "infra", "data", "cs-fundamentals", "deep-learning", "llm", "ai-security", "security"]) {
      const response: Response = await fetch(`${base}/api/cron/ingest${category ? `/${category}` : ""}`, {
        cache: "no-store", signal: AbortSignal.timeout(60_000), headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      assert.equal(response.status, 200);
      const summary = await response.json(); assert.equal(summary.stoppedBy, "rights");
      assert.equal(category ? summary.processed : summary.classified, 0);
    }
    results.cronsStoppedByRights = 9;
    const publicPage = await fetch(`${base}/account/delete/`, { cache: "no-store" });
    assert.equal(publicPage.status, 200); assert.ok((await publicPage.text()).includes("계정 및 데이터 삭제"));
    results.publicDeletionPage = 200;
    mkdirSync("spike-out", { recursive: true });
    writeFileSync("spike-out/content-rights-production.json", JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally {
    if (userId) {
      const remaining = await admin.auth.admin.getUserById(userId);
      if (remaining.error) throw new Error("Could not verify the rights-check fixture for cleanup");
      assert.equal(remaining.data.user.email, email);
      assert.equal(remaining.data.user.app_metadata.content_rights_test, run);
      const removed = await admin.auth.admin.deleteUser(userId, false);
      if (removed.error) throw new Error("Rights-check fixture cleanup failed");
    }
  }
}
main().catch((cause: unknown) => { console.error(cause instanceof Error ? cause.message : "Production rights check failed"); process.exitCode = 1; });
