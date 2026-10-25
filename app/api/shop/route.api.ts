import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShopSnapshot } from "@/lib/cosmetics";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(request: Request) {
  const { user } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);
  try {
    const { data, error } = await createAdminClient().rpc("get_shop_snapshot", { p_user_id: user.id });
    if (error || !data || typeof data !== "object") throw error ?? new Error("Invalid shop snapshot");
    const balance = BigInt(data.balance);
    if (balance < 0n || balance > BigInt(Number.MAX_SAFE_INTEGER) ||
        !Array.isArray(data.items) || !Array.isArray(data.ownedItems) ||
        !data.equipped || typeof data.equipped !== "object" ||
        typeof data.spendingEnabled !== "boolean") throw new Error("Invalid shop snapshot");
    const snapshot: ShopSnapshot = { ...data, userId: user.id, balance: Number(balance) };
    return json(request, snapshot);
  } catch {
    return apiError(request, "shop_unavailable", 503);
  }
}
