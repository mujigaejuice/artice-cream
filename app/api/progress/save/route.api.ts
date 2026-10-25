import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

/** A saved scoop is a separate, idempotent transition after grading. */
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(request: Request) {
  const { user } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);
  let body: unknown;
  try { body = await request.json(); }
  catch { return apiError(request, "invalid body", 400); }
  const articleId = (body && typeof body === "object" && !Array.isArray(body))
    ? (body as Record<string, unknown>).articleId : null;
  if (!Number.isSafeInteger(articleId) || Number(articleId) <= 0) {
    return apiError(request, "invalid body", 400);
  }

  try {
    const { data, error } = await createAdminClient().rpc("save_article_progress", {
      p_user_id: user.id,
      p_article_id: articleId,
    });
    if (error || !data || typeof data !== "object") throw error ?? new Error("Invalid save result");
    if (typeof data.error === "string") {
      return apiError(request, data.error, data.error === "not found" ? 404 :
        data.error === "not completed" ? 409 : data.error === "unauthenticated" ? 401 : 503);
    }
    if (data.ok !== true || data.saved !== true || !Number.isSafeInteger(data.scoopId)) {
      throw new Error("Invalid save result");
    }
    return json(request, data);
  } catch {
    return apiError(request, "saving temporarily unavailable", 503);
  }
}
