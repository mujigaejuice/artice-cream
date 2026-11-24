"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { Result, type GradeResult } from "@/components/Result";
import { apiJson } from "@/lib/client-api";
import { canAutoFocus, digitChoice, isComposing, isPlainEnter } from "@/lib/keyboard";
import { readHref } from "@/lib/routes";
import type { PublicQuizQuestion } from "@/lib/supabase/types";
import { useLeaveGuard, useReadingProgress } from "@/components/ReadingExitNotice";

type Props = {
  variantId: number;
  articleTitle: string;
  /** Answers are not in here — grading is server-side. */
  questions: PublicQuizQuestion[];
  isOriginal?: boolean;
  isPractice?: boolean;
};

export function Quiz({ variantId, articleTitle, questions, isOriginal, isPractice }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useReadingProgress(!isPractice && result === null);
  useLeaveGuard(!isPractice && result === null);
  const promptId = useId();
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // 문항이 뜨면 고른 보기(없으면 첫 보기)로 포커스를 옮긴다 — 숫자 키와 Enter가 바로 먹는다.
  // 같은 문항 안에서 고를 때는 키 처리가 직접 옮긴다.
  useEffect(() => {
    if (!result && canAutoFocus()) optionRefs.current.find((node) => node?.tabIndex === 0)?.focus();
  }, [index, result]);

  if (result) {
    return <Result result={result} articleTitle={articleTitle} onRetry={isOriginal ? () => {
      setResult(null); setAnswers({}); setIndex(0); setBusy(false); setError(null);
    } : undefined} />;
  }

  const question = questions[index];
  const chosen = answers[question.id];
  const isLast = index === questions.length - 1;

  function choose(choiceIndex: number) {
    setAnswers({ ...answers, [question.id]: choiceIndex });
    optionRefs.current[choiceIndex]?.focus();
  }

  /** 보기 그룹에 포커스가 있을 때만: 숫자 키·화살표로 고르고 Enter로 넘긴다(WCAG 2.1.4). */
  function onOptionsKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    if (isComposing(event.nativeEvent)) return;
    const count = question.options.length;
    const digit = digitChoice(event.key, count);
    if (digit != null) {
      event.preventDefault();
      choose(digit);
      return;
    }
    const current = chosen ?? 0;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      choose(chosen == null ? 0 : (current + 1) % count);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      choose(chosen == null ? count - 1 : (current - 1 + count) % count);
      return;
    }
    if (isPlainEnter(event)) {
      // 버튼 기본 동작(클릭)으로 보기가 다시 눌리지 않게 막는다.
      event.preventDefault();
      // 누른 채로 반복되는 Enter로 문항을 건너뛰어 제출까지 가지 않게 한다 — 첫 제출이 수준을 정한다.
      if (event.repeat || chosen === undefined || busy) return;
      if (isLast) void submit();
      else setIndex(index + 1);
    }
  }

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
        {isOriginal && <p className="mb-3 text-xs text-stone-500">{isPractice ? "다시 풀기 · 기존 점수와 스쿱은 그대로예요" : "기초 퀴즈 · 수준에 영향을 주지 않아요"}</p>}
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

      <h1 id={promptId} className="text-lg font-semibold leading-snug text-stone-900">
        {question.prompt}
      </h1>

      <ul role="radiogroup" aria-labelledby={promptId} onKeyDown={onOptionsKeyDown} className="mt-5 space-y-2">
        {question.options.map((choice, choiceIndex) => {
          const selected = chosen === choiceIndex;
          return (
            <li key={choiceIndex} role="none">
              <button
                ref={(node) => { optionRefs.current[choiceIndex] = node; }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={choiceIndex === (chosen ?? 0) ? 0 : -1}
                onClick={() =>
                  setAnswers({ ...answers, [question.id]: choiceIndex })
                }
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
      <p className="mt-3 hidden text-xs text-stone-400 lg:block">
        숫자 키(1–{question.options.length})로 고르고 Enter로 넘어가요
      </p>

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
