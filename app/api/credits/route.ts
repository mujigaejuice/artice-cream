import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CreditSnapshot, CreditStreak } from "@/lib/credits";
import { currentStreakDays, daysUntilStreakReward, STREAK_BLOCK_DAYS } from "@/lib/streak";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** The DB reports its latest run; a run that ended before yesterday (KST) is no longer current. */
function readStreak(raw: unknown, now: Date): CreditStreak {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const enabled = value.enabled === true;
  const reward = Number.isSafeInteger(value.reward) ? Number(value.reward) : 0;
  const lastDay = typeof value.lastDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.lastDay)
    ? value.lastDay : null;
  const days = enabled && Number.isSafeInteger(value.days)
    ? currentStreakDays(lastDay, Number(value.days), now) : 0;
  return { enabled, days, reward, blockDays: STREAK_BLOCK_DAYS, daysUntilReward: daysUntilStreakReward(days) };
}

export async function GET(request: Request) {
  const { user } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);

  try {
    const { data, error } = await createAdminClient().rpc("get_credit_snapshot", {
      p_user_id: user.id,
    });
    if (error || !data || typeof data !== "object") throw error ?? new Error("Invalid credit snapshot");
    const balance = BigInt(data.balance);
    const spendableBalance = BigInt(data.spendableBalance);
    if (balance < 0n || balance > BigInt(Number.MAX_SAFE_INTEGER) ||
        spendableBalance < 0n || spendableBalance > balance) throw new Error("Invalid balance");
    const snapshot: CreditSnapshot = { ...data, userId: user.id, balance: Number(balance),
      spendableBalance: Number(spendableBalance), streak: readStreak(data.streak, new Date()) };
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
