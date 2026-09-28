import { NextResponse, type NextRequest } from "next/server";

import {
  addMeter,
  estimateCost,
  newMeter,
  processArticle,
  type UsageMeter,
} from "@/lib/ai/pipeline";
import { CATEGORY_SLUGS, type CategorySlug, type Level } from "@/lib/ai/schemas";
import { extractArticle, type ExtractFailure } from "@/lib/news/extract";
import { SOURCES } from "@/lib/news/feeds";
import { authorizeCron, startDeadline } from "@/lib/news/ingest";
import { ARTICLES_PER_CATEGORY, INGEST_BUDGET_PER_CATEGORY_USD } from "@/lib/policy";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ArticleRow, DomainRow } from "@/lib/supabase/types";
import { refreshDomainTerms } from "@/lib/terms";

/**
 * 인제스트 2단계 — 분류 하나를 가공한다 (소스분류.md §3).
 *
 *   articles(pending) ─▶ 본문 추출 ─▶ LLM ×3수준 ─▶ article_variants + quiz ─▶ ready
 *
 * 1단계(`/api/cron/ingest`)가 채워 둔 대기열에서 꺼내 쓴다. 분류마다 cron이 따로
 * 걸려 있고, 한 번에 ARTICLES_PER_CATEGORY편만 가공한다. 왜 쪼갰는지는
 * lib/news/ingest.ts 머리말에.
 *
 * 실패 정책: 한 건이 조각을 멈추면 안 된다. 건별 실패는 세어서 로그로 남기고 넘어간다.
 * 예산이나 시간이 모자라면 아티클을 시작하기 전에 멈춘다. 중간에 끊으면 읽을 수 없는
 * 반쪽 아티클이 남기 때문이다.
 */

export const maxDuration = 300; // Hobby 상한. lib/news/ingest.ts의 INGEST_MAX_SECONDS와 함께 움직인다.
export const dynamic = "force-dynamic";

const LEVELS: Level[] = [1, 2, 3];
const MODEL = process.env.LLM_MODEL ?? "claude-haiku-4-5";

/**
 * 아티클 하나를 시작하려면 최소 이만큼은 남아 있어야 한다.
 *
 * 2026-09-21 실측으로 variant 하나가 17초였다. 3수준이면 51초, 본문 추출과 길이
 * 재요청까지 보면 그 두 배를 잡아 둔다. 모자라면 시작하지 않고 다음 런에 넘긴다.
 */
const SECONDS_PER_ARTICLE = 110;

/** 대기열에서 한 번에 훑어볼 후보 수. 소스가 겹쳐 건너뛰는 몫까지 보려면 넉넉해야 한다. */
const QUEUE_SCAN = 40;

/** 추출 실패 중 다시 시도할 가치가 있는 것. 429·타임아웃이 여기 걸린다. */
const TRANSIENT: ExtractFailure[] = ["fetch-failed"];

const KIND_BY_SOURCE = new Map(SOURCES.map((s) => [s.id, s.kind]));

type Params = { params: Promise<{ category: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { category } = await params;
  if (!(CATEGORY_SLUGS as readonly string[]).includes(category)) {
    return NextResponse.json({ error: `unknown category ${category}` }, { status: 404 });
  }

  const startedAt = Date.now();
  const clock = startDeadline(startedAt);
  const admin = createAdminClient();

  const { data: domain } = await admin
    .from("domains")
    .select("*")
    .eq("slug", category)
    .eq("active", true)
    .maybeSingle();

  if (!domain) {
    return NextResponse.json({ error: `domains 시드에 없는 분류 ${category}` }, { status: 404 });
  }

  const { data: queue, error } = await admin
    .from("articles")
    .select("id, source, source_url, title, published_at")
    .eq("domain_id", (domain as DomainRow).id)
    .eq("status", "pending")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(QUEUE_SCAN);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pending = (queue ?? []) as Pick<
    ArticleRow,
    "id" | "source" | "source_url" | "title" | "published_at"
  >[];

  let meter = newMeter();
  const usedSources = new Set<string>();
  let processed = 0;
  let extractFailed = 0;
  let retryLater = 0;
  let failed = 0;
  let stoppedBy: "done" | "cap" | "time" | "budget" = "done";

  for (const row of pending) {
    if (processed >= ARTICLES_PER_CATEGORY) {
      stoppedBy = "cap";
      break;
    }
    if (estimateCost(meter) >= INGEST_BUDGET_PER_CATEGORY_USD) {
      stoppedBy = "budget";
      break;
    }
    if (clock.remainingSeconds() < SECONDS_PER_ARTICLE) {
      stoppedBy = "time";
      break;
    }
    // 소스당 1편까지. 한 발행처가 분류를 채우면 읽는 맛이 없다(소스분류.md §3).
    if (row.source && usedSources.has(row.source)) continue;

    const kind = KIND_BY_SOURCE.get(row.source ?? "") ?? "news";
    const extracted = await extractArticle(
      { url: row.source_url, title: row.title ?? "" },
      kind,
    );

    if (!extracted.ok) {
      if (TRANSIENT.includes(extracted.reason)) {
        // pending으로 두면 내일 다시 온다. 영영 안 열리면 대기열 TTL이 걷어낸다.
        retryLater += 1;
        console.warn(`[ingest] retry later ${extracted.reason} ${row.source_url}`);
        continue;
      }
      extractFailed += 1;
      await admin
        .from("articles")
        .update({ status: extracted.reason === "paywalled" ? "paywalled" : "extract_failed" })
        .eq("id", row.id);
      console.warn(`[ingest] skip ${extracted.reason} ${row.source_url}`);
      continue;
    }

    // 추출이 된 뒤에 소스를 쓴 것으로 친다. 열리지도 않은 글로 그 발행처의
    // 오늘 자리를 태우면, 같은 소스의 다음 글이 후보에서 빠진다.
    if (row.source) usedSources.add(row.source);

    try {
      meter = addMeter(meter, await buildArticle(admin, row.id, extracted));
      processed += 1;
    } catch (cause) {
      failed += 1;
      console.error(`[ingest] ${category} 가공 실패 ${extracted.url}`, cause);
    }
  }

  // 정책.md §15 — 새로 쌓인 glossary를 온보딩 용어 체크 목록에 반영한다.
  if (processed > 0) {
    try {
      await refreshDomainTerms(admin, (domain as DomainRow).id);
    } catch (cause) {
      console.error(`[ingest] ${category} 용어 집계 실패`, cause);
    }
  }

  const summary = {
    ok: true,
    stage: "process" as const,
    category: category as CategorySlug,
    seconds: clock.elapsedSeconds(),
    stoppedBy,
    queueDepth: pending.length,
    processed,
    extractFailed,
    retryLater,
    failed,
    usage: meter,
    estimatedCostUsd: Number(estimateCost(meter).toFixed(4)),
    costPerVariantUsd: Number(
      (estimateCost(meter) / Math.max(1, processed * LEVELS.length)).toFixed(4),
    ),
  };

  console.log("[ingest:process]", JSON.stringify(summary));
  return NextResponse.json(summary);
}

type Extracted = Extract<Awaited<ReturnType<typeof extractArticle>>, { ok: true }>;

/**
 * 대기 중인 아티클 한 건을 3수준 전부 가공해 저장한다.
 *
 * LLM을 먼저 다 돌리고 나서 쓰고, `ready`로 바꾸는 것은 맨 마지막이다. 순서가
 * 반대면 거부나 스키마 실패가 읽을 수 없는 아티클을 홈에 올린다. 중간에 끊긴
 * 앞선 런이 남겼을 수 있는 variant는 먼저 지운다 — `unique (article_id, level)`에
 * 걸려 재시도가 영원히 실패하기 때문이다.
 */
async function buildArticle(
  admin: ReturnType<typeof createAdminClient>,
  articleId: number,
  extracted: Extracted,
): Promise<UsageMeter> {
  const meter = newMeter();
  const variants = [];

  for (const level of LEVELS) {
    variants.push(
      await processArticle({ title: extracted.title, text: extracted.text }, level, meter),
    );
  }

  await admin.from("article_variants").delete().eq("article_id", articleId);

  for (const variant of variants) {
    const { data: row, error: variantError } = await admin
      .from("article_variants")
      .insert({
        article_id: articleId,
        level: variant.level,
        title: variant.title,
        summary: variant.summary,
        content_html: variant.content_html,
        glossary: variant.glossary,
        reading_minutes: variant.reading_minutes,
        model: MODEL,
      })
      .select("id")
      .single();

    if (variantError) throw variantError;

    const { error: quizError } = await admin.from("quiz_questions").insert(
      variant.quiz.map((q, position) => ({
        variant_id: row.id,
        position,
        prompt: q.prompt,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
      })),
    );

    if (quizError) throw quizError;
  }

  const { error: articleError } = await admin
    .from("articles")
    .update({
      title: extracted.title,
      image_url: extracted.imageUrl,
      original_text: extracted.text,
      status: "ready",
    })
    .eq("id", articleId);

  if (articleError) throw articleError;

  return meter;
}
