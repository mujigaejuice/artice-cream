"use client";

import type { DomainTerms } from "@/lib/terms";

/**
 * 정책.md §15 — 자가 선택 대신 용어 체크로 초기 수준을 정한다. 쉬운 축과 드문
 * 축을 섞어 보여 주고 "아는 것만 고르세요"로 받는다. 판정은 부모(OnboardingFlow)가
 * 드문 축 체크 개수로 계산한다(lib/terms.ts levelFromTermCheck).
 *
 * 아직 이 분야의 용어가 쌓이지 않았으면(terms가 비어 있으면) 아무것도 렌더링하지
 * 않는다 — 부모가 기본값(Lv2)을 그대로 쓴다.
 */

export function TermCheck({
  terms,
  checkedRare,
  checkedEasy,
  onToggle,
}: {
  terms: DomainTerms;
  checkedRare: Set<string>;
  checkedEasy: Set<string>;
  onToggle: (term: string, tier: "easy" | "rare") => void;
}) {
  const all = [
    ...terms.easy.map((term) => ({ term, tier: "easy" as const })),
    ...terms.rare.map((term) => ({ term, tier: "rare" as const })),
  ];

  if (all.length === 0) return null;

  return (
    <div>
      <p className="text-xs text-stone-500">아는 용어만 골라 주세요 — 안 골라도 넘어갈 수 있어요.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {all.map(({ term, tier }) => {
          const checked = tier === "easy" ? checkedEasy.has(term) : checkedRare.has(term);
          return (
            <button
              key={`${tier}-${term}`}
              type="button"
              aria-pressed={checked}
              onClick={() => onToggle(term, tier)}
              className={`rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800 ${
                checked
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
              }`}
            >
              {term}
            </button>
          );
        })}
      </div>
    </div>
  );
}
