import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
const slots = new Set(["palette", "cone", "topping", "background", "music"]);

export async function POST(request: Request) {
  const { user } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);
  let body: unknown;
  try { body = await request.json(); }
  catch { return apiError(request, "invalid_body", 400); }
  const { slot, itemId } = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown> : {};
  if (typeof slot !== "string" || !slots.has(slot) ||
      !(itemId === null || (typeof itemId === "string" && /^[a-z0-9-]{1,64}$/.test(itemId)))) {
    return apiError(request, "invalid_body", 400);
  }
  try {
    const { data, error } = await createAdminClient().rpc("equip_cosmetic", {
      p_user_id: user.id, p_slot: slot, p_item_id: itemId,
    });
    if (error || !data || typeof data !== "object") throw error ?? new Error("Invalid equip result");
    if (typeof data.error === "string") {
      const status: Record<string, number> = { invalid_body: 400, unauthenticated: 401,
        item_not_owned: 403, wrong_slot: 409 };
      return apiError(request, data.error, status[data.error] ?? 503);
    }
    if (data.status !== "equipped" || !data.equipped || typeof data.equipped !== "object") {
      throw new Error("Invalid equip result");
    }
    return json(request, { userId: user.id, ...data });
  } catch {
    return apiError(request, "shop_unavailable", 503);
  }
}
