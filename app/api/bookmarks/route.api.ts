import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { getBookmarks, setBookmark } from "@/lib/bookmarks";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 북마크 (확장.md §4).
 *
 * GET  — 북마크한 글, 최근에 북마크한 순. 내려간 글은 제목 없이 "현재 열람 불가"로.
 * POST — `{ articleId, bookmarked }`. 본인이 이미 연 글(진행 행이 있는 글)에만.
 *
 * 쓰기·읽기 모두 service role로 하되 user.id는 검증된 토큰에서만 얻는다. 요청에
 * 들어온 userId는 쓰지 않는다. 북마크는 진행 행을 만들지 않으므로 쿼터와 무관하다.
 */

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(request: Request) {
  const { user } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);

  try {
    const bookmarks = await getBookmarks(createAdminClient(), user.id);
    return json(request, { userId: user.id, bookmarks });
  } catch {
    return apiError(request, "북마크를 불러오지 못했어요.", 503);
  }
}

export async function POST(request: Request) {
  const { user } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);

  let body: unknown;
  try { body = await request.json(); }
  catch { return apiError(request, "invalid body", 400); }
  const fields = (body && typeof body === "object" && !Array.isArray(body)) ? body as Record<string, unknown> : {};
  const { articleId, bookmarked } = fields;
  if (typeof articleId !== "number" || !Number.isSafeInteger(articleId) || articleId <= 0 ||
      typeof bookmarked !== "boolean") {
    return apiError(request, "invalid body", 400);
  }

  try {
    const result = await setBookmark(createAdminClient(), user.id, articleId, bookmarked);
    if ("error" in result) return apiError(request, result.error, result.error === "not found" ? 404 : 400);
    return json(request, result);
  } catch {
    return apiError(request, "bookmark temporarily unavailable", 503);
  }
}
