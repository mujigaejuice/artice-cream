import type { QuizQuestion } from "@/lib/ai/schemas";
import type { ArticleRights } from "@/lib/content-rights";

/** supabase/migrations/0001_init.sql 행 타입 (spec §8). */

export type DomainRow = {
  id: number;
  slug: string;
  name_ko: string;
  name_en: string | null;
  rss_topic: string | null;
  active: boolean;
};

export type ArticleRow = ArticleRights & {
  id: number;
  /** 분류에서 버린(rejected) 후보는 도메인이 없다. */
  domain_id: number | null;
  source: string | null;
  source_url: string;
  title: string | null;
  author: string | null;
  image_url: string | null;
  original_text: string | null;
  published_at: string | null;
  fetched_at: string;
  /**
   * pending은 분류를 통과하고 가공을 기다리는 후보다(인제스트 1단계 → 2단계 대기열).
   * expired는 그 대기열에서 너무 오래 묵어 걷어낸 것. 홈 주문서는 ready만 본다.
   */
  status: "pending" | "ready" | "extract_failed" | "paywalled" | "rejected" | "expired";
};

export type ArticleVariantRow = {
  id: number;
  article_id: number;
  level: number;
  title: string;
  /** 정책.md §13 — 주문서 카드용 2~3문장 요약. */
  summary: string | null;
  content_html: string;
  /** { "w3": { term, definition } } — content_html의 <mark data-w>와 짝을 이룬다. */
  glossary: Record<string, { term: string; definition: string }>;
  reading_minutes: number | null;
  model: string | null;
  created_at: string;
};

export type QuizQuestionRow = {
  id: number;
  variant_id: number;
  position: number;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

/** 정책.md §15 — 온보딩 용어 체크에 쓰는 분야별 용어 목록. tier: 'easy' | 'rare'. */
export type DomainTermRow = {
  domain_id: number;
  term: string;
  tier: "easy" | "rare";
};

/** 클라이언트에 내려도 되는 형태 — correct_index와 explanation을 뗀 것. */
export type PublicQuizQuestion = Pick<
  QuizQuestionRow,
  "id" | "position" | "prompt" | "options"
>;

export type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  created_at: string;
};

export type UserDomainLevelRow = {
  user_id: string;
  domain_id: number;
  level: number;
  rolling_accuracy: number;
  quizzes_taken: number;
  recent_scores: number[];
  updated_at: string;
};

/** 정책.md §2 — started(쿼터 소모) → completed(채점 끝) → saved(콘에 올림). */
export type ProgressStatus = "started" | "completed" | "saved";

export type UserArticleProgressRow = {
  id: number;
  user_id: string;
  /** 정책.md §2 — 스쿱·쿼터·재열람 게이트의 단위는 variant가 아니라 article이다. */
  article_id: number;
  variant_id: number;
  status: ProgressStatus;
  quiz_score: number | null;
  quiz_answers: Record<string, number> | null;
  started_at: string;
  completed_at: string | null;
  saved_at: string | null;
};

export type DailyQuotaRow = {
  user_id: string;
  quota_date: string;
  free_used: boolean;
  ad_unlocks: number;
};

export type AdViewRow = {
  id: number;
  user_id: string;
  provider: string | null;
  reward_verified: boolean;
  unlocked_variant_id: number | null;
  nonce: string | null;
  created_at: string;
};

/** 채점 결과의 문항 리뷰 한 줄 (Result 화면). */
export type QuizReviewItem = {
  questionId: number;
  prompt: string;
  options: string[];
  picked: number | null;
  correct_index: number;
  correct: boolean;
  explanation: string | null;
};

export type { QuizQuestion };
