/** ingest_runs logging: real routes with fake publisher, LLM and PostgREST. Never connects to a database. */
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

async function main() {
  Object.assign(process.env, {
    BASE_URL: "https://runs-llm.invalid", API_KEY: "runs-secret-key", MODEL_ID: "test-model",
    LLM_MODEL: "test-model", INGEST_ARTICLES_PER_DOMAIN: "4", INGEST_MAX_SECONDS: "300",
    NEXT_PUBLIC_SUPABASE_URL: "https://runs-db.invalid", SUPABASE_SERVICE_ROLE_KEY: "runs-service-key",
    CRON_SECRET: "runs-cron",
  });
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const reviewedAt = new Date(Date.now() - 60_000).toISOString();
  const attribution = { author: "Test Author", originalTitle: "Test original", licenseLabel: "test permission",
    licenseUrl: "https://publisher.invalid/license", changes: "Test adaptation", notices: "" };
  const rightsRows = ["aws-news", "cloudflare"].map((source) => ({ source, rights_status: "permitted",
    evidence_url: "https://publisher.invalid/license", reviewed_at: reviewedAt, expires_at: null,
    allow_collect: false, allow_process: true, allow_publish: true }));
  const article = (id: number, source: string) => ({ id, source, source_url: `https://publisher.invalid/${id}`,
    title: `Article ${id}`, published_at: null, status: "pending", rights_status: "permitted",
    rights_evidence_url: "https://publisher.invalid/license", rights_reviewed_at: reviewedAt,
    rights_expires_at: null, rights_attribution: attribution });
  const BODY_MARKER = "BODYMARKER 원문 문장";
  const html = (id: number) => `<html><head><title>Article ${id}</title></head><body><article><h1>Test</h1><p>${`${BODY_MARKER} 기술 본문 설명입니다. `.repeat(100)}</p></article></body></html>`;

  let queue: ReturnType<typeof article>[] = [];
  let queueMode: "normal" | "malformed" = "normal";
  let domainsError = false;
  let gatewayStatus = 200;
  let insertMode: "ok" | "error" | "throw" | "hang" = "ok";
  let insertAttempts = 0;
  const runLogs: Record<string, any>[] = [];
  const errors: string[] = [];
  console.error = (...args: unknown[]) => { errors.push(args.map(String).join(" ")); };

  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const signal = init?.signal ?? undefined;
    signal?.throwIfAborted();
    if (url.origin === "https://publisher.invalid") {
      const id = Number(url.pathname.slice(1));
      if (id >= 400) return new Response(null, { status: 404 });
      return new Response(html(id), { headers: { "content-type": "text/html" } });
    }
    if (url.origin === "https://runs-llm.invalid") {
      if (gatewayStatus !== 200) return Response.json({ error: "PROVIDER_SECRET_DETAIL" }, { status: gatewayStatus });
      const body = JSON.parse(String(init?.body));
      const prompt = body.messages[1].content as string;
      const level = Number(prompt.match(/대상 수준: ([123])/)?.[1] ?? 1);
      const content = body.max_tokens === 3000
        ? { title: "GENERATED_TITLE", summary: "요약", paragraphs: ["가".repeat([0, 600, 1000, 1500][level])], keyParagraphs: [0] }
        : body.max_tokens === 1500 ? { terms: [] } : { questions: Array.from({ length: 4 }, (_, i) => ({
          prompt: `문제 ${i}`, options: ["가", "나", "다", "라"], correct_index: 0, explanation: "설명" })) };
      return Response.json({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 20 } });
    }
    assert.equal(url.origin, "https://runs-db.invalid", "unexpected network request");
    const table = url.pathname.split("/").pop()!;
    const method = init?.method ?? "GET";
    if (table === "ingest_runs") {
      assert.equal(method, "POST", "run logging only inserts");
      insertAttempts++;
      if (insertMode === "throw") throw new TypeError("fetch failed");
      if (insertMode === "hang") { await delay(60_000, undefined, { signal }); }
      if (insertMode === "error") return Response.json({ message: "relation does not exist", code: "42P01" }, { status: 404 });
      runLogs.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 201 });
    }
    if (method === "GET") {
      if (table === "domains") return domainsError
        ? Response.json({ message: "domains unavailable" }, { status: 500 })
        : Response.json([{ id: 1, slug: "cloud", active: true }]);
      if (table === "content_source_rights") return Response.json(rightsRows);
      if (table === "articles") {
        const id = url.searchParams.get("id");
        if (id) return Response.json(queue.find((row) => `eq.${row.id}` === id) ?? null);
        if (queueMode === "malformed") return Response.json({ unexpected: true });
        return Response.json(queue, { headers: { "content-range": `0-${Math.max(0, queue.length - 1)}/${queue.length}` } });
      }
      return Response.json([]);
    }
    if (table === "article_variants" && method === "POST") return Response.json({ id: 1 });
    return new Response(null, { status: 204 });
  };

  try {
    const { NextRequest } = await import("next/server");
    const { GET: processRoute } = await import("../app/api/cron/ingest/[category]/route.api");
    const { GET: collectRoute } = await import("../app/api/cron/ingest/route.api");
    const { buildIngestRunRow, writeIngestRun, recordIngestRun, runRates, safeError } =
      await import("../lib/news/ingest-runs");
    const call = (category = "cloud", token = "runs-cron") => processRoute(
      new NextRequest(`https://app.invalid/api/cron/ingest/${category}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }),
      { params: Promise.resolve({ category }) });
    const lastRun = () => runLogs[runLogs.length - 1];
    const assertPrivate = (row: unknown) => {
      const text = JSON.stringify(row);
      for (const secret of ["BODYMARKER", "GENERATED_TITLE", "PROVIDER_SECRET_DETAIL", "runs-secret-key",
        "runs-service-key", "runs-cron", "대상 수준"]) assert.ok(!text.includes(secret), `row must not contain ${secret}`);
    };

    // Unauthorized and unknown-category requests never write.
    assert.equal((await call("cloud", "")).status, 401);
    assert.equal((await call("nope")).status, 404);
    assert.equal(insertAttempts, 0, "rejected requests are not logged");

    // 1) Success.
    queue = [article(10, "aws-news")];
    let response = await call();
    assert.equal(response.status, 200);
    let summary = await response.json();
    assert.equal(summary.processed, 1);
    assert.equal(summary.extracted, 1);
    assert.equal(runLogs.length, 1, "exactly one row per run");
    let row = lastRun();
    assert.equal(row.run_id, summary.runId, "row and response share the run id");
    assert.equal(row.route, "process"); assert.equal(row.category, "cloud");
    assert.equal(row.status, "ok"); assert.equal(row.http_status, 200);
    assert.equal(row.processed, 1); assert.equal(row.extracted, 1); assert.equal(row.failed, 0);
    assert.equal(row.stopped_by, "done");
    assert.equal(row.llm_calls, summary.usage.calls); assert.ok(row.llm_calls > 0);
    assert.equal(row.http_retries, 0);
    assert.equal(row.error, null);
    assert.ok(row.duration_ms >= 0 && Date.parse(row.finished_at) >= Date.parse(row.started_at));
    assert.equal(row.details.queueDepth, 1);
    assertPrivate(row);

    // 2) Partial: one article ready, one gone (404).
    queue = [article(11, "aws-news"), article(404, "cloudflare")];
    summary = await (await call()).json();
    row = lastRun();
    assert.equal(summary.processed, 1); assert.equal(summary.extractFailed, 1);
    assert.equal(row.status, "partial"); assert.equal(row.processed, 1); assert.equal(row.failed, 1);
    assert.match(row.error, /extract:http-error http=404 ×1/);
    assert.deepEqual(row.details.failures.map((f: any) => [f.articleId, f.stage]), [[404, "extract"]]);
    assertPrivate(row);

    // 3) Everything failed: provider error with a body that must not be stored.
    gatewayStatus = 500;
    queue = [article(12, "aws-news")];
    summary = await (await call()).json();
    row = lastRun();
    assert.equal(summary.processed, 0); assert.equal(summary.failed, 1);
    assert.ok(JSON.stringify(summary.failures).includes("PROVIDER_SECRET_DETAIL"), "fixture reaches the response");
    assert.equal(row.status, "failed"); assert.equal(row.failed, 1);
    assert.match(row.error, /build:/); assert.match(row.details.failures[0].error, /LLM gateway 500$/);
    assertPrivate(row);
    gatewayStatus = 200;

    // 4) Error response before processing.
    domainsError = true;
    response = await call();
    assert.equal(response.status, 500);
    row = lastRun();
    assert.equal(row.status, "failed"); assert.equal(row.http_status, 500);
    assert.equal(row.error, "domains unavailable"); assert.equal(row.processed, null);
    domainsError = false;

    // 5) Thrown failure: recorded, then rethrown unchanged.
    queueMode = "malformed";
    const before = runLogs.length;
    await assert.rejects(call(), TypeError);
    assert.equal(runLogs.length, before + 1, "thrown runs are still logged");
    row = lastRun();
    assert.equal(row.status, "failed"); assert.match(row.error, /^thrown TypeError: /);
    assert.equal(row.http_status, null);
    queueMode = "normal";

    // 6) A failing log insert never changes the cron response.
    queue = [article(13, "aws-news")];
    for (const mode of ["error", "throw"] as const) {
      insertMode = mode;
      const attempts: number = insertAttempts, logged: number = runLogs.length;
      response = await call();
      assert.equal(response.status, 200, `${mode} insert must not break the cron`);
      summary = await response.json();
      assert.equal(summary.processed, 1);
      assert.equal(insertAttempts, attempts + 1); assert.equal(runLogs.length, logged);
      assert.ok(errors.some((e) => e.includes("[ingest:run-log] insert failed")), "failure is reported to logs");
    }
    // A hanging insert is cut off by the short timeout.
    insertMode = "hang";
    let startedAt = Date.now();
    response = await call();
    assert.equal(response.status, 200);
    assert.ok(Date.now() - startedAt < 6_000, "hanging insert is bounded by the 3s timeout");
    startedAt = Date.now();
    const sample = buildIngestRunRow({ runId: crypto.randomUUID(), route: "process", category: "cloud" },
      new Date(), new Date(), { httpStatus: 200, body: { stage: "process", processed: 0 } });
    assert.equal(await writeIngestRun(sample, { timeoutMs: 50 }), false);
    assert.ok(Date.now() - startedAt < 1_000);
    insertMode = "ok";
    // Missing service credentials: the cron's own result still wins.
    assert.equal((await recordIngestRun({ runId: crypto.randomUUID(), route: "process", category: "cloud" },
      async () => Response.json({ ok: true }), { client: () => { throw new Error("Missing environment variable"); } })).status, 200);
    await assert.rejects(recordIngestRun({ runId: crypto.randomUUID(), route: "process", category: "cloud" },
      async () => { throw new RangeError("boom"); }), RangeError);
    assert.equal(lastRun().error, "thrown RangeError: boom");

    // 7) Collect route: early rights stop is logged too.
    const rightsBackup = rightsRows.splice(0);
    response = await collectRoute(new NextRequest("https://app.invalid/api/cron/ingest", { headers: { authorization: "Bearer runs-cron" } }));
    summary = await response.json();
    rightsRows.push(...rightsBackup);
    row = lastRun();
    assert.equal(row.route, "collect"); assert.equal(row.category, null);
    assert.equal(row.run_id, summary.runId); assert.equal(row.status, "ok"); assert.equal(row.stopped_by, "rights");

    // 8) Collect summaries: ok / partial / failed mapping and sanitization.
    const meta = { runId: crypto.randomUUID(), route: "collect" as const, category: null };
    const collect = (extra: Record<string, unknown>, httpStatus = 200) => buildIngestRunRow(meta, new Date(0), new Date(1500),
      { httpStatus, body: { stage: "collect", ok: true, discovered: 7, classified: 5, queued: 4, classifyFailed: 0,
        failures: [], usage: { calls: 2, retries: 1, input: 10, output: 5 }, byCategory: { cloud: 4, reject: 1 },
        sources: [{ id: "aws-news", latest: 3, archive: 0 }, { id: "broken", latest: 0, archive: 0, error: "x".repeat(500) }],
        autoReview: { approved: 3, reasons: { "license-missing": 2 } }, ...extra } });
    row = collect({});
    assert.deepEqual([row.status, row.collected, row.classified, row.processed, row.failed, row.llm_calls, row.http_retries, row.duration_ms],
      ["ok", 7, 5, 4, 0, 2, 1, 1500]);
    assert.equal(row.details.sources[1].error.length, 200, "source errors are clipped");
    assert.deepEqual(row.details.autoReview, { approved: 3, reasons: { "license-missing": 2 } });
    row = collect({ ok: false, ranOutOfTime: true, classified: 3, queued: 3 }, 503);
    assert.deepEqual([row.status, row.stopped_by], ["partial", "time"]);
    row = collect({ ok: false, classified: 0, queued: 0, classifyFailed: 20,
      failures: [{ stage: "classify", articleIds: [1, 2], errorType: "TimeoutError", httpStatus: 504, timedOut: true, prompt: "PROMPT" }] }, 503);
    assert.equal(row.status, "failed"); assert.equal(row.failed, 20);
    assert.equal(row.error, "classify:TimeoutError http=504 ×1");
    assert.ok(!JSON.stringify(row).includes("PROMPT"), "only allow-listed failure keys are stored");
    row = buildIngestRunRow({ ...meta, route: "collect-documents" }, new Date(0), new Date(1), { httpStatus: 200,
      body: { ok: true, stage: "documents", documents: { discovered: 1, approved: 1, stoppedBy: "done", reasons: {} } } });
    assert.deepEqual([row.status, row.collected, row.stopped_by], ["ok", 1, "done"]);
    assert.equal(safeError(new Error("LLM gateway 502: <html>secret</html>")), "Error: LLM gateway 502");

    // 9) Report aggregation.
    const now = Date.parse("2026-11-16T12:00:00Z");
    const at = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();
    const rates = runRates([
      { route: "process", category: "cloud", status: "ok", processed: 2, started_at: at(1) },
      { route: "process", category: "cloud", status: "failed", processed: 0, started_at: at(2) },
      { route: "process", category: "cloud", status: "ok", processed: 1, started_at: at(48) },
      { route: "collect", category: null, status: "partial", processed: 9, started_at: at(3) },
    ], new Date(now - 24 * 3_600_000));
    assert.deepEqual(rates.map((r) => [r.key, r.total, r.ok, r.partial, r.failed, r.processed, r.successRate]),
      [["cloud", 2, 1, 0, 1, 2, 0.5], ["collect", 1, 0, 1, 0, 0, 0]]);

    console.error = originalError;
    console.log(`Ingest runs: ${runLogs.length} rows — success/partial/failed/error/thrown runs logged once with the run id, ` +
      "private fields excluded, failing/hanging inserts bounded and never break the cron, collect mapping and rates passed.");
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
