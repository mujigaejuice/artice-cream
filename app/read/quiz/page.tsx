"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Quiz } from "@/components/Quiz";
import { Result, type GradeResult } from "@/components/Result";
import { PageError, PageLoading } from "@/components/ScreenState";
import { apiJson } from "@/lib/client-api";
import type { PublicQuizQuestion } from "@/lib/supabase/types";
import { useQueryParams } from "@/lib/use-query";
import { useRefreshOnResume } from "@/lib/use-refresh-on-resume";

/**
 * 퀴즈 (plan §5, 정책.md §7). 경로는 `/read/quiz?v=123` (앱출시.md §2).
 *
 * 정답은 채점 전에 내려오지 않는다 — `/api/quiz`가 `correct_index`와 설명을
 * 깎아서 준다. 이미 completed·saved까지 끝낸 아티클이면 같은 엔드포인트가
 * 퀴즈 대신 결과를 조립해 주므로, 여기서는 그걸 그대로 그린다(재채점 없음).
 */

type QuizData =
  | {
      mode: "quiz";
      articleTitle: string;
      variantId: number;
      questions: PublicQuizQuestion[];
    }
  | { mode: "result"; articleTitle: string; result: GradeResult };

export default function QuizPage() {
  const router = useRouter();
  const query = useQueryParams();
  const [data, setData] = useState<QuizData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const variantId = query?.get("v") ?? null;

  const load = useCallback(() => {
    if (!variantId) return;
    setError(null);
    setData(null);
    apiJson<QuizData>(`/api/quiz?v=${encodeURIComponent(variantId)}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [variantId]);

  useEffect(load, [load]);
  useRefreshOnResume(load);

  useEffect(() => {
    if (error === "unauthenticated") router.replace("/onboarding");
  }, [error, router]);

  if (query && !variantId) return <NoQuiz />;
  if (error === "not found" || error === "no questions") return <NoQuiz />;
  if (error) return <PageError message={error} onRetry={load} />;
  if (!data) return <PageLoading label="퀴즈를 불러오고 있어요" />;

  if (data.mode === "result") {
    return <Result result={data.result} articleTitle={data.articleTitle} />;
  }

  return (
    <Quiz
      variantId={data.variantId}
      articleTitle={data.articleTitle}
      questions={data.questions}
    />
  );
}

function NoQuiz() {
  return (
    <main className="py-16 text-center">
      <h1 className="text-lg font-semibold text-stone-900">
        퀴즈를 찾지 못했어요
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        주소가 잘못됐거나 문항이 아직 준비되지 않았어요.
      </p>
      <a
        href="/"
        className="mt-6 inline-block rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white"
      >
        오늘의 아티클로
      </a>
    </main>
  );
}
