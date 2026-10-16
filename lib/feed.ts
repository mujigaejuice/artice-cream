import type { SupabaseClient } from "@supabase/supabase-js";

import { dayKey, monthRangeUtc } from "./day";
import { clampLevel } from "./level";
import type { DomainRow } from "./supabase/types";
import { ARTICLE_RIGHTS_COLUMNS, articleAllows, getSourceRights, type ArticleRights } from "./content-rights";

/**
 * 홈은 사용자 스코프 클라이언트와 RLS로 조회한다. 콘의 저장 기록 조회는 서버의
 * 인증된 사용자 필터와 메타데이터 제거를 사용한다(getScoops·getScoopMonths).
 */

/** 콘에 올라가는 스쿱 한 개. scoop-cone.jsx의 scoops 항목과 같은 모양. */
export type Scoop = {
  id: number;
  /** 비공개 기사도 학습 기록은 남지만 리더 링크는 제공하지 않는다. */
  variantId: number | null;
  articleId: number;
  /** domains.slug — lib/color.ts의 DOMAIN_FLAVORS 키. */
  domain: string;
  domainLabel: string;
  /** 'YYYY-MM-DD' — 색을 결정하는 입력이라 문자열 그대로 둔다. */
  date: string;
  title: string;
  /** 주문서 카드의 첫 문장과 같은 자리에서 쓰는 요약 첫 문장(화면구성.md §4-2). */
  summaryFirstLine: string | null;
  score: number;
};

export type TodayPick = {
  variantId: number;
  articleId: number;
  domain: DomainRow;
  level: number;
  title: string;
  summary: string | null;
  readingMinutes: number | null;
  sourceName: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  /** 퀴즈는 풀었지만 저장하지 않은 글 — 누르면 리더가 아니라 결과 화면으로 간다(정책.md §13). */
  completedNotSaved: boolean;
};

export async function getDomains(
  supabase: SupabaseClient,
): Promise<DomainRow[]> {
  const { data } = await supabase
    .from("domains")
    .select("*")
    .eq("active", true)
    .order("id");

  return (data ?? []) as DomainRow[];
}

export async function getLevels(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<number, number>> {
  const { data } = await supabase
    .from("user_domain_levels")
    .select("domain_id, level")
    .eq("user_id", userId);

  return new Map(
    (data ?? []).map((row) => [row.domain_id as number, row.level as number]),
  );
}

/**
 * 저장까지 끝난 진행 행에서 스쿱을 파생한다(정책.md §2 — 별도 테이블 없음, 저장을
 * 눌러야 생긴다). `month`가 'YYYY-MM'이면 그 달(KST 기준)만 반환하고, 없으면
 * 이번 달(정책.md §1 — 콘 하나 = 한 달).
 * 서버에서만 service-role client와 인증된 사용자 ID로 호출한다.
 * 기사 RLS를 우회해 읽은 메타데이터는 공개 여부에 따라 아래에서 제거한다.
 */
export async function getScoops(
  supabase: SupabaseClient,
  userId: string,
  month?: string,
): Promise<Scoop[]> {
  const targetMonth = month ?? dayKey().slice(0, 7);
  const [start, end] = monthRangeUtc(targetMonth);
  const [sources, { data, error }] = await Promise.all([
    getSourceRights(supabase),
    supabase
      .from("user_article_progress")
      .select(
        `id, variant_id, article_id, quiz_score, completed_at, article_variants(title, summary, articles(${ARTICLE_RIGHTS_COLUMNS}, domains(slug, name_ko)))`,
      )
      .eq("user_id", userId)
      .eq("status", "saved")
      .gte("completed_at", start)
      .lt("completed_at", end)
      .order("completed_at", { ascending: true }),
  ]);
  if (error) throw new Error("저장한 학습 기록을 불러오지 못했어요.");

  return (data ?? []).flatMap((row) => {
    const r = row as unknown as {
      id: number;
      variant_id: number;
      article_id: number;
      quiz_score: number | null;
      completed_at: string | null;
      article_variants: {
        title: string;
        summary: string | null;
        articles: (ArticleRights & { domains: { slug: string; name_ko: string } | null }) | null;
      } | null;
    };

    const domain = r.article_variants?.articles?.domains;
    if (!r.completed_at) return [];
    const readable = articleAllows(r.article_variants?.articles, sources, "publish");

    return [
      {
        id: r.id,
        variantId: readable ? r.variant_id : null,
        articleId: r.article_id,
        domain: domain?.slug ?? "unknown",
        domainLabel: domain?.name_ko ?? "학습 기록",
        date: dayKey(new Date(r.completed_at)),
        title: readable ? r.article_variants?.title ?? "제목 없음" : "현재 열람 불가",
        summaryFirstLine: readable ? firstSentence(r.article_variants?.summary ?? null) : null,
        score: r.quiz_score ?? 0,
      },
    ];
  });
}

function firstSentence(summary: string | null): string | null {
  if (!summary) return null;
  const match = summary.match(/^[^.!?。]+[.!?。]?/);
  return (match?.[0] ?? summary).trim() || null;
}

/** 서버 전용. 인증된 사용자의 저장 기록으로 월 목록을 만든다. 비공개 기사도 포함한다. */
export async function getScoopMonths(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_article_progress")
    .select("completed_at")
    .eq("user_id", userId)
    .eq("status", "saved")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });
  if (error) throw new Error("저장한 학습 기록을 불러오지 못했어요.");

  const months = new Set<string>();
  for (const row of data ?? []) {
    const completedAt = row.completed_at as string | null;
    if (completedAt) months.add(dayKey(new Date(completedAt)).slice(0, 7));
  }
  return [...months];
}

/**
 * 소스분류.md §3 / 정책.md §9 — 도메인이 4개를 넘으면 온보딩에서 고른 도메인만
 * 주문서 카드로 만든다. 8분류 체제에서는 항상 적용된다.
 */
export function selectedDomains(
  domains: DomainRow[],
  levels: Map<number, number>,
): DomainRow[] {
  if (domains.length <= 4) return domains;
  return domains.filter((d) => levels.has(d.id));
}

/**
 * 도메인마다 오늘의 카드 하나씩 (정책.md §13).
 *
 * 퀴즈까지 풀었지만 저장하지 않은 글이 있으면 그 글이 그 도메인의 카드다
 * (`completedNotSaved: true`) — 쿼터를 다시 안 쓰고 결과 화면으로 바로 간다.
 * 없으면 아직 손대지 않은(completed·saved 어느 쪽도 아닌) 아티클 중 현재 수준의
 * 것을 하나 고른다.
 *
 * "안 읽음"을 SQL에서 거르지 않고 메모리에서 판정한다. 집합이 작고(하루 ~1편),
 * 계속 커지는 id 목록에 대한 NOT IN은 조용히 썩는 종류의 쿼리라서.
 */
export async function getTodayPicks(
  supabase: SupabaseClient,
  userId: string,
  domains: DomainRow[],
  levels: Map<number, number>,
): Promise<TodayPick[]> {
  const sources = await getSourceRights(supabase);
  if (sources.size === 0) return [];
  const { data: progressRows } = await supabase
    .from("user_article_progress")
    .select(
      `article_id, variant_id, status, article_variants(title, summary, level, reading_minutes, articles(id, domain_id, source_url, image_url, published_at, ${ARTICLE_RIGHTS_COLUMNS}))`,
    )
    .eq("user_id", userId)
    .in("status", ["completed", "saved"]);

  type ProgressJoin = {
    article_id: number;
    variant_id: number;
    status: "completed" | "saved";
    article_variants: {
      title: string;
      summary: string | null;
      level: number;
      reading_minutes: number | null;
      articles: ArticleRights & {
        id: number;
        domain_id: number;
        source_url: string;
        image_url: string | null;
        published_at: string | null;
      } | null;
    } | null;
  };

  const interacted = new Set<number>(); // completed든 saved든 — 새 카드로 다시 고르지 않는다
  const unsavedByDomain = new Map<number, TodayPick>(); // completed인데 저장 안 한 것만

  for (const row of (progressRows ?? []) as unknown as ProgressJoin[]) {
    interacted.add(row.article_id);
    const variant = row.article_variants;
    const article = variant?.articles;
    if (!variant || !article || row.status !== "completed" || !articleAllows(article, sources, "publish")) continue;

    const domain = domains.find((d) => d.id === article.domain_id);
    if (!domain || unsavedByDomain.has(domain.id)) continue;

    unsavedByDomain.set(domain.id, {
      variantId: row.variant_id,
      articleId: row.article_id,
      domain,
      level: variant.level,
      title: variant.title,
      summary: variant.summary,
      readingMinutes: variant.reading_minutes,
      sourceName: hostLabel(article.source_url),
      imageUrl: null,
      publishedAt: article.published_at,
      completedNotSaved: true,
    });
  }

  const picks: TodayPick[] = [];

  for (const domain of domains) {
    const unsaved = unsavedByDomain.get(domain.id);
    if (unsaved) {
      picks.push(unsaved);
      continue;
    }

    const level = clampLevel(levels.get(domain.id) ?? 2);

    type FreshVariant = {
      id: number;
      article_id: number;
      title: string;
      summary: string | null;
      reading_minutes: number | null;
      articles: ArticleRights & { source_url: string; image_url: string | null; published_at: string | null };
    };
    let fresh: FreshVariant | undefined;
    const pageSize = 12;
    // Read past saved or withdrawn items until an eligible unread article is found.
    // Order the parent variants by publication date, with a stable tie-breaker.
    for (let offset = 0; !fresh; offset += pageSize) {
      const { data, error } = await supabase
        .from("article_variants")
        .select(
          `id, article_id, title, summary, reading_minutes, articles!inner(id, domain_id, source_url, image_url, published_at, ${ARTICLE_RIGHTS_COLUMNS})`,
        )
        .eq("level", level)
        .eq("articles.domain_id", domain.id)
        .eq("articles.status", "ready")
        .eq("articles.rights_status", "permitted")
        .order("articles(published_at)", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) break;
      const page = (data ?? []) as unknown as FreshVariant[];
      fresh = page.find((row) => !interacted.has(row.article_id) &&
        articleAllows(row.articles, sources, "publish"));
      if (page.length < pageSize) break;
    }

    if (!fresh) continue;

    picks.push({
      variantId: fresh.id,
      articleId: fresh.article_id,
      domain,
      level,
      title: fresh.title,
      summary: fresh.summary,
      readingMinutes: fresh.reading_minutes,
      sourceName: hostLabel(fresh.articles.source_url),
      imageUrl: null,
      publishedAt: fresh.articles.published_at,
      completedNotSaved: false,
    });
  }

  return picks;
}

export function hostLabel(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
