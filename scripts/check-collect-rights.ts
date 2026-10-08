/** Collector regression: discovered or withdrawn articles must never reach classification. */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

async function main() {
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://collect-db.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "test-private", CRON_SECRET: "test-cron",
    BASE_URL: "https://collect-llm.invalid", API_KEY: "test", MODEL_ID: "test-model" });
  const past = new Date(Date.now() - 60_000).toISOString();
  const source = { source: "kubernetes", rights_status: "permitted", evidence_url: "https://publisher.invalid/license",
    reviewed_at: past, expires_at: null, allow_collect: true, allow_process: true, allow_publish: true };
  const reviewedArticle = { id: 1, source: "kubernetes", source_url: "https://kubernetes.io/blog/fixture/",
    title: "Reviewed fixture", status: "pending", rights_status: "permitted", published_at: null,
    rights_evidence_url: source.evidence_url, rights_reviewed_at: past, rights_expires_at: null,
    rights_attribution: { author: "Test Author", originalTitle: "Fixture", licenseLabel: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/", changes: "Test translation", notices: "" } };
  let mode: "unreviewed" | "approved" | "withdrawn" = "unreviewed";
  let llmCalls = 0;
  let feedCalls = 0;
  let writes: { method: string; body: unknown; query: string }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === "https://kubernetes.io") {
      assert.equal(url.pathname, "/feed.xml"); feedCalls++;
      return new Response(`<rss><channel><item><title>New unreviewed fixture</title><link>https://kubernetes.io/blog/new-fixture/</link><description>PRIVATE_UNREVIEWED_SUMMARY</description><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`);
    }
    if (url.origin === "https://collect-llm.invalid") {
      llmCalls++;
      assert.ok(String(init?.body).includes("Reviewed fixture"));
      assert.ok(!String(init?.body).includes("PRIVATE_UNREVIEWED_SUMMARY"));
      return Response.json({ choices: [{ message: { content: JSON.stringify({ items: [{ i: 0, category: "infra" }] }) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1 } });
    }
    assert.equal(url.origin, "https://collect-db.invalid", "collector may fetch only the approved test source");
    const table = url.pathname.split("/").pop();
    const method = init?.method ?? "GET";
    if (method !== "GET") {
      assert.equal(table, "articles"); writes.push({ method, body: JSON.parse(String(init?.body)), query: url.search });
      return method === "POST" ? Response.json([{ id: 2 }]) : Response.json([{ id: 1 }]);
    }
    if (table === "content_source_rights") return Response.json([source]);
    if (table === "domains") return Response.json([{ id: 1, slug: "infra", active: true }]);
    assert.equal(table, "articles");
    if (url.searchParams.get("select") === "source_url") return Response.json([]);
    if (mode === "unreviewed") return Response.json([{ ...reviewedArticle, rights_status: "unreviewed" }]);
    if (mode === "withdrawn" && !url.searchParams.has("domain_id")) {
      return Response.json([{ ...reviewedArticle, rights_status: "blocked" }]);
    }
    return Response.json([reviewedArticle]);
  };
  const { GET } = await import("../app/api/cron/ingest/route.api");
  const request = () => new NextRequest("https://app.invalid/api/cron/ingest", { headers: { Authorization: "Bearer test-cron" } });
  let summary = await (await GET(request())).json();
  assert.equal(summary.classified, 0); assert.equal(llmCalls, 0);
  const discovered = writes.find((write) => write.method === "POST")!.body as { rights_status: string }[];
  assert.equal(discovered[0].rights_status, "unreviewed");
  // Collection approval alone may fetch/store metadata, even if a supposedly
  // reviewed article is returned by the DB. It must never call the provider.
  source.allow_process = false; source.allow_publish = false; mode = "approved"; writes = [];
  summary = await (await GET(request())).json();
  assert.equal(summary.allowedSources, 1); assert.equal(summary.processingSources, 0);
  assert.equal(summary.classified, 0); assert.equal(llmCalls, 0);
  assert.ok(writes.some((write) => write.method === "POST"));
  assert.ok(!writes.some((write) => write.method === "PATCH"), "metadata-only collection must not classify or expire the queue");
  source.allow_process = true;
  mode = "withdrawn"; writes = [];
  summary = await (await GET(request())).json();
  assert.equal(summary.classified, 0); assert.equal(llmCalls, 0, "withdrawal is checked immediately before classification");
  mode = "approved"; writes = [];
  summary = await (await GET(request())).json();
  assert.equal(summary.classified, 1); assert.equal(summary.queued, 1); assert.equal(llmCalls, 1);
  assert.equal(feedCalls, 4);
  assert.ok(writes.some((write) => write.method === "PATCH" && (write.body as { domain_id?: number }).domain_id === 1));
  source.allow_collect = false; writes = [];
  summary = await (await GET(request())).json();
  assert.equal(summary.allowedSources, 0); assert.equal(summary.processingSources, 1);
  assert.equal(summary.classified, 1); assert.equal(llmCalls, 2); assert.equal(feedCalls, 4);
  assert.ok(!writes.some((write) => write.method === "POST"), "existing approved articles classify without reopening collection");
  console.log("Collector rights: discovery stays unreviewed, no unreviewed summary reaches LLM, withdrawal blocks classification, reviewed articles classify and queue.");
}
main().catch((cause: unknown) => { console.error(cause); process.exitCode = 1; });
