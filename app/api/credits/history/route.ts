import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CreditEvent, CreditHistoryPage } from "@/lib/credits";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

type Cursor = [string, string];
function parseCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  if (raw.length > 256 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error("invalid cursor");
  const decoded: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  if (!Array.isArray(decoded) || decoded.length !== 2 ||
      typeof decoded[0] !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(decoded[0]) ||
      !Number.isFinite(Date.parse(decoded[0])) ||
      typeof decoded[1] !== "string" || !/^[1-9][0-9]{0,18}$/.test(decoded[1]) ||
      BigInt(decoded[1]) > 9223372036854775807n) {
    throw new Error("invalid cursor");
  }
  return decoded as Cursor;
}

export async function GET(request: Request) {
  const { user } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);
  const params = new URL(request.url).searchParams;
  const rawLimit = params.get("limit") ?? "20";
  if (!/^[1-9][0-9]?$/.test(rawLimit) || Number(rawLimit) > 50) {
    return apiError(request, "invalid limit", 400);
  }
  let cursor: Cursor | null;
  try { cursor = parseCursor(params.get("cursor")); }
  catch { return apiError(request, "invalid cursor", 400); }

  const limit = Number(rawLimit);
  try {
    const { data, error } = await createAdminClient().rpc("get_credit_history", {
      p_user_id: user.id,
      p_before_at: cursor?.[0] ?? null,
      p_before_id: cursor?.[1] ?? null,
      p_limit: limit + 1,
    });
    if (error || !Array.isArray(data)) throw error ?? new Error("Invalid credit history");
    const events: CreditEvent[] = data.slice(0, limit).map((row) => {
      if (typeof row.event_id !== "string" || typeof row.created_at !== "string" ||
          !Number.isInteger(row.amount) || typeof row.reason !== "string") {
        throw new Error("Invalid credit event");
      }
      return { id: row.event_id, amount: row.amount, reason: row.reason,
        createdAt: row.created_at, articleId: row.article_id ?? null,
        articleTitle: row.article_title ?? null };
    });
    const last = events.at(-1);
    const page: CreditHistoryPage = {
      userId: user.id,
      events,
      nextCursor: data.length > limit && last
        ? Buffer.from(JSON.stringify([last.createdAt, last.id])).toString("base64url") : null,
    };
    return json(request, page);
  } catch {
    return apiError(request, "history temporarily unavailable", 503);
  }
}
