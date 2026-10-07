/** Real API handlers and SDK, isolated HTTP: denied content must have no side effects. */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { articleAllows, sourceAllows, type ArticleRights, type SourceRights } from "../lib/content-rights";

async function main() {
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://rights.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public", SUPABASE_SERVICE_ROLE_KEY: "test-private",
    CRON_SECRET: "rights-test" });
  const userId = "11111111-1111-4111-8111-111111111111";
  const past = new Date(Date.now() - 60_000).toISOString();
  const source: SourceRights = { source: "test-publisher", rights_status: "permitted",
    evidence_url: "https://publisher.invalid/permission", reviewed_at: past, expires_at: null,
    allow_collect: true, allow_process: true, allow_publish: true };
  const article: ArticleRights & { id: number; source_url: string; domain_id: number } = {
    id: 1, source: source.source, source_url: "https://publisher.invalid/1", domain_id: 1,
    status: "ready", rights_status: "permitted", rights_evidence_url: source.evidence_url,
    rights_reviewed_at: past, rights_expires_at: null,
    rights_attribution: { author: "Test Author", originalTitle: "Original title", licenseLabel: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/", changes: "Translated and adapted; glossary and quizzes added", notices: "" },
  };
  const sources = new Map([[source.source, source]]);
  assert.equal(sourceAllows(source, "collect"), true);
  assert.equal(articleAllows(article, sources, "publish"), true);
  assert.equal(articleAllows(article, sources, "process"), false);
  assert.equal(articleAllows({ ...article, status: "pending" }, sources, "process"), true);
  for (const rights_status of ["unreviewed", "restricted", "blocked"] as const) {
    assert.equal(articleAllows({ ...article, rights_status }, sources, "publish"), false);
    assert.equal(sourceAllows({ ...source, rights_status }, "publish"), false);
  }
  for (const changes of [{ rights_evidence_url: null }, { rights_reviewed_at: null },
    { rights_reviewed_at: new Date(Date.now() + 60_000).toISOString() },
    { rights_expires_at: past }, { rights_expires_at: "invalid" }, { rights_attribution: null },
    { source: "unknown" }, { rights_attribution: { ...article.rights_attribution!, author: " " } },
    { rights_attribution: { ...article.rights_attribution!, licenseUrl: "javascript:alert(1)" } }]) {
    assert.equal(articleAllows({ ...article, ...changes }, sources, "publish"), false);
  }
  assert.equal(sourceAllows({ ...source, allow_publish: false }, "publish"), false);
  assert.equal(sourceAllows({ ...source, expires_at: past }, "publish"), false);

  let current: ArticleRights = { ...article, rights_status: "unreviewed" };
  let registryMode: "valid" | "blocked" | "missing" = "valid";
  let articleReadFails = false;
  const writes: string[] = [];
  let quizReads = 0;
  let publisherRequests = 0;
  const domain = { id: 1, slug: "cloud", name_ko: "클라우드", name_en: "Cloud", rss_topic: null, active: true };
  const variant = () => ({ id: 2, article_id: 1, title: "Adapted title", summary: "Summary", level: 2,
    content_html: "<p>Adapted body</p>", glossary: {}, reading_minutes: 1,
    articles: { ...article, ...current, domains: domain, published_at: null, image_url: null } });
  const saved = () => ({ id: 3, article_id: 1, variant_id: 2, quiz_score: 1, status: "saved",
    completed_at: new Date().toISOString(), article_variants: variant(), articles: { ...article, ...current } });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== "https://rights.invalid") {
      publisherRequests++;
      throw new Error("Denied content must never reach a publisher or an LLM");
    }
    if (url.pathname === "/auth/v1/user") return Response.json({ id: userId, is_anonymous: false });
    const table = url.pathname.split("/").pop();
    if (init?.method && init.method !== "GET") {
      writes.push(table!);
      return Response.json([]);
    }
    if (table === "content_source_rights") return registryMode === "missing"
      ? Response.json({ code: "PGRST205", message: "missing" }, { status: 404 })
      : Response.json([{ ...source, ...(registryMode === "blocked" ? { rights_status: "blocked" } : {}) }]);
    if (table === "articles") return articleReadFails
      ? Response.json({ code: "XX000", message: "unavailable" }, { status: 503 })
      : Response.json({ ...article, ...current });
    if (table === "article_variants") return Response.json(url.searchParams.has("level") ? [variant()] : variant());
    if (table === "user_article_progress") return Response.json(url.searchParams.has("article_id") ? saved() :
      [{ ...saved(), ...(url.searchParams.get("status")?.startsWith("in.") ? { status: "completed" } : {}) }]);
    if (table === "quiz_questions") { quizReads++; return Response.json([]); }
    throw new Error(`Unexpected read ${table}`);
  };
  try {
    const { POST: open } = await import("../app/api/read/open/route.api");
    const { GET: quiz } = await import("../app/api/quiz/route.api");
    const { POST: grade } = await import("../app/api/quiz/grade/route.api");
    const { POST: save } = await import("../app/api/progress/save/route.api");
    const { GET: collect } = await import("../app/api/cron/ingest/route.api");
    const { GET: process } = await import("../app/api/cron/ingest/[category]/route.api");
    const { createAdminClient } = await import("../lib/supabase/admin");
    const { getTodayPicks, getScoops, getScoopMonths } = await import("../lib/feed");
    const request = (path: string, body?: unknown) => new Request(`https://app.invalid${path}`, {
      headers: { Authorization: "Bearer signed-token", Origin: "https://localhost", "Content-Type": "application/json" },
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    });
    const denied = async () => {
      for (const response of [await open(request("/api/read/open", { variantId: 2 })),
        await quiz(request("/api/quiz?v=2")), await grade(request("/api/quiz/grade", { variantId: 2, answers: {} })),
        await save(request("/api/progress/save", { articleId: 1 }))]) {
        assert.equal(response.status, 404);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.get("access-control-allow-origin"), "https://localhost");
        assert.deepEqual(await response.json(), { error: "not found" });
      }
      assert.equal(quizReads, 0, "no question or answer is read before the rights gate");
      assert.deepEqual(writes, [], "no quota, grading or save write is allowed");
    };
    for (const rights_status of ["unreviewed", "restricted", "blocked"] as const) {
      current = { ...article, rights_status };
      await denied();
    }
    current = { ...article, rights_expires_at: past }; await denied();
    current = { ...article, rights_attribution: null }; await denied();
    current = article; registryMode = "blocked"; await denied();
    registryMode = "missing"; await denied();
    registryMode = "valid"; articleReadFails = true; await denied(); articleReadFails = false;
    const admin = createAdminClient();
    current = { ...article, rights_status: "blocked" };
    assert.deepEqual(await getTodayPicks(admin, userId, [domain], new Map([[1, 2]])), []);
    assert.deepEqual(await getScoops(admin, userId), []);
    assert.deepEqual(await getScoopMonths(admin, userId), []);
    current = article;
    assert.equal((await getTodayPicks(admin, userId, [domain], new Map([[1, 2]]))).length, 1);
    assert.equal((await getScoops(admin, userId)).length, 1);
    assert.equal((await getScoopMonths(admin, userId)).length, 1);
    const opened = await open(request("/api/read/open", { variantId: 2 }));
    assert.equal(opened.status, 200);
    assert.deepEqual((await opened.json()).reader.attribution, article.rights_attribution);
    assert.equal((await save(request("/api/progress/save", { articleId: 1 }))).status, 200);
    assert.ok(writes.includes("user_article_progress"), "approved reads still use the usual progress gate");
    registryMode = "blocked";
    const cronRequest = new NextRequest("https://app.invalid/api/cron/ingest", { headers: { Authorization: "Bearer rights-test" } });
    assert.equal((await (await collect(cronRequest)).json()).stoppedBy, "rights");
    assert.equal((await (await process(cronRequest, { params: Promise.resolve({ category: "cloud" }) })).json()).stoppedBy, "rights");
    assert.equal(publisherRequests, 0, "rights stop occurs before any RSS, original body or LLM request");
    console.log("Content rights: missing/expired/withdrawn permissions, direct APIs, quota/write protection, feed/saved history, attribution, no-store and both cron gates passed.");
  } finally { globalThis.fetch = originalFetch; }
}
main().catch((cause: unknown) => { console.error(cause); process.exitCode = 1; });
