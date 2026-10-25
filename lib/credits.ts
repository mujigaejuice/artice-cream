/** Credits attached to a grading response or a saved quiz result. */
import type { Equipped } from "./cosmetics";
export type CreditResult = {
  status: "granted" | "already_granted" | "not_eligible" | "disabled";
  newlyGranted: number;
  articleReward: { base: number; bonus: number; total: number };
  welcomeReward: number;
  balance: number;
  policyVersion: number;
};

export type CreditSnapshot = {
  userId: string;
  balance: number;
  policyVersion: number;
  earningMode: "inactive" | "active" | "paused";
  spendingEnabled: boolean;
  hasWelcome: boolean;
  rules: { article: number; quizBonusMax: number; welcome: number };
  ownedItems?: string[];
  equipped?: Equipped;
};

export type CreditEvent = {
  id: string;
  amount: number;
  reason: "article_read" | "quiz_bonus" | "welcome" | "purchase" | "adjustment";
  createdAt: string;
  articleId: string | null;
  articleTitle: string | null;
};

export type CreditHistoryPage = {
  userId: string;
  events: CreditEvent[];
  nextCursor: string | null;
};
