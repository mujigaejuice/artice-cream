"use client";

import Link from "next/link";
import { useState } from "react";

import { Result, type GradeResult } from "@/components/Result";
import { apiJson } from "@/lib/client-api";
import { readHref } from "@/lib/routes";
import type { PublicQuizQuestion } from "@/lib/supabase/types";

type Props = {
  variantId: number;
  articleTitle: string;
  /** Answers are not in here — grading is server-side. */
  questions: PublicQuizQuestion[];
};

export function Quiz({ variantId, articleTitle, questions }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (result) {
    return <Result result={result} articleTitle={articleTitle} />;
  }

  const question = questions[index];
  const chosen = answers[question.id];
  const isLast = index === questions.length - 1;

  async function submit() {
    setBusy(true);
    setError(null);

    try {
      setResult(
        await apiJson<GradeResult>("/api/quiz/grade", {
          method: "POST",
          body: JSON.stringify({ variantId, answers }),
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "채점에 실패했어요");
      setBusy(false);
    }
  }

  return (
    <main>
      <header className="mb-6">
        <Link
          href={readHref(variantId)}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          ← 다시 읽기
        </Link>

        <div className="mt-4 flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200"
            role="progressbar"
            aria-valuenow={index + 1}
            aria-valuemin={1}
            aria-valuemax={questions.length}
            aria-label="퀴즈 진행"
          >
            <div
              className="h-full rounded-full bg-stone-900 transition-[width] duration-300"
              style={{ width: `${((index + 1) / questions.length) * 100}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-stone-500">
            {index + 1}/{questions.length}
          </span>
        </div>
      </header>

      <h1 className="text-lg font-semibold leading-snug text-stone-900">
        {question.prompt}
      </h1>

      <ul className="mt-5 space-y-2">
        {question.options.map((choice, choiceIndex) => {
          const selected = chosen === choiceIndex;
          return (
            <li key={choiceIndex}>
              <button
                type="button"
                onClick={() =>
                  setAnswers({ ...answers, [question.id]: choiceIndex })
                }
                aria-pressed={selected}
                className={`w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] leading-relaxed transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800 ${
                  selected
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200 bg-white text-stone-800 hover:border-stone-300"
                }`}
              >
                {choice}
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex(index - 1)}
            className="rounded-xl bg-stone-100 px-4 py-3 text-sm font-medium text-stone-700"
          >
            이전
          </button>
        )}
        <button
          type="button"
          disabled={chosen === undefined || busy}
          onClick={() => (isLast ? submit() : setIndex(index + 1))}
          className="flex-1 rounded-xl bg-stone-900 px-4 py-3 font-medium text-white transition hover:bg-stone-800 disabled:opacity-40"
        >
          {busy ? "채점 중…" : isLast ? "제출하기" : "다음"}
        </button>
      </div>
    </main>
  );
}
