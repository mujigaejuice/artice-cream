import type { SupabaseClient } from "@supabase/supabase-js";

import { dayKey } from "./day";

/** Operational usage records only. Reading history and cones remain until account deletion. */
export const USAGE_RETENTION_DAYS = 30;

export function retentionCutoffs(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - USAGE_RETENTION_DAYS * 86_400_000);
  return { quotaDate: dayKey(cutoff), adCreatedAt: cutoff.toISOString() };
}

/** Idempotent daily cleanup. Never reads or returns individual user records. */
export async function deleteExpiredUsage(admin: SupabaseClient, now: Date = new Date()) {
  const cutoff = retentionCutoffs(now);
  const quota = await admin.from("daily_quota").delete({ count: "exact" }).lt("quota_date", cutoff.quotaDate);
  if (quota.error) throw new Error("Usage cleanup failed");
  const ads = await admin.from("ad_views").delete({ count: "exact" }).lt("created_at", cutoff.adCreatedAt);
  if (ads.error) throw new Error("Usage cleanup failed");
  return { dailyQuotaDeleted: quota.count ?? 0, adViewsDeleted: ads.count ?? 0 };
}
