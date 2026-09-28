"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiJson } from "@/lib/client-api";
import { PROMOTE_AT, levelLabel } from "@/lib/level";
import type { QuizReviewItem } from "@/lib/supabase/types";

/** /api/quiz/grade의 응답 그대로. Quiz가 파싱 없이 넘기므로 모양이 일치해야 한다. */
export type GradeResult = {
  score: number;
  correct: number;
  total: number;
  review: QuizReviewItem[];
  prevLevel: number | null;
  newLevel: number | null;
  dir: "상승" | "유지" | "하강";
  rollingAccuracy: number | null;
  domain: string;
  domainLabel: string;
  articleId: number;
  /** 재제출(복습)이면 true — 점수는 이미 기록에 반영되지 않는다(정책.md §7). */
  isReview: boolean;
  sourceUrl: string;
};

/**
 * 점수, 문항 리뷰, 수준 변화. 첫 제출이면 "콘에 올리기"가 유일한 주 버튼이다
 * (정책.md §2) — 스쿱은 이 버튼을 눌러야 생긴다. 복습(재제출)이면 저장 버튼과
 * 수준 변화 뱃지를 감춘다(정책.md §7) — 이미 저장됐거나, 반영되지 않는 값이다.
 */
export function Result({
  result,
  articleTitle,
}: {
  result: GradeResult;
  articleTitle: string;
}) {
  const router = useRouter();
  const percent = Math.round(result.score * 100);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { scoopId } = await apiJson<{ scoopId?: number }>(
        "/api/progress/save",
        { method: "POST", body: JSON.stringify({ articleId: result.articleId }) },
      );
      setSaved(true);
      // 방금 올린 스쿱이 떨어지는 걸 콘 화면에서 보여 준다(화면구성.md §4-2).
      router.push(scoopId ? `/cone?new=${scoopId}` : "/cone");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장하지 못했어요");
      setSaving(false);
    }
  }

  return (
    <main className="pb-10">
      <section className="rounded-3xl bg-white p-6 text-center shadow-sm">
        {result.isReview && (
          <p className="mb-3 inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
            복습 · 기록에는 반영되지 않아요
          </p>
        )}

        <p className="text-sm text-stone-500">{articleTitle}</p>
        <p className="mt-3 text-4xl font-bold tabular-nums text-stone-900">
          {percent}점
        </p>
        <p className="mt-1 text-sm text-stone-600">
          {result.total}문제 중 {result.correct}개 정답
        </p>

        {!result.isReview && (
          <LevelNote
            prevLevel={result.prevLevel}
            newLevel={result.newLevel}
            dir={result.dir}
            rollingAccuracy={result.rollingAccuracy}
          />
        )}
      </section>

      <section className="mt-6" aria-labelledby="review-heading">
        <h2 id="review-heading" className="mb-3 text-sm font-semibold text-stone-700">
          문항 다시 보기
        </h2>

        <ul className="space-y-3">
          {result.review.map((item, index) => (
            <li
              key={item.questionId}
              className={`rounded-2xl border p-4 ${
                item.correct
                  ? "border-emerald-200 bg-emerald-50/60"
                  : "border-rose-200 bg-rose-50/60"
              }`}
            >
              <p className="text-sm font-medium text-stone-900">
                {index + 1}. {item.prompt}
              </p>

              <ul className="mt-2 space-y-1 text-sm">
                {item.options.map((choice, choiceIndex) => {
                  const isAnswer = choiceIndex === item.correct_index;
                  const isChosen = choiceIndex === item.picked;
                  if (!isAnswer && !isChosen) return null;

                  return (
                    <li
                      key={choiceIndex}
                      className={
                        isAnswer ? "text-emerald-800" : "text-rose-800 line-through"
                      }
                    >
                      {isAnswer ? "정답" : "내 답"}: {choice}
                    </li>
                  );
                })}
              </ul>

              {item.explanation && (
                <p className="mt-2 text-xs leading-relaxed text-stone-600">
                  {item.explanation}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-8 space-y-2">
        {result.isReview ? (
          <a
            href="/"
            className="block w-full rounded-xl bg-stone-900 px-4 py-3 text-center font-medium text-white"
          >
            홈으로
          </a>
        ) : (
          <button
            type="button"
            onClick={save}
            disabled={saving || saved}
            className="block w-full rounded-xl bg-stone-900 px-4 py-3 text-center font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
          >
            {saved ? "저장했어요 · 콘으로" : saving ? "저장 중…" : "콘에 올리기 🍦"}
          </button>
        )}
        <a
          href={result.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-xl bg-stone-100 px-4 py-3 text-center text-sm font-medium text-stone-700"
        >
          원문 보기 ↗
        </a>
      </div>
    </main>
  );
}

function LevelNote({
  prevLevel,
  newLevel,
  dir,
  rollingAccuracy,
}: {
  prevLevel: number | null;
  newLevel: number | null;
  dir: GradeResult["dir"];
  rollingAccuracy: number | null;
}) {
  if (prevLevel == null || newLevel == null) return null;

  if (dir !== "유지") {
    const up = dir === "상승";
    return (
      <p
        className={`mt-4 inline-block rounded-full px-3 py-1.5 text-sm font-medium ${
          up ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-900"
        }`}
      >
        {up ? "난이도가 올라갔어요" : "난이도를 조금 낮췄어요"} ·{" "}
        {levelLabel(prevLevel)} → {levelLabel(newLevel)}
      </p>
    );
  }

  // 정책.md §14 — 승급 규칙이 "4문제 중 3개를 세 번 연속"이라 설명 가능하니,
  // 다음 단계까지 얼마나 남았는지 보여 준다.
  if (rollingAccuracy != null && newLevel < 3) {
    return (
      <p className="mt-4 text-xs text-stone-500">
        이 분야 최근 3회 평균 {Math.round(rollingAccuracy * 100)}% ·{" "}
        {Math.round(PROMOTE_AT * 100)}%가 되면 Lv{newLevel + 1}
      </p>
    );
  }

  return null;
}
