/** Document cron integration with synthetic publishers, PostgREST and a forbidden LLM endpoint. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { DOCUMENT_CANDIDATES } from "../lib/news/document-candidates";
import { DOCUMENT_APPROVALS } from "../lib/news/document-approvals";
import { extractDocumentSnapshot } from "../lib/news/document-extract";
import { extractStoredDocument, syncDocumentCandidates } from "../lib/news/document-ingest";
import { startDeadline } from "../lib/news/ingest";
import type { SourceRights } from "../lib/content-rights";

async function main() {
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://document-db.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture",
    CRON_SECRET: "fixture-cron", BASE_URL: "https://document-llm.invalid", API_KEY: "fixture", MODEL_ID: "fixture" });
  const candidate = DOCUMENT_CANDIDATES.find(c => c.key === "google-ml-language-models")!;
  const approvals = DOCUMENT_APPROVALS as Record<string, typeof DOCUMENT_APPROVALS[string]>;
  const originalApproval = approvals[candidate.key];
  const originalFetch = globalThis.fetch;
  const notice = 'Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4.0 License. <a href="https://creativecommons.org/licenses/by/4.0/">License</a>';
  const html = `<html lang="en"><body><h1>Lesson</h1><div class="devsite-article-body"><h2 id="what_is_a_language_model">Language models</h2><p>${"Tokens form a sequence and the model estimates probabilities. ".repeat(16)}</p><p>Examples use <code>orange is ripe</code>.</p><pre>you are very nice</pre><table><tr><td>cook soup</td><td>9.4%</td></tr></table><h2 id="context">Unselected</h2></div><footer>${notice}</footer></body></html>`;
  const text = extractDocumentSnapshot(html, candidate).text;
  approvals[candidate.key] = { ...originalApproval, textSha256: createHash("sha256").update(text).digest("hex") };
  const past = new Date(Date.now() - 40 * 86_400_000).toISOString();
  const source: SourceRights = { source: candidate.source, rights_status: "permitted", evidence_url: candidate.evidenceUrl,
    reviewed_at: past, expires_at: null, allow_collect: true, allow_process: true, allow_publish: false };
  const newRow = (status = "unreviewed") => ({ id: 1, source: candidate.source, source_url: candidate.url,
    title: candidate.title, domain_id: 6, status: "pending", rights_status: status, original_text: null as string | null,
    published_at: null, fetched_at: past, rights_evidence_url: null, rights_reviewed_at: null as string | null,
    rights_expires_at: null as string | null, rights_attribution: null, rights_review_note: "" });
  let rows = [newRow()];
  let mode = "normal", pageCalls = 0, modelCalls = 0, rightsCalls = 0;
  let allowModel = false, variantCount = 0, quizCount = 0;
  const writes: { method: string; body: Record<string, unknown>; query: URLSearchParams }[] = [];
  function matches(row: Record<string, unknown>, params: URLSearchParams) {
    for (const [key, value] of params) {
      if (value.startsWith("eq.") && String(row[key]) !== value.slice(3)) return false;
      if (value === "is.null" && row[key] != null) return false;
      if (value === "not.is.null" && row[key] == null) return false;
      if (value.startsWith("lt.") && !(String(row[key]) < value.slice(3))) return false;
      if (value.startsWith("in.(") && !value.slice(4, -1).split(",").map(s => s.replace(/^"|"$/g, "")).includes(String(row[key]))) return false;
    }
    return true;
  }
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === "https://document-llm.invalid") {
      modelCalls++; assert.ok(allowModel, "Unexpected model call");
      const body = JSON.parse(String(init?.body)), prompt = body.messages[1].content as string;
      const level = Number(prompt.match(/대상 수준: ([123])/)?.[1] ?? 1);
      if (body.max_tokens === 3000) assert.ok(prompt.includes(text), "rewrite must receive the exact selected snapshot including examples/table");
      const content = body.max_tokens === 3000 ? { title: "가공 제목", summary: "요약", paragraphs: ["가".repeat([0, 600, 1000, 1500][level])], keyParagraphs: [0] } :
        body.max_tokens === 1500 ? { terms: [] } : { questions: Array.from({ length: 4 }, (_, i) => ({ prompt: `문제 ${i}`, options: ["가", "나", "다", "라"], correct_index: 0, explanation: "설명" })) };
      return Response.json({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
    }
    if (url.origin === "https://developers.google.com") {
      pageCalls++;
      assert.equal(url.href, candidate.url, "held document and arbitrary URLs cannot be fetched");
      assert.equal(new Headers(init?.headers).get("accept-language"), "en-US,en;q=0.9");
      if (mode === "withdraw") rows[0].rights_status = "blocked";
      if (mode === "redirect") return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
      const body = mode === "changed" ? html.replace("orange is ripe", "changed reviewed input") : mode === "license" ? html.replace(notice, "") : html;
      return new Response(body, { headers: { "content-type": "text/html" } });
    }
    assert.equal(url.origin, "https://document-db.invalid");
    const table = url.pathname.split("/").pop(), method = init?.method ?? "GET";
    if (table === "content_source_rights") {
      rightsCalls++;
      if (mode === "source-withdraw" && rightsCalls > 1) return Response.json([{ ...source, allow_process: false }]);
      return Response.json([source]);
    }
    if (table === "domains") return Response.json([{ id: 6, slug: "llm", active: true }]);
    if (table === "article_variants") {
      if (method === "POST") return Response.json({ id: ++variantCount });
      return method === "GET" ? Response.json([]) : new Response(null, { status: 204 });
    }
    if (table === "quiz_questions") { quizCount += JSON.parse(String(init?.body)).length; return new Response(null, { status: 204 }); }
    if (table === "domain_terms") return new Response(null, { status: 204 });
    assert.equal(table, "articles");
    const selected = rows.filter(row => matches(row, url.searchParams));
    if (method === "GET") {
      const single = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object");
      return Response.json(single ? selected[0] ?? null : selected, { headers: { "content-range": `0-${Math.max(0, selected.length - 1)}/${selected.length}` } });
    }
    const body = JSON.parse(String(init?.body));
    writes.push({ method, body, query: url.searchParams });
    if (method === "POST") {
      if (rows.some(row => row.source_url === body.source_url)) return Response.json([]);
      const row = { ...newRow(), ...body }; rows.push(row); return Response.json([row]);
    }
    assert.equal(method, "PATCH");
    selected.forEach(row => Object.assign(row, body));
    return Response.json(selected.map(row => ({ id: row.id })), { headers: { "content-range": `*/${selected.length}` } });
  };
  try {
    const { createAdminClient } = await import("../lib/supabase/admin");
    const { GET } = await import("../app/api/cron/ingest/route.api");
    const db = createAdminClient(), domains = new Map([["llm", { id: 6 }]]);
    const run = () => syncDocumentCandidates(db, new Map([[source.source, source]]), domains, startDeadline());
    const request = (query = "") => new NextRequest(`https://app.invalid/api/cron/ingest${query}`, { headers: { authorization: "Bearer fixture-cron" } });
    let response = await GET(request());
    let summary = await response.json();
    assert.equal(response.status, 200); assert.equal(summary.documents.approved, 1);
    assert.equal(summary.classified, 0); assert.equal(modelCalls, 0);
    assert.equal(rows[0].rights_status, "permitted"); assert.equal(rows[0].published_at, null);
    assert.equal(rows[0].original_text, text); assert.equal(rows[0].fetched_at, past);
    assert.equal(summary.expired, 0, "old documents do not use the 10-day news TTL");
    assert.ok(!writes.some(w => w.body.status === "expired"), "TTL update must exclude document sources");
    const stored = extractStoredDocument(rows[0] as any);
    assert.ok(stored.ok); assert.equal(stored.text, text); assert.match(stored.text, /orange is ripe/);
    assert.ok(!extractStoredDocument({ ...rows[0], original_text: text + "tampered" }).ok);
    assert.ok(!extractStoredDocument({ ...rows[0], rights_review_note: "{}" }).ok);
    const beforePages = pageCalls;
    summary = await (await GET(request("?documentsOnly=1"))).json();
    assert.equal(summary.documents.skipped, 1); assert.equal(pageCalls, beforePages);
    assert.equal(modelCalls, 0);
    // No generic-extractor fallback: tampered approved document never reaches the LLM.
    rows[0].original_text = text + "tampered";
    const { GET: processCategory } = await import("../app/api/cron/ingest/[category]/route.api");
    summary = await (await processCategory(request(), { params: Promise.resolve({ category: "llm" }) })).json();
    assert.equal(summary.retryLater, 1); assert.equal(summary.processed, 0); assert.equal(modelCalls, 0);
    assert.equal(pageCalls, beforePages);
    rows[0].original_text = text; allowModel = true;
    summary = await (await processCategory(request(), { params: Promise.resolve({ category: "llm" }) })).json();
    assert.equal(summary.processed, 1); assert.equal(rows[0].status, "ready"); assert.equal(rows[0].original_text, null);
    assert.equal(variantCount, 3); assert.equal(quizCount, 12); assert.equal(pageCalls, beforePages);
    assert.ok(modelCalls > 0); allowModel = false; modelCalls = 0;
    for (const status of ["restricted", "blocked"]) {
      rows = [newRow(status)]; const calls = pageCalls;
      assert.equal((await run()).approved, 0); assert.equal(pageCalls, calls); assert.equal(rows[0].rights_status, status);
    }
    for (const failureMode of ["changed", "license", "redirect"]) {
      rows = [newRow()]; mode = failureMode;
      const result = await run(); assert.equal(result.deferred, 1); assert.equal(rows[0].rights_status, "unreviewed");
      assert.equal(rows[0].original_text, null); assert.equal(modelCalls, 0);
    }
    rows = [newRow()]; mode = "withdraw";
    assert.equal((await run()).approved, 0); assert.equal(rows[0].rights_status, "blocked");
    rows = [newRow()]; mode = "source-withdraw"; rightsCalls = 0;
    assert.equal((await run()).approved, 0); assert.equal(rows[0].rights_status, "unreviewed");
    mode = "normal"; rows = [];
    assert.equal((await run()).discovered, 1); assert.equal((await run()).discovered, 0);
    rows[0].source_url += "/?hl=en&utm_source=alias"; rows[0].rights_reviewed_at = past;
    assert.equal((await run()).discovered, 0, "locale/trailing aliases are not duplicated");
    rows[0].status = "ready"; rows[0].rights_reviewed_at = past; rows[0].original_text = null;
    assert.equal((await run()).approved, 1, "ready document permission can be renewed without regenerating");
    assert.equal(rows[0].status, "ready"); assert.equal(rows[0].original_text, null);
    const callCount = pageCalls;
    source.allow_collect = false;
    assert.equal((await run()).eligible, 0); assert.equal(pageCalls, callCount);
    source.allow_collect = true; rows = [newRow()];
    const timed = await syncDocumentCandidates(db, new Map([[source.source, source]]), domains, { ...startDeadline(), remainingSeconds: () => 119 });
    assert.equal(timed.stoppedBy, "time"); assert.equal(pageCalls, callCount);
    assert.equal((await GET(new NextRequest("https://app.invalid/api/cron/ingest?documentsOnly=1"))).status, 401);
    console.log("Document cron: discovery, aliases, reviewed scopes, license/content changes, withdrawal, TTL, revalidation, tampered processing, rights, auth and time bounds passed.");
  } finally { globalThis.fetch = originalFetch; approvals[candidate.key] = originalApproval; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
