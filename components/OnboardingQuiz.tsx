"use client";

import { useState } from "react";

import { coreColor } from "@/lib/color";
import type { PublicQuizQuestion } from "@/lib/onboarding-quiz";
import type { DomainRow } from "@/lib/supabase/types";

/**
 * 한 분야의 레벨 퀴즈. 풀이 중에는 정오를 보여 주지 않는다 — 채점은 서버가 하고,
 * 이 화면은 답만 모은다. "모르겠어요"는 null로 넘긴다(오답으로 센다).
 */

const UNSURE = "unsure";

export function OnboardingQuiz({
  domain,
  questions,
  position,
  onDone,
  onSkip,
}: {
  domain: DomainRow;
  questions: PublicQuizQuestion[];
  position: { index: number; total: number };
  onDone: (answers: (number | null)[]) => void;
  onSkip: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [choice, setChoice] = useState<number | typeof UNSURE | null>(null);
  const question = questions[step];

  function next() {
    if (choice === null) return;
    const all = [...answers, choice === UNSURE ? null : choice];
    if (step + 1 >= questions.length) {
      onDone(all);
      return;
    }
    setAnswers(all);
    setChoice(null);
    setStep(step + 1);
  }

  return (
    <main>
      <p className="flex items-center gap-2 text-sm text-stone-600">
        <span className="inline-block h-3 w-3 rounded-full" style={{ background: coreColor(domain.slug) }} aria-hidden="true" />
        <span className="font-medium text-stone-900">{domain.name_ko}</span>
        <span>· {position.index + 1} / {position.total} 분야</span>
      </p>
      <div className="mt-3 flex items-center gap-3">
        <progress className="h-1.5 flex-1 accent-stone-900" max={questions.length} value={step + 1}
          aria-label="문항 진행" />
        <span className="text-sm tabular-nums text-stone-600">{step + 1} / {questions.length}</span>
      </div>

      {/* key: 문항이 바뀌면 라디오 선택이 남지 않게 새로 그린다. */}
      <fieldset key={step} className="mt-6">
        <legend className="text-lg font-bold tracking-tight text-stone-900">{question.prompt}</legend>
        <div className="mt-4 space-y-2">
          {[...question.options.map((label, i) => ({ value: i as number | typeof UNSURE, label })),
            { value: UNSURE as number | typeof UNSURE, label: "모르겠어요" }].map(({ value, label }) => (
            <label key={String(value)}
              className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                choice === value ? "border-stone-900 bg-stone-50" : "border-stone-300 bg-white"
              } ${value === UNSURE ? "text-stone-600" : "text-stone-900"}`}>
              <input type="radio" name={`quiz-${step}`} checked={choice === value} onChange={() => setChoice(value)}
                className="h-4 w-4 accent-stone-900" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="button" onClick={next} disabled={choice === null}
        className="mt-6 w-full rounded-xl bg-stone-900 px-4 py-3 font-medium text-white transition hover:bg-stone-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">
        다음
      </button>
      <button type="button" onClick={onSkip}
        className="mt-3 min-h-12 w-full rounded-xl px-4 py-3 text-sm text-stone-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">
        이 분야 건너뛰기
      </button>
    </main>
  );
}
