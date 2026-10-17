import type { SupabaseClient } from "@supabase/supabase-js";

export type QuotaState = {
  date: string;
  freeUsed: boolean;
  /** 광고로 받은 횟수 중 아직 사용하지 않은 횟수. */
  adUnlocks: number;
  remaining: number;
  canRead: boolean;
  canUnlockWithAd: boolean;
  adUnlocksGrantedToday: number;
};

/** DB 시각과 단일 스냅샷으로 잔여 횟수·일일 지급 상한을 함께 읽는다. */
export async function getQuota(admin: SupabaseClient, userId: string): Promise<QuotaState> {
  const { data, error } = await admin.rpc("get_daily_quota", { p_user_id: userId });
  if (error) throw error;
  if (!data) throw new Error("Missing quota state");
  return data as QuotaState;
}

export type AdRewardResult =
  | { status: "granted" | "replayed"; quota: QuotaState }
  | { status: "limit" }
  | { status: "conflict" };

/** 검증한 nonce의 기록과 보상 지급을 한 트랜잭션으로 처리한다. */
export async function grantAdUnlock(
  admin: SupabaseClient,
  userId: string,
  nonce: string,
): Promise<AdRewardResult> {
  const { data, error } = await admin.rpc("grant_ad_unlock", { p_user_id: userId, p_nonce: nonce });
  if (error) throw error;
  if (!data || !["granted", "replayed", "limit", "conflict"].includes(data.status)) {
    throw new Error("Invalid reward result");
  }
  if ((data.status === "granted" || data.status === "replayed") && !data.quota) {
    throw new Error("Missing reward quota");
  }
  return data as AdRewardResult;
}

export type ProgressSummary = {
  status: "started" | "completed" | "saved";
  variantId: number;
  quizScore: number | null;
} | null;

export async function getProgress(
  admin: SupabaseClient,
  userId: string,
  articleId: number,
): Promise<ProgressSummary> {
  const { data, error } = await admin
    .from("user_article_progress")
    .select("status, variant_id, quiz_score")
    .eq("user_id", userId)
    .eq("article_id", articleId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    status: data.status as "started" | "completed" | "saved",
    variantId: data.variant_id as number,
    quizScore: data.quiz_score as number | null,
  };
}

export type OpenArticleResult = { opened: true } | { opened: false; quota: QuotaState };

/** 최초 열람 기록과 차감을 함께 커밋한다. 같은 글의 재열람·수준 변경은 무료다. */
export async function openArticle(
  admin: SupabaseClient,
  userId: string,
  articleId: number,
  variantId: number,
): Promise<OpenArticleResult> {
  const { data, error } = await admin.rpc("open_article_with_quota", {
    p_user_id: userId, p_article_id: articleId, p_variant_id: variantId,
  });
  if (error) throw error;
  if (!data || typeof data.opened !== "boolean" || (!data.opened && !data.quota)) {
    throw new Error("Invalid article gate result");
  }
  return data as OpenArticleResult;
}
