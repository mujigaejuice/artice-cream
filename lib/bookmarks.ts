import type { SupabaseClient } from "@supabase/supabase-js";

import { ARTICLE_RIGHTS_COLUMNS, articleAllows, getSourceRights, type ArticleRights } from "./content-rights";
import { hostLabel } from "./feed";

/**
 * 북마크 (확장.md §4). 진행 행의 `bookmarked_at`이 곧 북마크다 — 한 번이라도 연
 * 글에만 붙고, 북마크가 진행 행을 만들지는 않는다(쿼터 차감은 처음 열 때뿐, 정책.md §7).
 */

/** 목록 상한. 한 화면에 다 보여주는 목록이라 페이지를 나누지 않는다. */
export const BOOKMARK_LIST_LIMIT = 100;

export type Bookmark = {
  articleId: number;
  /** 지금 열람할 수 없는 글이면 null — 리더 링크를 주지 않는다. */
  variantId: number | null;
  available: boolean;
  title: string;
  /** domains.slug. 열람 불가인 글은 빈 문자열. */
  domain: string;
  domainLabel: string;
  level: number | null;
  isOriginal: boolean;
  sourceName: string | null;
  readingMinutes: number | null;
  progressStatus: "started" | "completed" | "saved";
  bookmarkedAt: string;
};

type BookmarkRow = {
  article_id: number;
  variant_id: number;
  status: "started" | "completed" | "saved";
  bookmarked_at: string | null;
  article_variants: {
    title: string;
    level: number;
    reading_minutes: number | null;
    articles: (ArticleRights & { source_url: string | null; domains: { slug: string; name_ko: string } | null }) | null;
  } | null;
};

/**
 * 서버 전용. service-role client와 검증된 user.id로만 부른다. RLS를 우회해 읽은
 * 기사 메타데이터는 현재 공개 권한이 없으면 여기서 지운다(getScoops와 같은 방식).
 */
export async function getBookmarks(admin: SupabaseClient, userId: string): Promise<Bookmark[]> {
  const [sources, { data, error }] = await Promise.all([
    getSourceRights(admin),
    admin
      .from("user_article_progress")
      .select(
        `article_id, variant_id, status, bookmarked_at, article_variants(title, level, reading_minutes, articles(source_url, ${ARTICLE_RIGHTS_COLUMNS}, domains(slug, name_ko)))`,
      )
      .eq("user_id", userId)
      .not("bookmarked_at", "is", null)
      .order("bookmarked_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(BOOKMARK_LIST_LIMIT),
  ]);
  if (error) throw new Error("북마크를 불러오지 못했어요.");

  return ((data ?? []) as unknown as BookmarkRow[]).flatMap<Bookmark>((row) => {
    if (!row.bookmarked_at) return [];
    const variant = row.article_variants;
    const article = variant?.articles;
    const available = articleAllows(article, sources, "publish");
    if (!available || !variant || !article) {
      // 내려간 글은 제목·출처·분야를 내보내지 않는다. 해제할 수 있게 자리만 남긴다.
      return [{
        articleId: row.article_id, variantId: null, available: false, title: "현재 열람 불가",
        domain: "", domainLabel: "", level: null, isOriginal: false, sourceName: null,
        readingMinutes: null, progressStatus: row.status, bookmarkedAt: row.bookmarked_at,
      }];
    }
    const isOriginal = article.content_kind === "original";
    return [{
      articleId: row.article_id,
      variantId: row.variant_id,
      available: true,
      title: variant.title,
      domain: article.domains?.slug ?? "",
      domainLabel: article.domains?.name_ko ?? "",
      level: variant.level,
      isOriginal,
      sourceName: isOriginal ? "artice cream Original" : hostLabel(article.source_url),
      readingMinutes: variant.reading_minutes,
      progressStatus: row.status,
      bookmarkedAt: row.bookmarked_at,
    }];
  });
}

export type SetBookmarkResult =
  | { ok: true; articleId: number; bookmarked: boolean }
  | { error: "not found" | "invalid body" };

/** 본인의 기존 진행 행에만 쓴다. 행을 만들지 않는다. */
export async function setBookmark(
  admin: SupabaseClient,
  userId: string,
  articleId: number,
  bookmarked: boolean,
): Promise<SetBookmarkResult> {
  const { data, error } = await admin.rpc("set_article_bookmark", {
    p_user_id: userId, p_article_id: articleId, p_bookmarked: bookmarked,
  });
  if (error) throw error;
  if (data && (data.error === "not found" || data.error === "invalid body")) return { error: data.error };
  if (!data || data.ok !== true || data.articleId !== articleId || typeof data.bookmarked !== "boolean" ||
      data.bookmarked !== bookmarked) {
    throw new Error("Invalid bookmark result");
  }
  return { ok: true, articleId, bookmarked: data.bookmarked };
}
