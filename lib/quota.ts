import type { SupabaseClient } from "@supabase/supabase-js";

import { dayKey, dayRangeUtc } from "./day";
import type { DailyQuotaRow } from "./supabase/types";

/**
 * 일일 쿼터 (spec §5.1).
 *
 * 무료 1편 + 광고로 해제한 만큼. 모든 함수가 service role 클라이언트를 받는 건
 * 의도다 — daily_quota에는 클라이언트 쓰기 정책이 없다. 사용자가 자기 쿼터 행을
 * 쓸 수 있으면 쿼터가 없는 것과 같기 때문.
 */

/** 하루 무료 편수. */
export const FREE_PER_DAY = 1;

/** 광고로 하루에 추가할 수 있는 최대 편수 (spec §5.1 어뷰징 방지). */
export const MAX_AD_UNLOCKS_PER_DAY = 3;

/** 정책.md §10 — 하루 경계는 KST 자정. */
export function quotaDate(now: Date = new Date()): string {
  return dayKey(now);
}

export type QuotaState = {
  date: string;
  freeUsed: boolean;
  /** 광고로 해제했지만 아직 쓰지 않은 편수. */
  adUnlocks: number;
  remaining: number;
  canRead: boolean;
  /** 광고를 더 봐도 되는지 (일일 상한). */
  canUnlockWithAd: boolean;
  adUnlocksGrantedToday: number;
};

/**
 * 프로토타입(artice-cream-flow.jsx `finish`)과 같은 소비 규칙:
 * 무료분을 먼저 쓰고, 그 다음부터 광고 해제분을 하나씩 깎는다.
 */
function toState(row: DailyQuotaRow | null, date: string): QuotaState {
  const freeUsed = row?.free_used ?? false;
  const adUnlocks = row?.ad_unlocks ?? 0;
  const remaining = (freeUsed ? 0 : FREE_PER_DAY) + adUnlocks;

  return {
    date,
    freeUsed,
    adUnlocks,
    remaining,
    canRead: remaining > 0,
    // 상한은 "오늘 지급한 총량" 기준이어야 한다. 남은 개수로 재면 해제 → 소비를
    // 반복해 무한히 볼 수 있다. ad_views 건수로 세는 이유.
    canUnlockWithAd: false,
    adUnlocksGrantedToday: 0,
  };
}

async function grantedToday(
  admin: SupabaseClient,
  userId: string,
  date: string,
): Promise<number> {
  const [start, end] = dayRangeUtc(date);
  const { count } = await admin
    .from("ad_views")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("reward_verified", true)
    .gte("created_at", start)
    .lt("created_at", end);

  return count ?? 0;
}

export async function getQuota(
  admin: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<QuotaState> {
  const date = quotaDate(now);

  const [{ data }, granted] = await Promise.all([
    admin
      .from("daily_quota")
      .select("*")
      .eq("user_id", userId)
      .eq("quota_date", date)
      .maybeSingle(),
    grantedToday(admin, userId, date),
  ]);

  const state = toState(data as DailyQuotaRow | null, date);
  return {
    ...state,
    adUnlocksGrantedToday: granted,
    canUnlockWithAd: granted < MAX_AD_UNLOCKS_PER_DAY,
  };
}

/**
 * 오늘 분량에서 한 편을 쓴다.
 *
 * 남은 게 없으면 `null`을 돌려준다 — 호출자는 이걸 경고가 아니라 차단으로
 * 다뤄야 한다. 이미 완료한 아티클을 다시 여는 경로는 여기를 타지 않는다.
 */
export async function consumeQuota(
  admin: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<QuotaState | null> {
  const before = await getQuota(admin, userId, now);
  if (!before.canRead) return null;

  const next = before.freeUsed
    ? { free_used: true, ad_unlocks: before.adUnlocks - 1 }
    : { free_used: true, ad_unlocks: before.adUnlocks };

  const { data, error } = await admin
    .from("daily_quota")
    .upsert(
      { user_id: userId, quota_date: before.date, ...next },
      { onConflict: "user_id,quota_date" },
    )
    .select()
    .single();

  if (error) throw error;

  return {
    ...toState(data as DailyQuotaRow, before.date),
    adUnlocksGrantedToday: before.adUnlocksGrantedToday,
    canUnlockWithAd: before.adUnlocksGrantedToday < MAX_AD_UNLOCKS_PER_DAY,
  };
}

/** 검증된 광고 시청 1건에 대해 한 편을 더 열어 준다. */
export async function grantAdUnlock(
  admin: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<QuotaState | null> {
  const before = await getQuota(admin, userId, now);
  if (!before.canUnlockWithAd) return null;

  const { data, error } = await admin
    .from("daily_quota")
    .upsert(
      {
        user_id: userId,
        quota_date: before.date,
        free_used: before.freeUsed,
        ad_unlocks: before.adUnlocks + 1,
      },
      { onConflict: "user_id,quota_date" },
    )
    .select()
    .single();

  if (error) throw error;

  const granted = before.adUnlocksGrantedToday + 1;
  return {
    ...toState(data as DailyQuotaRow, before.date),
    adUnlocksGrantedToday: granted,
    canUnlockWithAd: granted < MAX_AD_UNLOCKS_PER_DAY,
  };
}

export type ProgressSummary = {
  status: "started" | "completed" | "saved";
  variantId: number;
  quizScore: number | null;
} | null;

/**
 * 이 아티클을 지금까지 어디까지 진행했는지 (정책.md §2, §7). 쿼터는 아티클당
 * 한 번만 소모하므로, 게이트는 variant가 아니라 article 기준이다.
 */
export async function getProgress(
  admin: SupabaseClient,
  userId: string,
  articleId: number,
): Promise<ProgressSummary> {
  const { data } = await admin
    .from("user_article_progress")
    .select("status, variant_id, quiz_score")
    .eq("user_id", userId)
    .eq("article_id", articleId)
    .maybeSingle();

  if (!data) return null;
  return {
    status: data.status as "started" | "completed" | "saved",
    variantId: data.variant_id as number,
    quizScore: data.quiz_score as number | null,
  };
}

/**
 * 리더 진입 게이트 (정책.md §7).
 *
 * upsert(ignoreDuplicates)가 원자적 판정이 된다: 새로 들어갔다 → 이 아티클을
 * 처음 여는 것 → 쿼터를 쓴다. 이미 있었다 → 오늘이든 지난달이든 이미 산 것 →
 * 무료. `unique (user_id, article_id)`가 경합을 막아 주므로 별도 잠금이 필요 없다.
 *
 * 쿼터가 없으면 방금 넣은 행을 되돌린다 — 안 그러면 다음 방문부터 공짜로 열린다.
 */
export async function openArticle(
  admin: SupabaseClient,
  userId: string,
  articleId: number,
  variantId: number,
): Promise<{ opened: true } | { opened: false; quota: QuotaState }> {
  const { data: inserted } = await admin
    .from("user_article_progress")
    .upsert(
      { user_id: userId, article_id: articleId, variant_id: variantId, status: "started" },
      { onConflict: "user_id,article_id", ignoreDuplicates: true },
    )
    .select("id");

  const firstOpen = (inserted?.length ?? 0) > 0;
  if (!firstOpen) return { opened: true };

  const spent = await consumeQuota(admin, userId);
  if (spent) return { opened: true };

  await admin
    .from("user_article_progress")
    .delete()
    .eq("user_id", userId)
    .eq("article_id", articleId)
    .eq("status", "started");

  return { opened: false, quota: await getQuota(admin, userId) };
}
