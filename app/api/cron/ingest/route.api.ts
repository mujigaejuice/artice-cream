import { NextResponse, type NextRequest } from "next/server";

import { classifyCandidates, estimateCost, newMeter } from "@/lib/ai/pipeline";
import type { CategorySlug } from "@/lib/ai/schemas";
import { SOURCES, type SourceKind } from "@/lib/news/feeds";
import {
  authorizeCron,
  chunk,
  FEED_CONCURRENCY,
  mapPool,
  PENDING_TTL_DAYS,
  startDeadline,
  URL_FILTER_CHUNK,
} from "@/lib/news/ingest";
import { feedSources, type NewsItem } from "@/lib/news/source";
import { CLASSIFY_BATCH_SIZE } from "@/lib/policy";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DomainRow } from "@/lib/supabase/types";
import { articleAllows, getSourceRights, sourceAllows, type ArticleRights } from "@/lib/content-rights";
import { reviewPendingArticles } from "@/lib/news/review-queue";

/**
 * 인제스트 1단계 — 수집과 분류 (소스분류.md §3).
 *
 *   수집 승인 피드/아카이브 ─▶ 중복 제거 ─▶ 미확인 메타데이터 저장
 *   가공 승인 소스 + 개별 승인 글 ─▶ 분류(LLM) ─▶ pending | rejected
 *
 * 본문 추출도 재작성도 여기서 하지 않는다. 그건 분류별 2단계(`ingest/<분류>`)가
 * 한다 — lib/news/ingest.ts 머리말에 왜 그렇게 쪼갰는지 적어 뒀다.
 *
 * 분류를 통과한 후보는 `status = 'pending'` 행으로 남는다. 이게 2단계의 대기열이고,
 * 동시에 다음 런이 같은 글을 다시 분류하지 않게 하는 표시이기도 하다. 버린 후보를
 * `rejected`로 남기던 기존 방식과 같은 이유다.
 */

export const maxDuration = 300; // Hobby 상한. lib/news/ingest.ts의 INGEST_MAX_SECONDS와 함께 움직인다.
export const dynamic = "force-dynamic";

/** 브로커·줄리아 에반스처럼 아카이브 전체가 피드 하나/사이트맵에 있는 소스는 여러 편을 뽑는다. */
const WIDE_ARCHIVE_SOURCES = new Set(["brooker", "julia-evans"]);

// A stalled provider must leave time to persist completed batches and return diagnostics.
const CLASSIFY_TIMEOUT_MS = 60_000;
const CLASSIFY_FINISH_RESERVE_SECONDS = 15;

type Candidate = { item: NewsItem; kind: SourceKind };

/** 소스 한 곳이 이번 런에 무엇을 내놓았는지. "왜 이 분류가 비었나"는 여기서부터 본다. */
type SourceReport = { id: string; latest: number; archive: number; error?: string };

function pickRandom<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const runId = crypto.randomUUID();
  const clock = startDeadline(startedAt);
  const admin = createAdminClient();
  const rights = await getSourceRights(admin);
  const allowedSources = SOURCES.filter((source) => sourceAllows(rights.get(source.id), "collect"));
  const processingSources = [...rights.values()].filter((source) => sourceAllows(source, "process"))
    .map((source) => ({ id: source.source, kind: SOURCES.find(s => s.id === source.source)?.kind ?? "blog" as const }));
  if (allowedSources.length === 0 && processingSources.length === 0) {
    return NextResponse.json({ ok: true, stage: "collect", stoppedBy: "rights", queued: 0,
      classified: 0, allowedSources: 0, processingSources: 0, blockedSources: SOURCES.length },
    { headers: { "Cache-Control": "no-store" } });
  }

  const { data: domains, error } = await admin.from("domains").select("*").eq("active", true);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const domainBySlug = new Map(((domains ?? []) as DomainRow[]).map((d) => [d.slug, d]));

  /* ── 1) 소스에서 후보 수집 — 동시에 여러 개를 연다 ───────────── */

  const sources = feedSources(allowedSources);
  const collected = await mapPool(sources, FEED_CONCURRENCY, async (src) => {
    const report: SourceReport = { id: src.id, latest: 0, archive: 0 };
    const items: Candidate[] = [];

    try {
      for (const item of await src.fetchLatest()) items.push({ item, kind: src.kind });
      report.latest = items.length;
    } catch (cause) {
      report.error = String(cause).slice(0, 120);
      console.error(`[ingest] ${src.id} feed 실패`, cause);
    }

    if (src.hasArchive) {
      try {
        const archived = await src.fetchArchive();
        const n = WIDE_ARCHIVE_SOURCES.has(src.id) ? 10 : 1;
        for (const item of pickRandom(archived, n)) {
          items.push({ item, kind: src.kind });
          report.archive += 1;
        }
      } catch (cause) {
        report.error = `archive: ${String(cause).slice(0, 100)}`;
        console.error(`[ingest] ${src.id} archive 실패`, cause);
      }
    }

    return { report, items };
  });

  const sourceReports = collected.map((c) => c.report);
  const raw = collected.flatMap((c) => c.items);

  /* ── 2) source_url 중복 제거 — 이번 런 안에서, 그리고 DB에 이미 있는 것과 ── */

  const seen = new Set<string>();
  const deduped = raw.filter(({ item }) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  const known = new Set<string>();
  for (const part of chunk(deduped.map(({ item }) => item.url), URL_FILTER_CHUNK)) {
    const { data, error: lookupError } = await admin
      .from("articles")
      .select("source_url")
      .in("source_url", part);
    // 여기서 조용히 넘어가면 이미 본 글을 다시 분류한다 — 돈이 새므로 남긴다.
    if (lookupError) console.error("[ingest] 중복 조회 실패", lookupError);
    for (const row of data ?? []) known.add(row.source_url as string);
  }

  const fresh = deduped.filter(({ item }) => !known.has(item.url));
  // Store metadata first, then automatically verify source-specific license and attribution.
  // RSS descriptions never enter the LLM before article-level approval.
  for (const part of chunk(fresh, 200)) {
    const { error: discoverError } = await admin.from("articles").upsert(part.map(({ item }) => ({
      source: item.sourceId, source_url: item.url, title: item.title,
      published_at: item.publishedAt?.toISOString() ?? null,
      status: "pending", rights_status: "unreviewed",
    })), { onConflict: "source_url", ignoreDuplicates: true });
    if (discoverError) return NextResponse.json({ error: "discovery_failed" }, { status: 503 });
  }
  let autoReview;
  try {
    autoReview = await reviewPendingArticles(admin, rights, clock);
  } catch (cause) {
    console.error("[ingest:auto-review]", cause);
    return NextResponse.json({ error: "auto_review_unavailable" }, { status: 503 });
  }
  const reviewQuery = processingSources.length ? await admin.from("articles")
    .select("id, source, source_url, title, published_at, status, rights_status, rights_evidence_url, rights_reviewed_at, rights_expires_at, rights_attribution")
    .is("domain_id", null).eq("status", "pending").eq("rights_status", "permitted")
    .in("source", processingSources.map((s) => s.id)).order("id").limit(200) : { data: [], error: null };
  const { data: reviewQueue, error: reviewError } = reviewQuery;
  if (reviewError) return NextResponse.json({ error: "rights_queue_unavailable" }, { status: 503 });
  const candidates: Candidate[] = (reviewQueue ?? []).flatMap((row) => {
    if (!articleAllows(row as ArticleRights, rights, "process")) return [];
    const source = processingSources.find((s) => s.id === row.source);
    if (!source) return [];
    return [{ kind: source.kind, item: { title: row.title ?? "", url: row.source_url,
      sourceId: source.id, sourceName: source.id, summary: "",
      publishedAt: row.published_at ? new Date(row.published_at) : null } }];
  });

  /* ── 3) 분류 — CLASSIFY_BATCH_SIZE건씩 ──────────────────────── */

  const meter = newMeter();
  const labelled: (Candidate & { category: CategorySlug | "reject" })[] = [];
  let classifyFailed = 0;
  let ranOutOfTime = false;
  const failures: { stage: "permissions" | "classify" | "save"; articleIds?: number[];
    errorType?: string; httpStatus?: number; timedOut?: boolean; code?: string }[] = [];

  for (const batch of chunk(candidates, CLASSIFY_BATCH_SIZE)) {
    if (clock.remainingSeconds() <= CLASSIFY_FINISH_RESERVE_SECONDS) {
      ranOutOfTime = true;
      break;
    }
    const latestRights = await getSourceRights(admin);
    const { data: permissions, error: permissionError } = await admin.from("articles")
      .select("source_url, source, status, rights_status, rights_evidence_url, rights_reviewed_at, rights_expires_at, rights_attribution")
      .in("source_url", batch.map(({ item }) => item.url));
    if (permissionError) {
      failures.push({ stage: "permissions", code: permissionError.code });
      break;
    }
    const approvedUrls = new Set((permissions ?? []).filter((row) =>
      articleAllows(row as ArticleRights, latestRights, "process")).map((row) => row.source_url));
    const approvedBatch = batch.filter(({ item }) => approvedUrls.has(item.url));
    if (approvedBatch.length === 0) continue;
    const remainingMs = (clock.remainingSeconds() - CLASSIFY_FINISH_RESERVE_SECONDS) * 1000;
    if (remainingMs <= 0) {
      ranOutOfTime = true;
      break;
    }
    const signal = AbortSignal.timeout(Math.min(CLASSIFY_TIMEOUT_MS, remainingMs));
    let httpStatus: number | undefined;
    const articleIds = (reviewQueue ?? []).filter(row => approvedUrls.has(row.source_url)).map(row => row.id);
    console.log("[ingest:classify:start]", JSON.stringify({ runId, articleIds, count: approvedBatch.length }));
    try {
      const results = await classifyCandidates(
        approvedBatch.map(({ item }) => ({
          source: item.sourceId,
          title: item.title,
          summary: item.summary.slice(0, 300),
        })),
        meter,
        signal,
        { runId, onTrace: event => {
          if (event.event === "call") httpStatus = typeof event.httpStatus === "number" ? event.httpStatus : undefined;
        } },
      );
      for (const r of results) {
        const c = approvedBatch[r.i];
        if (c) labelled.push({ ...c, category: r.category });
      }
    } catch (cause) {
      classifyFailed += approvedBatch.length;
      const failure = { stage: "classify" as const, articleIds, httpStatus, timedOut: signal.aborted,
        errorType: cause instanceof Error ? cause.name : "Error" };
      failures.push(failure);
      // Do not include provider response bodies, prompts or credentials in diagnostics.
      console.error("[ingest:classify:failed]", JSON.stringify({ runId, ...failure }));
      break;
    }
  }

  /* ── 4) 대기열에 넣는다 — 통과는 pending, 버린 것은 rejected ── */

  const rows = labelled.map((c) => ({
    domain_id: c.category === "reject" ? null : (domainBySlug.get(c.category)?.id ?? null),
    source: c.item.sourceId,
    source_url: c.item.url,
    title: c.item.title,
    published_at: c.item.publishedAt?.toISOString() ?? null,
    status: c.category === "reject" ? "rejected" : "pending",
  }));

  const unseeded = new Set(
    labelled
      .filter((c) => c.category !== "reject" && !domainBySlug.has(c.category))
      .map((c) => c.category),
  );
  if (unseeded.size) console.error(`[ingest] domains 시드에 없는 분류 ${[...unseeded].join(", ")}`);

  // ignoreDuplicates라 보낸 수와 들어간 수가 다르다. select로 실제로 들어간 것만 센다.
  let queued = 0;
  for (const part of chunk(rows, 200)) {
    for (const row of part) {
      const { data: updated, error: writeError } = await admin.from("articles")
        .update({ domain_id: row.domain_id, status: row.status })
        .eq("source_url", row.source_url).eq("rights_status", "permitted").select("id");
      if (writeError) {
        failures.push({ stage: "save", code: writeError.code });
        console.error("[ingest] 후보 저장 실패", writeError);
      }
      else queued += updated?.length ?? 0;
    }
  }

  /* ── 5) 오래 묵은 대기열은 잘라낸다 ─────────────────────────── */

  const cutoff = new Date(Date.now() - PENDING_TTL_DAYS * 86_400_000).toISOString();
  // A metadata-only run must not expire the stored processing/review queue.
  const expiration = processingSources.length ? await admin
    .from("articles")
    .update({ status: "expired" }, { count: "exact" })
    .eq("status", "pending").eq("rights_status", "permitted").not("domain_id", "is", null)
    .in("source", processingSources.map((source) => source.id))
    .lt("fetched_at", cutoff).lt("rights_reviewed_at", cutoff) : { count: 0 };
  const expired = expiration.count;
  const awaitingReview = processingSources.length ? await admin.from("articles")
    .select("id", { count: "exact" }).eq("status", "pending").eq("rights_status", "unreviewed")
    .in("source", processingSources.map(source => source.id)).limit(1) : { count: 0, error: null };
  if (awaitingReview.error) console.error("[ingest] review count unavailable", awaitingReview.error);

  /* ── 6) 요약 ───────────────────────────────────────────────── */

  const byCategory: Record<string, number> = {};
  for (const c of labelled) byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;

  const summary = {
    ok: failures.length === 0 && !ranOutOfTime,
    stage: "collect" as const,
    runId,
    seconds: clock.elapsedSeconds(),
    ranOutOfTime,
    feedItems: raw.length,
    afterDedupe: deduped.length,
    alreadyKnown: known.size,
    discovered: fresh.length,
    awaitingRightsReview: awaitingReview.error ? null : awaitingReview.count,
    autoReview,
    allowedSources: allowedSources.length,
    processingSources: processingSources.length,
    blockedSources: SOURCES.length - allowedSources.length,
    classified: labelled.length,
    classificationCandidates: candidates.length,
    classifyFailed,
    failures,
    rejected: labelled.filter((c) => c.category === "reject").length,
    queued,
    expired: expired ?? 0,
    byCategory,
    usage: meter,
    estimatedCostUsd: Number(estimateCost(meter).toFixed(4)),
    // 분류가 빈 이유를 여기서 찾는다. 피드가 안 열린 건지, 열렸는데 글이 없었는지.
    sources: sourceReports,
  };

  console.log("[ingest:collect]", JSON.stringify(summary));
  return NextResponse.json(summary, { status: summary.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" } });
}
