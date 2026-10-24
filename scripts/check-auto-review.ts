/** Automatic approval integration: publisher evidence -> guarded DB approval -> same-run classification. */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { createAutoReviewer } from "../lib/news/auto-review";

const CC = "https://creativecommons.org/licenses/by/4.0/";
const googleNotice = "Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4.0 License, and code samples are licensed under the Apache 2.0 License.";
const prose = "<p>File permissions and access control determine which process can update a file.</p>";
const html = (body: string, footer = "") => `<html><body>${body}<footer>${footer}</footer></body></html>`;
const k8s = (extra = "") => html(`<article class="td-content"><h1>Reviewed article</h1><div class="td-byline">By Test Author | October 16, 2026</div>${prose}${extra}</article>`,
  'Distributed under CC BY 4.0 <a href="https://github.com/kubernetes/website/blob/main/LICENSE">License</a>');
const google = (author = true) => html(`<article><h1>Reviewed article<devsite-actions hidden>Save and categorize content</devsite-actions></h1>${author ? '<div class="wd-author"><div><span>Test Author</span><span>Technical Writer</span></div></div>' : ""}${prose}</article>`, `${googleNotice}<a href="${CC}">CC BY 4.0</a>`);

async function main() {
  const originalFetch = globalThis.fetch;
  try {
    const cases = [
      { source: "kubernetes", source_url: "https://kubernetes.io/blog/2026/10/16/test/", page: k8s() },
      { source: "go-blog", source_url: "https://go.dev/blog/test", page: html(`<article class="Article"><h1 class="small">The Go Blog</h1><h1>Reviewed article</h1><p class="author">Test Author<br>16 October 2026</p>${prose}</article>`, '<a href="/copyright">Copyright</a>') },
      { source: "duckdb", source_url: "https://duckdb.org/2026/10/16/test.html", page: html(`<h1>Reviewed article</h1><div class="postcontent"><p>Test Author</p>${prose}</div>`) },
      { source: "rust-blog", source_url: "https://blog.rust-lang.org/2026/10/16/test/", page: html(`<section class="white"><h1>Reviewed article</h1><p>Test Author</p>${prose}</section>`) },
      { source: "web-dev", source_url: "https://web.dev/blog/test", page: google() },
      { source: "chrome-developers", source_url: "https://developer.chrome.com/blog/test", page: google() },
      { source: "google-cloud-docs", source_url: "https://docs.cloud.google.com/storage/docs/test", page: google(false) },
      { source: "google-ml-course", source_url: "https://developers.google.com/machine-learning/test", page: google(false) },
    ];
    let externalCalls = 0, override: string | null = null, redirect = false;
    globalThis.fetch = async input => {
      externalCalls++;
      const url = String(input);
      if (url.endsWith("README.md")) return new Response("the blog is licensed MIT/Apache 2.0");
      if (url.endsWith("LICENSE") || url.endsWith("LICENSE-MIT")) return new Response("Copyright Test Authors. Permission is hereby granted. THE SOFTWARE IS PROVIDED AS IS.");
      if (url.endsWith("/_posts/2026-10-16-test.md")) return new Response('---\ntitle: "Reviewed article"\nauthor: "Test Author"\n---\nTest');
      if (url.endsWith("/content/test.md")) return new Response('+++\ntitle = "Reviewed article"\nauthors = ["Test Author"]\n+++\nTest');
      if (url === "https://go.dev/copyright") return new Response(`Creative Commons Attribution 4.0 <a href="${CC}">License</a>`);
      const fixture = cases.find(c => c.source_url === url);
      assert.ok(fixture, `Unexpected fetch: ${url}`);
      return redirect ? new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }) : new Response(override ?? fixture.page);
    };
    const reviewer = createAutoReviewer();
    for (const fixture of cases) {
      const result = await reviewer({ ...fixture, title: "RSS slug" }, AbortSignal.timeout(1000));
      assert.equal(result.approved, true, `${fixture.source}: ${JSON.stringify(result)}`);
      if (result.approved) {
        assert.equal(result.attribution.originalTitle, "Reviewed article");
        assert.ok(result.attribution.author && result.attribution.changes && result.attribution.notices);
        assert.match(result.htmlSha256, /^[a-f0-9]{64}$/);
      }
    }
    for (const [page, reason] of [[k8s("<blockquote>External author text</blockquote>"), "quoted-material"],
      [k8s("<p>This is a guest blog post by a customer.</p>"), "article-license-exception"],
      [k8s().replace("Distributed under CC BY 4.0", ""), "missing-license-notice"],
      [k8s().replace("By Test Author | October 16, 2026", ""), "missing-author"]]) {
      override = page;
      assert.deepEqual(await reviewer({ ...cases[0], title: null }, AbortSignal.timeout(1000)), { approved: false, reason });
    }
    override = null;
    const beforeInvalid = externalCalls;
    assert.equal((await reviewer({ source: "kubernetes", source_url: "https://evil.invalid/blog/test", title: null }, AbortSignal.timeout(1000))).approved, false);
    assert.equal(externalCalls, beforeInvalid, "foreign URLs rejected before fetching");
    redirect = true;
    assert.deepEqual(await reviewer({ ...cases[0], title: null }, AbortSignal.timeout(1000)), { approved: false, reason: "unexpected-origin" });
    redirect = false;

    Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://auto-db.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-private",
      CRON_SECRET: "auto-test", BASE_URL: "https://auto-llm.invalid", API_KEY: "test", MODEL_ID: "test" });
    const { GET } = await import("../app/api/cron/ingest/route.api");
    const { createAdminClient } = await import("../lib/supabase/admin");
    const { reviewPendingArticles } = await import("../lib/news/review-queue");
    const { startDeadline } = await import("../lib/news/ingest");
    const source = { source: "kubernetes", rights_status: "permitted", evidence_url: "https://github.com/kubernetes/website/blob/main/LICENSE",
      reviewed_at: "2026-01-01T00:00:00Z", expires_at: null, allow_collect: true, allow_process: true, allow_publish: true };
    type Row = Record<string, any>;
    let rows: Row[] = [], writes = 0, modelCalls = 0, pageCalls = 0;
    let mode: "normal" | "source-withdrawn" | "article-withdrawn" = "normal";
    const newRow = (id: number): Row => ({ id, source: "kubernetes", source_url: `https://kubernetes.io/blog/item-${id}/`, title: "RSS title",
      status: "pending", domain_id: null, rights_status: "unreviewed", rights_reviewed_at: null, rights_expires_at: null,
      rights_evidence_url: null, rights_attribution: null, fetched_at: "2026-01-01T00:00:00Z", published_at: null });
    const matches = (row: Row, params: URLSearchParams) => [...params].every(([key, filter]) => {
      if (filter.startsWith("eq.")) return String(row[key]) === filter.slice(3);
      if (filter === "is.null") return row[key] === null;
      if (filter === "not.is.null") return row[key] !== null;
      if (filter.startsWith("lt.")) return row[key] !== null && Date.parse(row[key]) < Date.parse(filter.slice(3));
      if (filter.startsWith("in.")) return filter.includes(String(row[key]));
      return true;
    });
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.origin === "https://kubernetes.io") {
        if (url.pathname === "/en/sitemap.xml") return new Response("<urlset/>");
        if (url.pathname === "/feed.xml") return new Response(`<rss><channel><item><title>New RSS title</title><link>https://kubernetes.io/blog/item-2/</link><description>UNREVIEWED_RSS_DESCRIPTION</description><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`);
        pageCalls++;
        if (mode === "source-withdrawn") source.allow_process = false;
        if (mode === "article-withdrawn") rows.forEach(r => { r.rights_status = "blocked"; });
        return new Response(k8s());
      }
      if (url.origin === "https://auto-llm.invalid") {
        modelCalls++;
        assert.ok(!String(init?.body).includes("UNREVIEWED_RSS_DESCRIPTION"));
        const approved = rows.filter(r => r.rights_status === "permitted");
        return Response.json({ choices: [{ message: { content: JSON.stringify({ items: approved.map((_, i) => ({ i, category: "infra" })) }) }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
      }
      assert.equal(url.origin, "https://auto-db.invalid");
      const table = url.pathname.split("/").pop();
      if (table === "content_source_rights") return Response.json([source]);
      if (table === "domains") return Response.json([{ id: 2, slug: "infra", active: true }]);
      assert.equal(table, "articles");
      if (init?.method === "POST") {
        for (const incoming of JSON.parse(String(init.body))) if (!rows.some(r => r.source_url === incoming.source_url)) rows.push({ ...newRow(2), ...incoming });
        return Response.json([]);
      }
      const selected = rows.filter(row => matches(row, url.searchParams));
      if (init?.method === "PATCH") {
        writes++;
        const patch = JSON.parse(String(init.body));
        if (patch.status === "expired") assert.ok(url.searchParams.has("rights_reviewed_at"), "newly approved backlog gets a full processing window");
        if (patch.rights_status === "permitted") {
          assert.equal(url.searchParams.get("rights_status"), "eq.unreviewed");
          assert.ok(url.searchParams.has("rights_reviewed_at") && url.searchParams.has("rights_expires_at"), "approval must compare the prior review and expiry");
        }
        selected.forEach(r => Object.assign(r, patch));
        return Response.json(selected.map(r => ({ id: r.id })));
      }
      if (url.searchParams.get("rights_status") === "eq.unreviewed" && url.searchParams.get("select") !== "id") {
        assert.ok(url.searchParams.get("or")?.includes("rights_reviewed_at.lt."), "deferred articles have a retry delay");
        assert.ok(url.searchParams.get("order")?.startsWith("rights_reviewed_at.asc.nullsfirst"), "unseen articles cannot be starved by repeated failures");
      }
      return Response.json(selected.map(r => ({ ...r })), { headers: { "content-range": `0-${Math.max(0, selected.length - 1)}/${selected.length}` } });
    };
    rows = [newRow(1), { ...newRow(3), rights_status: "blocked" }];
    const request = () => new NextRequest("https://app.invalid/api/cron/ingest", { headers: { Authorization: "Bearer auto-test" } });
    let response = await GET(request());
    assert.equal(response.status, 200);
    let summary = await response.json();
    assert.equal(summary.autoReview.approved, 2, "both new and existing backlog approved automatically");
    assert.equal(summary.classified, 2); assert.equal(summary.queued, 2); assert.equal(modelCalls, 1);
    assert.equal(rows.find(r => r.id === 3)?.rights_status, "blocked");
    for (const row of rows.filter(r => r.id !== 3)) {
      assert.equal(row.status, "pending"); assert.equal(row.domain_id, 2);
      assert.equal(row.rights_attribution.author, "Test Author");
    }
    const pagesBefore = pageCalls;
    summary = await (await GET(request())).json();
    assert.equal(summary.autoReview.approved, 0); assert.equal(pageCalls, pagesBefore, "approved articles are not repeatedly reviewed");

    for (const nextMode of ["source-withdrawn", "article-withdrawn"] as const) {
      mode = nextMode; source.allow_process = true; rows = [newRow(1)];
      const beforeCalls: number = modelCalls;
      summary = await (await GET(request())).json();
      assert.equal(summary.autoReview.approved, 0); assert.equal(modelCalls, beforeCalls);
      assert.ok(rows.every(r => r.rights_status !== "permitted"), "concurrent withdrawal cannot be overwritten");
    }
    mode = "normal"; source.allow_process = true; rows = [newRow(1)];
    const beforePages = pageCalls, beforeWrites = writes;
    const deadline = { ...startDeadline(), remainingSeconds: () => 99 };
    const timed = await reviewPendingArticles(createAdminClient(), new Map([[source.source, source as any]]), deadline);
    assert.equal(timed.stoppedBy, "time"); assert.equal(pageCalls, beforePages); assert.equal(writes, beforeWrites);
    source.allow_process = false;
    const disabled = await reviewPendingArticles(createAdminClient(), new Map([[source.source, source as any]]), startDeadline());
    assert.equal(disabled.reviewed, 0); assert.equal(pageCalls, beforePages);
    source.allow_process = true;
    rows = [{ ...newRow(1), rights_expires_at: "2026-01-02T00:00:00Z" }];
    const expired = await reviewPendingArticles(createAdminClient(), new Map([[source.source, source as any]]), startDeadline());
    assert.equal(expired.deferred, 1); assert.equal(expired.reasons["article-expired"], 1);
    assert.equal(rows[0].rights_status, "unreviewed"); assert.ok(rows[0].rights_reviewed_at);
    assert.equal(pageCalls, beforePages, "expired permissions must not fetch the publisher");
    console.log("Automatic approval: eight source policies, exceptions, attribution, redirect rejection, new/backlog classification, withdrawal, retries, TTL and deadline checks passed.");
  } finally { globalThis.fetch = originalFetch; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
