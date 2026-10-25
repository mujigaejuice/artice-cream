import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

/** The database owns the first-completion decision, score, level, and credit ledger. */
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(request: Request) {
  const { user } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);

  let body: unknown;
  try { body = await request.json(); }
  catch { return apiError(request, "invalid body", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return apiError(request, "invalid body", 400);
  }

  const { variantId, answers } = body as Record<string, unknown>;
  if (!Number.isSafeInteger(variantId) || Number(variantId) <= 0 ||
      !answers || typeof answers !== "object" || Array.isArray(answers) ||
      Object.values(answers).some((answer) => !Number.isInteger(answer) || Number(answer) < 0)) {
    return apiError(request, "invalid body", 400);
  }

  try {
    const { data, error } = await createAdminClient().rpc("grade_quiz_with_credits", {
      p_user_id: user.id,
      p_variant_id: variantId,
      p_answers: answers,
    });
    if (error || !data || typeof data !== "object") throw error ?? new Error("Invalid grade result");
    if (typeof data.error === "string") {
      const status: Record<string, number> = {
        "invalid body": 400,
        incomplete: 400,
        unauthenticated: 401,
        "article not opened": 403,
        "not found": 404,
        "no questions": 409,
        "invalid progress": 409,
        "credits temporarily unavailable": 503,
      };
      return apiError(request, data.error, status[data.error] ?? 503);
    }
    if (typeof data.score !== "number" || typeof data.isReview !== "boolean" ||
        !Array.isArray(data.review) || !data.credits ||
        !Number.isSafeInteger(data.credits.balance)) throw new Error("Invalid grade result");
    return json(request, data);
  } catch {
    return apiError(request, "grading temporarily unavailable", 503);
  }
}
