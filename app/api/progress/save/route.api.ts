import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 저장 (정책.md §2, §13) — 결과 화면의 "콘에 올리기" 버튼이 부른다.
 *
 * `completed`인 행만 `saved`로 올린다. 클라이언트는 점수를 보내지 않으므로
 * 위조할 것이 없다 — 이미 채점된 행을 상태만 바꾼다. 이미 `saved`면 아무 일도
 * 하지 않는다(멱등).
 */

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(request: Request) {
  const { user } = await getRequestContext(request);

  if (!user) {
    return apiError(request, "unauthenticated", 401);
  }

  let body: { articleId?: number };
  try {
    body = await request.json();
  } catch {
    return apiError(request, "invalid body", 400);
  }

  const articleId = Number(body?.articleId);
  if (!Number.isInteger(articleId)) {
    return apiError(request, "invalid body", 400);
  }

  const admin = createAdminClient();

  const { data: progress } = await admin
    .from("user_article_progress")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("article_id", articleId)
    .maybeSingle();

  if (!progress) {
    return apiError(request, "not found", 404);
  }

  if (progress.status === "saved") {
    return json(request, { ok: true, saved: true, scoopId: progress.id });
  }

  if (progress.status !== "completed") {
    return apiError(request, "not completed", 409);
  }

  const { error } = await admin
    .from("user_article_progress")
    .update({ status: "saved", saved_at: new Date().toISOString() })
    .eq("id", progress.id);

  if (error) throw error;

  return json(request, { ok: true, saved: true, scoopId: progress.id });
}
