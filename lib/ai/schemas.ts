// lib/ai/schemas.ts
// 각 LLM 콜 출력에 대한 Zod 스키마 + 추론 타입.
// 파서(pipeline.ts)가 이 스키마로 safeParse → 실패 시 리페어 1회.

import { z } from "zod";

import { QUIZ_QUESTIONS } from "../policy";

/** 사용자 수준: 1 초급 / 2 중급 / 3 고급 */
export type Level = 1 | 2 | 3;
export const LevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

/*
 * 1) 재작성 — summary는 정책.md §13. 주문서 카드에 쓰는 요약이지 본문이 아니다.
 * keyParagraphs는 plan.md phase6 §3 "중요 대목 하이라이트" — 문단 인덱스로 받아
 * 코드가 마킹한다(LLM이 HTML을 직접 쓰게 하면 본문 무결성이 깨진다).
 */
export const RewriteSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  paragraphs: z.array(z.string().trim().min(1)).min(1),
  keyParagraphs: z.array(z.number().int().min(0)).max(2).default([]),
});
export type Rewrite = z.infer<typeof RewriteSchema>;

/* 2) 용어 — surface/definition만. 마킹은 코드에서(pipeline.markTerms). */
export const GlossaryTermSchema = z.object({
  surface: z.string().trim().min(1),
  definition: z.string().trim().min(1),
});
export const GlossarySchema = z.object({
  terms: z.array(GlossaryTermSchema).default([]),
});
export type Glossary = z.infer<typeof GlossarySchema>;
export type GlossaryTerm = z.infer<typeof GlossaryTermSchema>;

/* 3) 퀴즈 — 스키마 단에서 구조적 제약을 강하게 건다 */
export const QuizQuestionSchema = z
  .object({
    prompt: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).length(4), // 보기 정확히 4개
    correct_index: z.number().int().min(0).max(3), // 0~3
    explanation: z.string().trim().min(1),
  })
  .refine((q) => new Set(q.options).size === 4, {
    message: "보기 4개는 서로 달라야 합니다",
    path: ["options"],
  });
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizSchema = z.object({
  questions: z.array(QuizQuestionSchema).length(QUIZ_QUESTIONS), // 정책.md §5: 수준과 무관하게 고정
});
export type Quiz = z.infer<typeof QuizSchema>;

/* 4) 분류 — 후보 묶음을 소스분류.md §1의 여덟 분류로 나눈다 */
export const CATEGORY_SLUGS = [
  "cloud",
  "infra",
  "data",
  "cs-fundamentals",
  "deep-learning",
  "llm",
  "ai-security",
  "security",
] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const ClassifyLabelSchema = z.enum([...CATEGORY_SLUGS, "reject"]);
export type ClassifyLabel = z.infer<typeof ClassifyLabelSchema>;

export const ClassifySchema = z.object({
  items: z.array(
    z.object({
      i: z.number().int().min(0),
      category: ClassifyLabelSchema,
    }),
  ),
});
export type Classify = z.infer<typeof ClassifySchema>;

/* 최종 조립 결과 (spec: article_variants 1행에 대응) */
export interface ProcessedVariant {
  level: Level;
  // 수준별로 다듬어진 제목. spec §8 DDL에는 빠져 있지만 재작성 콜이 실제로
  // 생성하고 리더가 쓰므로 article_variants.title 컬럼을 추가해 저장한다.
  title: string;
  // 정책.md §13 — 주문서 카드에 쓰는 2~3문장 요약. 본문과 별개로 저장한다.
  summary: string;
  content_html: string; // <mark data-w="..">..</mark> 삽입된 본문
  glossary: Record<string, { term: string; definition: string }>;
  reading_minutes: number;
  quiz: QuizQuestion[];
}
