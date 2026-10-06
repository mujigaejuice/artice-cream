import { NextResponse, type NextRequest } from "next/server";

import {
  CONTENT_MODEL,
  estimateCost,
  newMeter,
  processArticleLevels,
  type UsageMeter,
} from "@/lib/ai/pipeline";
import { CATEGORY_SLUGS, type CategorySlug } from "@/lib/ai/schemas";
import { LLM_CONCURRENCY } from "@/lib/ai/request-limit";
import { extractArticle } from "@/lib/news/extract";
import { SOURCES } from "@/lib/news/feeds";
import { authorizeCron, startDeadline } from "@/lib/news/ingest";
import { ARTICLE_CONCURRENCY, ARTICLE_START_SECONDS, ARTICLE_TIMEOUT_SECONDS,
  articleTimeoutMs, processQueue } from "@/lib/news/process-queue";
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

/**
 * 아티클 하나를 시작하려면 최소 이만큼은 남아 있어야 한다.
 *
 * 시작 기준은 110초지만 실측에서 125초를 넘기는 기사도 있다. 진행 중 작업은 실행의
 * 남은 시간 안에서 최대 240초까지 허용한다. 최대 두 편, LLM 요청은 최대 6개 병렬이다.
 */
const SECONDS_PER_ARTICLE = ARTICLE_START_SECONDS;

/** 대기열에서 한 번에 훑어볼 후보 수. 소스가 겹쳐 건너뛰는 몫까지 보려면 넉넉해야 한다. */
const QUEUE_SCAN = 40;

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
  const runId = crypto.randomUUID();
  const configured = { runId, category, articleCap: ARTICLES_PER_CATEGORY,
    articleConcurrency: ARTICLE_CONCURRENCY, llmConcurrency: LLM_CONCURRENCY,
    articleStartSeconds: ARTICLE_START_SECONDS,
    articleTimeoutSeconds: ARTICLE_TIMEOUT_SECONDS, model: CONTENT_MODEL };
  console.log("[ingest:process:start]", JSON.stringify(configured));

  const { data: domain, error: domainError } = await admin
    .from("domains")
    .select("*")
    .eq("slug", category)
    .eq("active", true)
    .maybeSingle();

  if (domainError) return NextResponse.json({ error: domainError.message }, { status: 500 });
  if (!domain) {
    return NextResponse.json({ error: `domains 시드에 없는 분류 ${category}` }, { status: 404 });
  }

  const { data: queue, error, count } = await admin
    .from("articles")
    .select("id, source, source_url, title, published_at", { count: "exact" })
    .eq("domain_id", (domain as DomainRow).id)
    .eq("status", "pending")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(QUEUE_SCAN);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pending = (queue ?? []) as Pick<
    ArticleRow,
    "id" | "source" | "source_url" | "title" | "published_at"
  >[];

  const meter = newMeter();
  let extractFailed = 0;
  let retryLater = 0;
  let failed = 0;
  const failures: Record<string, unknown>[] = [];
  const { processed, skippedSource, stoppedBy } = await processQueue(pending, {
    cap: ARTICLES_PER_CATEGORY,
    concurrency: ARTICLE_CONCURRENCY,
    canStart: () => {
      if (estimateCost(meter) >= INGEST_BUDGET_PER_CATEGORY_USD) return "budget";
      if (clock.remainingSeconds() < SECONDS_PER_ARTICLE) return "time";
      return null;
    },
    process: async (row) => {
      const articleStartedAt = Date.now();
      const articleSignal = AbortSignal.timeout(articleTimeoutMs(clock.remainingSeconds()));
      const articleLog = { runId, category, articleId: row.id, source: row.source, url: row.source_url };
      console.log("[ingest:article:start]", JSON.stringify(articleLog));

      const kind = KIND_BY_SOURCE.get(row.source ?? "") ?? "news";
      const extracted = await extractArticle(
        { url: row.source_url, title: row.title ?? "" },
        kind,
        articleSignal,
      );

      if (!extracted.ok) {
        const failure = { ...articleLog, stage: "extract", reason: extracted.reason,
          retryable: extracted.retryable, httpStatus: extracted.httpStatus, charCount: extracted.charCount,
          seconds: (Date.now() - articleStartedAt) / 1000 };
        failures.push(failure);
        console.warn("[ingest:article:failed]", JSON.stringify(failure));
        if (extracted.retryable) {
          // pending으로 두면 내일 다시 온다. 영영 안 열리면 대기열 TTL이 걷어낸다.
          retryLater += 1;
          return false;
        }
        extractFailed += 1;
        const { error: statusError } = await admin
          .from("articles")
          .update({ status: extracted.reason === "paywalled" ? "paywalled" : "extract_failed" })
          .eq("id", row.id)
          .abortSignal(articleSignal);
        if (statusError) {
          failed += 1;
          failures.push({ ...articleLog, stage: "status", error: statusError.message });
        }
        return false;
      }

      try {
        await buildArticle(admin, row.id, extracted, meter, articleSignal, runId);
        console.log("[ingest:article:ready]", JSON.stringify({ ...articleLog,
          seconds: (Date.now() - articleStartedAt) / 1000 }));
        return true;
      } catch (cause) {
        failed += 1;
        const failure = { ...articleLog, stage: "build", timedOut: articleSignal.aborted,
          error: cause instanceof Error ? cause.message : String(cause),
          seconds: (Date.now() - articleStartedAt) / 1000 };
        failures.push(failure);
        console.error("[ingest:article:failed]", JSON.stringify(failure));
        return false;
      }
    },
  });

  // 정책.md §15 — 새로 쌓인 glossary를 온보딩 용어 체크 목록에 반영한다.
  if (processed > 0) {
    try {
      await refreshDomainTerms(admin, (domain as DomainRow).id,
        AbortSignal.timeout(Math.max(1, Math.min(15, clock.remainingSeconds()) * 1000)));
    } catch (cause) {
      console.error(`[ingest] ${category} 용어 집계 실패`, cause);
    }
  }

  const summary = {
    ok: true,
    stage: "process" as const,
    category: category as CategorySlug,
    runId,
    articleCap: ARTICLES_PER_CATEGORY,
    articleConcurrency: ARTICLE_CONCURRENCY,
    llmConcurrency: LLM_CONCURRENCY,
    articleStartSeconds: ARTICLE_START_SECONDS,
    articleTimeoutSeconds: ARTICLE_TIMEOUT_SECONDS,
    model: CONTENT_MODEL,
    seconds: clock.elapsedSeconds(),
    stoppedBy,
    queueDepth: count ?? pending.length,
    scanned: pending.length,
    skippedSource,
    processed,
    extractFailed,
    retryLater,
    failed,
    failures,
    usage: meter,
    estimatedCostUsd: Number(estimateCost(meter).toFixed(4)),
    costPerVariantUsd: Number(
      (estimateCost(meter) / Math.max(1, processed * 3)).toFixed(4),
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
  meter: UsageMeter,
  signal: AbortSignal,
  runId: string,
): Promise<void> {
  // 실패한 호출까지 같은 meter에 쌓아 예산·사용량에서 빠지지 않게 한다.
  const variants = await processArticleLevels(
    { title: extracted.title, text: extracted.text }, meter, signal, { articleId, runId },
  );
  signal.throwIfAborted();

  const { error: deleteError } = await admin.from("article_variants").delete()
    .eq("article_id", articleId).abortSignal(signal);
  if (deleteError) throw new Error(`variant cleanup: ${deleteError.message}`);

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
        model: CONTENT_MODEL,
      })
      .select("id")
      .abortSignal(signal).single();

    if (variantError) throw new Error(`variant level ${variant.level}: ${variantError.message}`);

    const { error: quizError } = await admin.from("quiz_questions").insert(
      variant.quiz.map((q, position) => ({
        variant_id: row.id,
        position,
        prompt: q.prompt,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
      })),
    ).abortSignal(signal);

    if (quizError) throw new Error(`quiz level ${variant.level}: ${quizError.message}`);
  }

  const { error: articleError } = await admin
    .from("articles")
    .update({
      title: extracted.title,
      image_url: extracted.imageUrl,
      original_text: extracted.text,
      status: "ready",
    })
    .eq("id", articleId).abortSignal(signal);

  if (articleError) throw new Error(`article ready: ${articleError.message}`);
}
