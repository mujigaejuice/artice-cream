/** Ingest integration checks with fake publisher, LLM and PostgREST responses. */
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import type { TraceEvent } from "../lib/ai/trace";

async function main() {
  Object.assign(process.env, {
    BASE_URL: "https://llm.invalid", API_KEY: "test", MODEL_ID: "test-model",
    LLM_MODEL: "test-model", INGEST_ARTICLES_PER_DOMAIN: "4", INGEST_MAX_SECONDS: "300",
    NEXT_PUBLIC_SUPABASE_URL: "https://db.invalid", SUPABASE_SERVICE_ROLE_KEY: "test",
    CRON_SECRET: "test-cron",
  });
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let elapsedOffset = 0;
  let simulateSlowArticles = false;
  let active = 0;
  let peak = 0;
  let hang = false;
  let nextVariantId = 1;
  let gatewayFailures = 0;
  let gatewayStatus = 504;
  let gatewayAttempts = 0;
  let termReadFailure = false;
  let invalidHighlights = false;
  let rawOverride: string | undefined;
  let brokenLengthRetry = false;
  const writes: { table: string; method: string; body: Record<string, unknown> | unknown[]; query: string }[] = [];
  const sources = ["removed", "limited", "aws-news", "aws-news", "aws-news", "cloudflare", "databricks", "gcp-blog"];
  // These are synthetic permissions, never actual publisher approvals.
  const reviewedAt = new Date(Date.now() - 60_000).toISOString();
  const attribution = { author: "Test Author", originalTitle: "Test original", licenseLabel: "test permission",
    licenseUrl: "https://publisher.invalid/license", changes: "Test adaptation", notices: "" };
  const rightsRows = [...new Set(sources)].map((source) => ({ source, rights_status: "permitted",
    evidence_url: "https://publisher.invalid/license", reviewed_at: reviewedAt, expires_at: null,
    allow_collect: true, allow_process: true, allow_publish: true }));
  const queue = sources.map((source, index) => ({ id: index + 1, source,
    source_url: `https://publisher.invalid/${index + 1}`, title: `Article ${index + 1}`, published_at: null,
    status: "pending", rights_status: "permitted", rights_evidence_url: "https://publisher.invalid/license",
    rights_reviewed_at: reviewedAt, rights_expires_at: null, rights_attribution: attribution }));
  const html = (id: number, length = 2000) => `<html><head><title>${id === 3 ? "FAIL_REWRITE" : `Article ${id}`}</title></head><body><article><h1>Test article</h1><p>${"기술 본문 설명입니다. ".repeat(length)}</p></article></body></html>`;

  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const signal = init?.signal ?? undefined;
    signal?.throwIfAborted();
    if (url.origin === "https://publisher.invalid") {
      const id = Number(url.pathname.slice(1));
      if (id === 1) return new Response(null, { status: 404 });
      if (id === 2) return new Response(null, { status: 429 });
      if (id === 99) {
        assert.ok(signal, "extraction must set a deadline");
        await delay(1000, undefined, { signal });
      }
      return new Response(html(id, id === 98 ? 2000 : 100), { headers: { "content-type": "text/html" } });
    }
    if (url.origin === "https://llm.invalid") {
      gatewayAttempts += 1;
      if (gatewayFailures-- > 0) return Response.json({ error: "upstream failure" }, { status: gatewayStatus });
      active += 1;
      peak = Math.max(peak, active);
      try {
        await delay(hang ? 1000 : 4, undefined, { signal });
        const body = JSON.parse(String(init?.body));
        const prompt = body.messages[1].content as string;
        const level = Number(prompt.match(/대상 수준: ([123])/)?.[1] ?? 1);
        let content: unknown;
        if (body.max_tokens === 3000) {
          content = prompt.includes("FAIL_REWRITE") ? {} : {
            title: "가공 제목", summary: "요약", paragraphs: ["가".repeat([0, 600, 1000, 1500][level])],
            keyParagraphs: invalidHighlights ? ["문단 내용"] : [0],
          };
          if (brokenLengthRetry) content = prompt.includes("직전 응답") ? {} : {
            title: "검증된 초안", summary: "요약", paragraphs: ["가".repeat(499)],
          };
        } else if (body.max_tokens === 1500) {
          content = { terms: [] };
        } else {
          content = { questions: Array.from({ length: 4 }, (_, i) => ({
            prompt: `문제 ${i}`, options: ["가", "나", "다", "라"], correct_index: 0, explanation: "설명",
          })) };
        }
        return Response.json({ choices: [{ message: { content: rawOverride ?? JSON.stringify(content) }, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 20 } });
      } finally {
        active -= 1;
      }
    }
    assert.equal(url.origin, "https://db.invalid", "unexpected network request");
    const table = url.pathname.split("/").pop()!;
    const method = init?.method ?? "GET";
    if (method === "GET") {
      if (table === "domains") return Response.json([{ id: 1, slug: "cloud", active: true }]);
      if (table === "content_source_rights") return Response.json(rightsRows);
      if (table === "articles") {
        const id = url.searchParams.get("id");
        return id ? Response.json(queue.find((row) => `eq.${row.id}` === id) ?? null) :
          Response.json(queue, { headers: { "content-range": "0-7/80" } });
      }
      if (table === "article_variants") return termReadFailure
        ? Response.json({ message: "term read failed" }, { status: 400 })
        : Response.json([]);
      throw new Error(`Unexpected read: ${table}`);
    }
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    writes.push({ table, method, body, query: url.search });
    if (simulateSlowArticles && table === "articles" && body.status === "ready") elapsedOffset = 180_000;
    if (table === "article_variants" && method === "POST") return Response.json({ id: nextVariantId++ });
    return new Response(null, { status: 204 });
  };

  try {
    const { articleTimeoutMs } = await import("../lib/news/process-queue");
    assert.equal(articleTimeoutMs(270), 240_000);
    assert.equal(articleTimeoutMs(120), 105_000, "late articles must end before the run deadline");
    const { extractArticle } = await import("../lib/news/extract");
    const gone = await extractArticle({ url: "https://publisher.invalid/1", title: "" });
    assert.ok(!gone.ok && !gone.retryable && gone.httpStatus === 404);
    const limited = await extractArticle({ url: "https://publisher.invalid/2", title: "" });
    assert.ok(!limited.ok && limited.retryable && limited.httpStatus === 429);
    const timedOut = await extractArticle({ url: "https://publisher.invalid/99", title: "" }, "news", AbortSignal.timeout(10));
    assert.ok(!timedOut.ok && timedOut.reason === "timeout" && timedOut.retryable);
    const tooLong = await extractArticle({ url: "https://publisher.invalid/98", title: "" }, "blog");
    assert.ok(!tooLong.ok && tooLong.reason === "too-long" && !tooLong.retryable);

    const { processArticle, processArticleLevels, newMeter, callJSON } = await import("../lib/ai/pipeline");
    const { RewriteSchema } = await import("../lib/ai/schemas");
    const retryMeter = newMeter();
    const retryTrace: TraceEvent[] = [];
    gatewayFailures = 1;
    const beforeRetry = gatewayAttempts;
    await callJSON(RewriteSchema, "test", "test", 3000, 0, retryMeter, AbortSignal.timeout(2000),
      { articleId: 123, stage: "rewrite", onTrace: (event) => retryTrace.push(event) });
    assert.equal(gatewayAttempts - beforeRetry, 2);
    assert.equal(retryMeter.retries, 1);
    assert.equal(retryTrace[0].httpStatus, 504);
    assert.equal(retryTrace[1].finishReason, "stop");
    assert.ok(retryTrace.every((event) => event.articleId === 123 && event.stage === "rewrite"));
    assert.ok(!JSON.stringify(retryTrace).includes("가공 제목"), "trace must not contain generated text");
    const literalBody = '첫 줄\n둘째 줄\t탭 "인용"과 \\경로';
    rawOverride = JSON.stringify({ title: "제목", summary: "요약", paragraphs: [literalBody] })
      .replace("\\n", "\n").replace("\\t", "\t");
    const controlsMeter = newMeter();
    const controls = await callJSON(RewriteSchema, "test", "test", 3000, 0, controlsMeter);
    assert.equal(controls.paragraphs[0], literalBody, "normalize literal controls without changing text or escapes");
    assert.equal(controlsMeter.calls, 1, "literal controls must not trigger a paid repair");
    rawOverride = '{"title":"제목","summary":"요약","paragraphs":["잘린 본문';
    await assert.rejects(callJSON(RewriteSchema, "test", "test", 3000, 0, newMeter()), /JSON 파싱 실패/);
    rawOverride = undefined;
    gatewayFailures = 3;
    const beforeFailure = gatewayAttempts;
    await assert.rejects(callJSON(RewriteSchema, "test", "test", 3000, 0, newMeter(), AbortSignal.timeout(2000)), /504/);
    assert.equal(gatewayAttempts - beforeFailure, 2, "retry at most once");
    gatewayFailures = 1;
    const beforeAbort = gatewayAttempts;
    await assert.rejects(callJSON(RewriteSchema, "test", "test", 3000, 0, newMeter(), AbortSignal.timeout(10)));
    assert.equal(gatewayAttempts - beforeAbort, 1, "do not retry after the article deadline");
    gatewayStatus = 401;
    gatewayFailures = 1;
    const beforeAuthFailure = gatewayAttempts;
    await assert.rejects(callJSON(RewriteSchema, "test", "test", 3000, 0, newMeter()), /401/);
    assert.equal(gatewayAttempts - beforeAuthFailure, 1, "do not retry configuration errors");
    gatewayFailures = 0;
    hang = true;
    await assert.rejects(processArticleLevels({ title: "Test", text: "test" }, newMeter(), AbortSignal.timeout(10)));
    assert.equal(active, 0, "aborted work must finish before returning");
    peak = 0;
    const beforeQueuedAbort = gatewayAttempts;
    const queuedSignal = AbortSignal.timeout(30);
    const queued = await Promise.allSettled(Array.from({ length: 12 }, () =>
      callJSON(RewriteSchema, "test", "test", 3000, 0, newMeter(), queuedSignal)));
    assert.ok(queued.every((result) => result.status === "rejected"));
    assert.equal(gatewayAttempts - beforeQueuedAbort, 6, "queued calls must cancel without reaching the gateway");
    assert.equal(peak, 6, "all articles share the LLM request limit");
    assert.equal(active, 0);
    hang = false;

    invalidHighlights = true;
    const metadataMeter = newMeter();
    const metadataVariants = await processArticleLevels({ title: "Test", text: "원문" }, metadataMeter, AbortSignal.timeout(2000));
    assert.equal(metadataMeter.calls, 9, "invalid optional highlights must not regenerate the article");
    assert.ok(metadataVariants.every((variant) => !variant.content_html.includes("ac-key")));
    invalidHighlights = false;
    brokenLengthRetry = true;
    const fallbackTrace: TraceEvent[] = [];
    const fallback = await processArticle({ title: "Test", text: "원문".repeat(1000) }, 1,
      newMeter(), AbortSignal.timeout(2000), { onTrace: (event) => fallbackTrace.push(event) });
    assert.equal(fallback.title, "검증된 초안");
    assert.equal(fallback.quiz.length, 4);
    assert.ok(fallbackTrace.some((event) => event.fallback === true));
    brokenLengthRetry = false;

    const { NextRequest } = await import("next/server");
    const { GET } = await import("../app/api/cron/ingest/[category]/route.api");
    const denied = await GET(new NextRequest("https://app.invalid/api/cron/ingest/cloud"), { params: Promise.resolve({ category: "cloud" }) });
    assert.equal(denied.status, 401);
    const response = await GET(new NextRequest("https://app.invalid/api/cron/ingest/cloud", {
      headers: { authorization: "Bearer test-cron" },
    }), { params: Promise.resolve({ category: "cloud" }) });
    assert.equal(response.status, 200);
    const summary = await response.json();
    assert.equal(summary.articleCap, 4);
    assert.equal(summary.llmConcurrency, 6);
    assert.equal(summary.articleStartSeconds, 110);
    assert.equal(summary.articleTimeoutSeconds, 240);
    assert.equal(summary.processed, 4);
    assert.equal(summary.stoppedBy, "cap");
    assert.equal(summary.queueDepth, 80, "queue size must not be the scan limit");
    assert.equal(summary.scanned, 8);
    assert.equal(summary.extractFailed, 1);
    assert.equal(summary.retryLater, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.skippedSource, 1);
    assert.ok(summary.usage.calls > 36, "failed generations must count toward usage");
    assert.ok(peak >= 3 && peak <= 6, "LLM concurrency must stay bounded across both articles");
    assert.equal(active, 0);
    assert.equal(writes.filter((w) => w.table === "article_variants" && w.method === "POST").length, 12);
    const ready = writes.filter((w) => w.table === "articles" && (w.body as { status?: string }).status === "ready");
    assert.equal(ready.length, 4);
    assert.ok(ready.some((w) => w.query.includes("id=eq.4")), "failed source must allow another candidate");
    assert.ok(!ready.some((w) => w.query.includes("id=eq.3")), "failed article must never become ready");

    // Raising the cap must not weaken the 300-second function guard.
    simulateSlowArticles = true;
    Date.now = () => originalNow() + elapsedOffset;
    const slowResponse = await GET(new NextRequest("https://app.invalid/api/cron/ingest/cloud", {
      headers: { authorization: "Bearer test-cron" },
    }), { params: Promise.resolve({ category: "cloud" }) });
    const slowSummary = await slowResponse.json();
    assert.equal(slowSummary.articleCap, 4);
    assert.equal(slowSummary.processed, 2);
    assert.equal(slowSummary.stoppedBy, "time");
    assert.equal(active, 0);
    const { refreshDomainTerms } = await import("../lib/terms");
    const { createAdminClient } = await import("../lib/supabase/admin");
    termReadFailure = true;
    const beforeTermFailure = writes.length;
    await assert.rejects(refreshDomainTerms(createAdminClient(), 1), /term read failed/);
    assert.equal(writes.length, beforeTermFailure, "failed term reads must not delete existing terms");
    termReadFailure = false;
    console.log("ingest: extraction, cancellation, 4-article cap, source limit, usage and persistence checks passed");
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
