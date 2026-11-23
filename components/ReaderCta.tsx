"use client";

import Link from "next/link";

import { quizHref } from "@/lib/routes";

/**
 * 리더의 퀴즈 버튼. 휴대폰은 하단 고정 바, 노트북은 오른쪽 칸에 같은 것을 둔다.
 * 화면구성.md §5 — 세 상태로 갈린다. 재제출은 항상 복습이라(정책.md §7),
 * 저장까지 끝난 글은 퀴즈 CTA를 다시 보여주지 않는다.
 */
export function ReaderCta(props: {
  variantId: number;
  isOriginal?: boolean;
  progressStatus: "started" | "completed" | "saved";
  quizScore: number | null;
}) {
  if (props.progressStatus === "saved") {
    return (
      <div className="flex gap-2">
        <Link
          href={quizHref(props.variantId) + (props.isOriginal ? "&practice=1" : "")}
          className="flex-1 rounded-xl bg-stone-100 px-4 py-3 text-center text-sm font-medium text-stone-700 transition hover:bg-stone-200"
        >
          {props.isOriginal ? "퀴즈 다시 풀기" : `퀴즈 ${props.quizScore != null ? `${Math.round(props.quizScore * 100)}점` : ""} · 문항 다시 보기`}
        </Link>
      </div>
    );
  }
  return (
    <Link
      href={quizHref(props.variantId)}
      className="block w-full rounded-xl bg-stone-900 px-4 py-3 text-center font-medium text-white transition hover:bg-stone-800"
    >
      {props.progressStatus === "completed" ? "결과 보고 콘에 올리기" : "다 읽었어요 · 퀴즈 풀기"}
    </Link>
  );
}
