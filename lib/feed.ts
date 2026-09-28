import type { SupabaseClient } from "@supabase/supabase-js";

import { dayKey, monthRangeUtc } from "./day";
import { clampLevel } from "./level";
import type { DomainRow } from "./supabase/types";

/**
 * 홈 화면 조회 (plan §5). 사용자 스코프 클라이언트로 돈다 — 남의 콘이 안 보이는 건
 * 이 쿼리들이 아니라 RLS가 보장한다.
 */

/** 콘에 올라가는 스쿱 한 개. scoop-cone.jsx의 scoops 항목과 같은 모양. */
export type Scoop = {
  id: number;
  variantId: number;
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
 */
export async function getScoops(
  supabase: SupabaseClient,
  userId: string,
  month?: string,
): Promise<Scoop[]> {
  const targetMonth = month ?? dayKey().slice(0, 7);
  const [start, end] = monthRangeUtc(targetMonth);

  const { data } = await supabase
    .from("user_article_progress")
    .select(
      "id, variant_id, article_id, quiz_score, completed_at, article_variants(title, summary, articles(domains(slug, name_ko)))",
    )
    .eq("user_id", userId)
    .eq("status", "saved")
    .gte("completed_at", start)
    .lt("completed_at", end)
    .order("completed_at", { ascending: true });

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
        articles: { domains: { slug: string; name_ko: string } | null } | null;
      } | null;
    };

    const domain = r.article_variants?.articles?.domains;
    if (!domain || !r.completed_at) return [];

    return [
      {
        id: r.id,
        variantId: r.variant_id,
        articleId: r.article_id,
        domain: domain.slug,
        domainLabel: domain.name_ko,
        date: dayKey(new Date(r.completed_at)),
        title: r.article_variants?.title ?? "제목 없음",
        summaryFirstLine: firstSentence(r.article_variants?.summary ?? null),
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

/** 스쿱이 있는 달 목록(최신순, 'YYYY-MM'). 월 전환 UI가 빈 달로 넘어가지 않게 한다. */
export async function getScoopMonths(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("user_article_progress")
    .select("completed_at")
    .eq("user_id", userId)
    .eq("status", "saved")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });

  const months = new Set<string>();
  for (const row of data ?? []) {
    const completedAt = (row as { completed_at: string | null }).completed_at;
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
  const { data: progressRows } = await supabase
    .from("user_article_progress")
    .select(
      "article_id, variant_id, status, article_variants(title, summary, level, reading_minutes, articles(id, domain_id, source_url, image_url, published_at))",
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
      articles: {
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
    if (!variant || !article || row.status !== "completed") continue;

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
      imageUrl: article.image_url,
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

    const { data } = await supabase
      .from("article_variants")
      .select(
        "id, article_id, title, summary, reading_minutes, articles!inner(id, domain_id, source_url, image_url, status, published_at)",
      )
      .eq("level", level)
      .eq("articles.domain_id", domain.id)
      .eq("articles.status", "ready")
      .order("published_at", { referencedTable: "articles", ascending: false })
      .limit(12);

    const fresh = (data ?? []).find(
      (row) => !interacted.has((row as { article_id: number }).article_id),
    ) as
      | {
          id: number;
          article_id: number;
          title: string;
          summary: string | null;
          reading_minutes: number | null;
          articles: { source_url: string; image_url: string | null; published_at: string | null };
        }
      | undefined;

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
      imageUrl: fresh.articles.image_url,
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
