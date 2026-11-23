"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";

import { coreColor } from "@/lib/color";
import type { TodayPick } from "@/lib/feed";
import { levelShort } from "@/lib/level";
import { quizHref, readHref } from "@/lib/routes";

type Props = {
  pick: TodayPick;
  /** 새 글을 열 수 있는지. 이미 연 글은 남은 횟수와 관계없이 이어 읽는다. */
  unlocked: boolean;
};

const CURRENT_YEAR = new Date().getFullYear();

/** 아카이브 글(소스분류.md §2)이 오늘 글처럼 보이면 안 된다. */
function publishYearNote(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  const year = new Date(publishedAt).getFullYear();
  return year > 0 && year !== CURRENT_YEAR ? `${year}년 글` : null;
}

export function ArticleCard({ pick, unlocked }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const yearNote = publishYearNote(pick.publishedAt);

  // 노트북(lg)에서는 한 장의 DOM을 CSS 격자로 다시 놓는다: 왼쪽 분야·수준, 가운데 제목·요약, 오른쪽 읽는 시간.
  // 휴대폰에서는 감싼 요소가 모두 contents라 지금 flex 배치 그대로다.
  const body = (
    <div className="lg:grid lg:grid-cols-[8.5rem_minmax(0,1fr)_auto] lg:gap-x-6 lg:gap-y-1">
      <div className="flex flex-wrap items-center gap-2 text-xs lg:contents">
        <span className="contents lg:col-start-1 lg:row-start-1 lg:flex lg:items-center lg:gap-2">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: coreColor(pick.domain.slug) }}
            aria-hidden="true"
          />
          <span className="font-medium text-stone-600">{pick.domain.name_ko}</span>
        </span>
        <span className="text-stone-400 lg:hidden">·</span>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-600 lg:col-start-1 lg:row-start-2 lg:self-start lg:justify-self-start">
          {pick.isOriginal ? `Original · 기초 ${pick.foundationOrder ?? ""}` : levelShort(pick.level)}
        </span>
        {pick.readingMinutes != null && (
          <>
            <span className="text-stone-400 lg:hidden">·</span>
            <span className="text-stone-500 lg:col-start-3 lg:row-start-1 lg:justify-self-end">
              {pick.readingMinutes}분<span className="hidden lg:inline" aria-hidden="true"> →</span>
            </span>
          </>
        )}
        <span className="contents lg:col-start-2 lg:row-start-1 lg:flex lg:flex-wrap lg:gap-2">
          {yearNote && (
            <>
              <span className="text-stone-400 lg:hidden">·</span>
              <span className="text-stone-500">{yearNote}</span>
            </>
          )}
          {pick.completedNotSaved && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
              퀴즈 완료 · 저장 안 함
            </span>
          )}
          {pick.isOriginal && pick.progressStatus === "saved" && <span className="text-emerald-700">쌓은 기초 · 복습 가능</span>}
          {pick.progressStatus === "started" && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">읽는 중 · 이어 읽기</span>}
        </span>
      </div>

      <h3 className="mt-2 text-base font-semibold leading-snug text-stone-900 lg:col-start-2 lg:row-start-2 lg:mt-0">
        {pick.title}
      </h3>

      {/* 정책.md §13 — 고르기 전에 무엇인지 알아야 고를 수 있다. */}
      {pick.summary && (
        <p className="mt-1.5 line-clamp-3 text-sm text-stone-600 lg:col-start-2 lg:line-clamp-2">{pick.summary}</p>
      )}

      {pick.sourceName && (
        <p className="mt-1.5 truncate text-xs text-stone-500 lg:col-start-2">{pick.sourceName}</p>
      )}
    </div>
  );

  // 저장 안 한 글은 쿼터를 다시 쓰지 않고 결과 화면으로 바로 간다(정책.md §13).
  const href = pick.completedNotSaved
    ? quizHref(pick.variantId)
    : readHref(pick.variantId);

  if (!unlocked && !pick.completedNotSaved && !pick.progressStatus) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 opacity-70">
        {body}
        <p className="mt-3 text-xs font-medium text-stone-500 lg:ml-[10rem]">
          오늘의 무료 1편을 다 읽었어요 · 광고를 보면 한 편 더
        </p>
      </div>
    );
  }

  // 처음 여는 글만 묻는다 — 열면 오늘의 읽기 횟수를 쓴다. 이어 읽기·복습은 바로 연다.
  const isNewOpen = !pick.completedNotSaved && !pick.progressStatus;

  return (
    <>
    <Link
      href={href}
      onClick={isNewOpen ? (event) => { event.preventDefault(); setConfirming(true); } : undefined}
      className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-stone-300 hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
    >
      {body}
    </Link>
    {confirming && <ConfirmDialog
      title="이 기사를 정말 읽을까요?"
      description="읽기 시작하면 오늘 읽을 수 있는 횟수를 1회 써요."
      cancelLabel="취소"
      confirmLabel="읽을게요"
      onCancel={() => setConfirming(false)}
      onConfirm={() => { setConfirming(false); router.push(href); }}
    />}
    </>
  );
}
