"use client";

import Link from "next/link";

import { currentPlatform, modifierLabel } from "@/lib/keyboard";
import { quizHref } from "@/lib/routes";

type CtaTarget = { variantId: number; isOriginal?: boolean; progressStatus: "started" | "completed" | "saved" };

/** 퀴즈 버튼이 가는 곳. 리더의 ⌘/Ctrl+Enter도 같은 곳으로 간다. */
export function readerCtaHref({ variantId, isOriginal, progressStatus }: CtaTarget): string {
  return quizHref(variantId) + (progressStatus === "saved" && isOriginal ? "&practice=1" : "");
}

/** 노트북 오른쪽 칸에서만 쓰는 단축키 안내. 칸 자체가 마운트 뒤에 그려져서 플랫폼을 바로 읽어도 된다. */
function ShortcutHint() {
  return (
    <span aria-hidden="true" className="mt-1.5 hidden text-center text-[11px] text-stone-400 lg:block">
      {modifierLabel(currentPlatform())} Enter
    </span>
  );
}

const SHORTCUT = "Meta+Enter Control+Enter";

/**
 * 리더의 퀴즈 버튼. 휴대폰은 하단 고정 바, 노트북은 오른쪽 칸에 같은 것을 둔다.
 * 화면구성.md §5 — 세 상태로 갈린다. 재제출은 항상 복습이라(정책.md §7),
 * 저장까지 끝난 글은 퀴즈 CTA를 다시 보여주지 않는다.
 */
export function ReaderCta(props: CtaTarget & {
  quizScore: number | null;
  /** 오른쪽 칸(노트북)에서만 단축키 안내를 단다. */
  hint?: boolean;
}) {
  const href = readerCtaHref(props);
  if (props.progressStatus === "saved") {
    return (
      <>
      <div className="flex gap-2">
        <Link
          href={href}
          aria-keyshortcuts={SHORTCUT}
          className="flex-1 rounded-xl bg-stone-100 px-4 py-3 text-center text-sm font-medium text-stone-700 transition hover:bg-stone-200"
        >
          {props.isOriginal ? "퀴즈 다시 풀기" : `퀴즈 ${props.quizScore != null ? `${Math.round(props.quizScore * 100)}점` : ""} · 문항 다시 보기`}
        </Link>
      </div>
      {props.hint && <ShortcutHint />}
      </>
    );
  }
  return (
    <>
    <Link
      href={href}
      aria-keyshortcuts={SHORTCUT}
      className="block w-full rounded-xl bg-stone-900 px-4 py-3 text-center font-medium text-white transition hover:bg-stone-800"
    >
      {props.progressStatus === "completed" ? "결과 보고 콘에 올리기" : "다 읽었어요 · 퀴즈 풀기"}
    </Link>
    {props.hint && <ShortcutHint />}
    </>
  );
}
