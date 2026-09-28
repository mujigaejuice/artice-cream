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

/**
 * 인제스트 1단계 — 수집과 분류 (소스분류.md §3).
 *
 *   피드 41개(최근 14일) ─┐
 *                        ├─▶ source_url 중복 제거 ─▶ 분류(LLM) ─▶ articles
 *   아카이브 5곳(무작위) ─┘                                      pending | rejected
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
  const clock = startDeadline(startedAt);
  const admin = createAdminClient();

  const { data: domains, error } = await admin.from("domains").select("*").eq("active", true);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const domainBySlug = new Map(((domains ?? []) as DomainRow[]).map((d) => [d.slug, d]));

  /* ── 1) 소스에서 후보 수집 — 동시에 여러 개를 연다 ───────────── */

  const sources = feedSources(SOURCES);
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

  const candidates = deduped.filter(({ item }) => !known.has(item.url));

  /* ── 3) 분류 — CLASSIFY_BATCH_SIZE건씩 ──────────────────────── */

  const meter = newMeter();
  const labelled: (Candidate & { category: CategorySlug | "reject" })[] = [];
  let classifyFailed = 0;
  let ranOutOfTime = false;

  for (const batch of chunk(candidates, CLASSIFY_BATCH_SIZE)) {
    if (clock.expired()) {
      ranOutOfTime = true;
      break;
    }
    try {
      const results = await classifyCandidates(
        batch.map(({ item }) => ({
          source: item.sourceId,
          title: item.title,
          summary: item.summary.slice(0, 300),
        })),
        meter,
      );
      for (const r of results) {
        const c = batch[r.i];
        if (c) labelled.push({ ...c, category: r.category });
      }
    } catch (cause) {
      classifyFailed += batch.length;
      console.error("[ingest] 분류 실패", cause);
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
    const { data: inserted, error: writeError } = await admin
      .from("articles")
      .upsert(part, { onConflict: "source_url", ignoreDuplicates: true })
      .select("id");
    if (writeError) console.error("[ingest] 후보 저장 실패", writeError);
    else queued += inserted?.length ?? 0;
  }

  /* ── 5) 오래 묵은 대기열은 잘라낸다 ─────────────────────────── */

  const cutoff = new Date(Date.now() - PENDING_TTL_DAYS * 86_400_000).toISOString();
  const { count: expired } = await admin
    .from("articles")
    .update({ status: "expired" }, { count: "exact" })
    .eq("status", "pending")
    .lt("fetched_at", cutoff);

  /* ── 6) 요약 ───────────────────────────────────────────────── */

  const byCategory: Record<string, number> = {};
  for (const c of labelled) byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;

  const summary = {
    ok: true,
    stage: "collect" as const,
    seconds: clock.elapsedSeconds(),
    ranOutOfTime,
    feedItems: raw.length,
    afterDedupe: deduped.length,
    alreadyKnown: deduped.length - candidates.length,
    classified: labelled.length,
    classifyFailed,
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
  return NextResponse.json(summary);
}
