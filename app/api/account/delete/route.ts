import { bearerToken, corsHeaders, getRequestContext, preflight } from "@/lib/api";
import { hasRecentAuthentication } from "@/lib/account-deletion";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

function reply(request: Request, body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders(request), "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  try {
    const { user } = await getRequestContext(request);
    if (!user) return reply(request, { error: "unauthenticated" }, 401);
    return reply(request, {
      userId: user.id,
      email: user.email ?? null,
      canDelete: hasRecentAuthentication(bearerToken(request) ?? "", user),
    });
  } catch {
    return reply(request, { error: "account_check_failed" }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await getRequestContext(request);
    if (!user) return reply(request, { error: "unauthenticated" }, 401);

    let body: unknown;
    try { body = await request.json(); } catch { /* rejected below */ }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return reply(request, { error: "confirmation_required" }, 400);
    }
    const fields = body as Record<string, unknown>;
    // An expected ID detects account switches between rendering and submitting.
    // It NEVER supplies the deletion target, which comes only from verified Auth.
    if (Object.keys(fields).some((key) => !["expectedUserId", "confirmation"].includes(key)) ||
        fields.confirmation !== "계정 삭제") {
      return reply(request, { error: "confirmation_required" }, 400);
    }
    if (fields.expectedUserId !== user.id) {
      return reply(request, { error: "account_changed" }, 409);
    }
    if (!hasRecentAuthentication(bearerToken(request) ?? "", user)) {
      return reply(request, { error: "reauthentication_required" }, 403);
    }

    // Hard delete Auth + FK cascades in one database operation. Deleting public
    // rows separately would allow a partial deletion or concurrent resurrection.
    const { error } = await createAdminClient().auth.admin.deleteUser(user.id, false);
    if (error) {
      // A concurrent confirmed request may have removed the same account already.
      if (error.code === "user_not_found") return reply(request, { deleted: true });
      return reply(request, { error: "deletion_failed" }, 503);
    }
    return reply(request, { deleted: true });
  } catch {
    // Never return vendor errors, tokens, email addresses or service credentials.
    return reply(request, { error: "deletion_failed" }, 503);
  }
}
