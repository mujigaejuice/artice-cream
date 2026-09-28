import Link from "next/link";

import { coreColor } from "@/lib/color";
import type { TodayPick } from "@/lib/feed";
import { levelShort } from "@/lib/level";
import { quizHref, readHref } from "@/lib/routes";

type Props = {
  pick: TodayPick;
  /** false면 카드는 보이되 열리지 않는다 — 오늘 분량을 다 썼다는 뜻. */
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
  const yearNote = publishYearNote(pick.publishedAt);

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: coreColor(pick.domain.slug) }}
          aria-hidden="true"
        />
        <span className="font-medium text-stone-600">{pick.domain.name_ko}</span>
        <span className="text-stone-400">·</span>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-600">
          {levelShort(pick.level)}
        </span>
        {pick.readingMinutes != null && (
          <>
            <span className="text-stone-400">·</span>
            <span className="text-stone-500">{pick.readingMinutes}분</span>
          </>
        )}
        {yearNote && (
          <>
            <span className="text-stone-400">·</span>
            <span className="text-stone-500">{yearNote}</span>
          </>
        )}
        {pick.completedNotSaved && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
            퀴즈 완료 · 저장 안 함
          </span>
        )}
      </div>

      <h3 className="mt-2 text-base font-semibold leading-snug text-stone-900">
        {pick.title}
      </h3>

      {/* 정책.md §13 — 고르기 전에 무엇인지 알아야 고를 수 있다. */}
      {pick.summary && (
        <p className="mt-1.5 line-clamp-3 text-sm text-stone-600">{pick.summary}</p>
      )}

      {pick.sourceName && (
        <p className="mt-1.5 truncate text-xs text-stone-500">{pick.sourceName}</p>
      )}
    </>
  );

  // 저장 안 한 글은 쿼터를 다시 쓰지 않고 결과 화면으로 바로 간다(정책.md §13).
  const href = pick.completedNotSaved
    ? quizHref(pick.variantId)
    : readHref(pick.variantId);

  if (!unlocked && !pick.completedNotSaved) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 opacity-70">
        {body}
        <p className="mt-3 text-xs font-medium text-stone-500">
          오늘의 무료 1편을 다 읽었어요 · 광고를 보면 한 편 더
        </p>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-stone-300 hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
    >
      {body}
    </Link>
  );
}
