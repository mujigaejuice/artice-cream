import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CreditSnapshot } from "@/lib/credits";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(request: Request) {
  const { user } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);

  try {
    const { data, error } = await createAdminClient().rpc("get_credit_snapshot", {
      p_user_id: user.id,
    });
    if (error || !data || typeof data !== "object") throw error ?? new Error("Invalid credit snapshot");
    const balance = BigInt(data.balance);
    if (balance < 0n || balance > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Invalid balance");
    const snapshot: CreditSnapshot = { ...data, userId: user.id, balance: Number(balance) };
    if (!Number.isInteger(snapshot.policyVersion) ||
        !["inactive", "active", "paused"].includes(snapshot.earningMode) ||
        typeof snapshot.hasWelcome !== "boolean" || !snapshot.rules) {
      throw new Error("Invalid credit snapshot");
    }
    return json(request, snapshot);
  } catch {
    return apiError(request, "credits temporarily unavailable", 503);
  }
}
