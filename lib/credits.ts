/** Credits attached to a grading response or a saved quiz result. */
import type { Equipped, ScoopColors } from "./cosmetics";
export type CreditResult = {
  status: "granted" | "already_granted" | "not_eligible" | "disabled";
  newlyGranted: number;
  articleReward: { base: number; bonus: number; total: number };
  welcomeReward: number;
  /** 이 완료로 받은 스트릭 보상. 스트릭 도입 전 서버 응답에는 없다. */
  streakReward?: number;
  balance: number;
  policyVersion: number;
};

export type CreditSnapshot = {
  userId: string;
  balance: number;
  spendableBalance: number;
  policyVersion: number;
  earningMode: "inactive" | "active" | "paused";
  spendingEnabled: boolean;
  hasWelcome: boolean;
  rules: { article: number; quizBonusMax: number; welcome: number };
  /** 크레딧정책.md P4. days는 오늘·어제(KST)까지 이어진 연속 학습일이다. */
  streak: CreditStreak;
  ownedItems?: string[];
  equipped?: Equipped;
  scoopColors?: ScoopColors;
};

export type CreditStreak = {
  enabled: boolean;
  days: number;
  reward: number;
  blockDays: number;
  daysUntilReward: number;
};

export type CreditEvent = {
  id: string;
  amount: number;
  reason: "article_read" | "quiz_bonus" | "welcome" | "streak" | "purchase" | "adjustment";
  createdAt: string;
  articleId: string | null;
  articleTitle: string | null;
};

export type CreditHistoryPage = {
  userId: string;
  events: CreditEvent[];
  nextCursor: string | null;
};
