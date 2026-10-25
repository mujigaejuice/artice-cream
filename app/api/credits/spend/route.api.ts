import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(request: Request) {
  const { user } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);
  let body: unknown;
  try { body = await request.json(); }
  catch { return apiError(request, "invalid_body", 400); }
  const { itemId, catalogVersion } = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown> : {};
  if (typeof itemId !== "string" || !/^[a-z0-9-]{1,64}$/.test(itemId) ||
      !Number.isSafeInteger(catalogVersion) || Number(catalogVersion) <= 0) {
    return apiError(request, "invalid_body", 400);
  }
  try {
    const { data, error } = await createAdminClient().rpc("spend_credits", {
      p_user_id: user.id, p_item_id: itemId, p_catalog_version: catalogVersion,
    });
    if (error || !data || typeof data !== "object") throw error ?? new Error("Invalid purchase result");
    if (typeof data.error === "string") {
      const status: Record<string, number> = { invalid_body: 400, unauthenticated: 401,
        not_found: 404, price_changed: 409, insufficient_credits: 409, shop_unavailable: 503 };
      return json(request, data, { status: status[data.error] ?? 503 });
    }
    const balance = BigInt(data.balance);
    if (!["purchased", "already_owned"].includes(data.status) || data.itemId !== itemId ||
        balance < 0n || balance > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Invalid purchase result");
    return json(request, { ...data, balance: Number(balance) });
  } catch {
    return apiError(request, "shop_unavailable", 503);
  }
}
