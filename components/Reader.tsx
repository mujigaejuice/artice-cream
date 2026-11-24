"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { coreColor } from "@/lib/color";
import { levelShort } from "@/lib/level";
import { glossaryInOrder } from "@/lib/glossary-order";
import { isModalOpen, isPrimaryEnter } from "@/lib/keyboard";
import { useWideLayout } from "@/lib/use-wide-layout";
import type { Attribution, ReferenceLink } from "@/lib/content-rights";
import { useLeaveGuard, useReadingProgress } from "@/components/ReadingExitNotice";
import { BookmarkButton } from "@/components/BookmarkButton";
import { ReaderCta, readerCtaHref } from "@/components/ReaderCta";
import { ReaderRail } from "@/components/ReaderRail";

type GlossaryMap = Record<string, { term: string; definition: string }>;

export type ReaderProps = {
  variantId: number;
  articleId: number;
  level: number;
  title: string;
  /** 서버 생성 HTML. 용어는 이미 <mark data-w="wN">으로 감싸져 있다. */
  contentHtml: string;
  glossary: GlossaryMap;
  readingMinutes: number | null;
  domainSlug: string;
  domainLabel: string;
  sourceName: string | null;
  sourceUrl: string | null;
  isOriginal?: boolean;
  referenceLinks?: ReferenceLink[];
  attribution?: Attribution | null;
  /** 이 아티클을 어디까지 진행했는지 — 하단 CTA 분기의 기준(화면구성.md §5). */
  progressStatus: "started" | "completed" | "saved";
  /** progressStatus가 completed·saved일 때의 점수. */
  quizScore: number | null;
  /** 북마크 여부. 없으면(미리보기) 토글을 그리지 않는다. */
  bookmarked?: boolean;
};

/** 용어를 누르면 같은 줄 안에 뜻을 펼친다(행간 펼치기) — 별도 시트를 띄우지 않는다. */
function toggleInlineDefinition(mark: HTMLElement, term: string, definition: string) {
  const next = mark.nextElementSibling;
  if (next?.classList.contains("ac-def")) {
    next.remove();
    mark.setAttribute("aria-expanded", "false");
    return;
  }
  // 같은 문단 안의 다른 펼침을 먼저 접는다 — 한 번에 하나만.
  mark.closest("p")?.querySelectorAll(".ac-def").forEach((n) => n.remove());
  mark.closest("p")?.querySelectorAll('mark[aria-expanded="true"]').forEach((n) =>
    n.setAttribute("aria-expanded", "false"),
  );

  const span = document.createElement("span");
  span.className = "ac-def";
  span.textContent = `${term} — ${definition}`;
  mark.insertAdjacentElement("afterend", span);
  mark.setAttribute("aria-expanded", "true");
}

export function Reader(props: ReaderProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // 노트북에서는 용어를 본문에 펼치지 않고 오른쪽 칸 항목을 강조한다.
  const wide = useWideLayout();
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  const glossaryItems = useMemo(() => glossaryInOrder(props.contentHtml, props.glossary), [props.contentHtml, props.glossary]);
  useReadingProgress(props.progressStatus === "started");
  // 콘에 올리기 전(읽는 중·퀴즈만 끝냄)이면 나갈 때 묻는다.
  useLeaveGuard(props.progressStatus !== "saved");

  // 본문은 서버 HTML이라 붙일 React 노드가 없다. 위임 리스너 하나로 처리한다.
  useEffect(() => {
    const node = bodyRef.current;
    if (!node) return;

    function activate(target: EventTarget | null) {
      const mark = (target as HTMLElement | null)?.closest?.("mark[data-w]") as HTMLElement | null;
      const id = mark?.getAttribute("data-w");
      const entry = id ? props.glossary[id] : null;
      if (!mark || !id || !entry) return;
      if (wide) setActiveTerm((current) => (current === id ? null : id));
      else toggleInlineDefinition(mark, entry.term, entry.definition);
    }

    function onClick(event: MouseEvent) {
      activate(event.target);
    }
    function onKeyDown(event: KeyboardEvent) {
      // ⌘/Ctrl+Enter는 퀴즈로 가는 단축키다 — 용어를 펼치지 않고 창 리스너에 맡긴다.
      if (event.metaKey || event.ctrlKey) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate(event.target);
      }
    }

    node.addEventListener("click", onClick);
    node.addEventListener("keydown", onKeyDown);

    // 폭이 바뀌면 이전 방식의 펼침·강조를 모두 접고 시작한다.
    node.querySelectorAll(".ac-def").forEach((n) => n.remove());
    setActiveTerm(null);

    // HTML로 들어온 <mark>라 키보드로도 닿게 만들어 준다.
    for (const mark of node.querySelectorAll("mark[data-w]")) {
      mark.setAttribute("tabindex", "0");
      mark.setAttribute("role", "button");
      mark.setAttribute("aria-expanded", "false");
      mark.setAttribute("aria-label", `${mark.textContent} 뜻 ${wide ? "보기" : "펼치기"}`);
      if (wide) mark.setAttribute("aria-controls", `gloss-${mark.getAttribute("data-w")}`);
      else mark.removeAttribute("aria-controls");
    }

    return () => {
      node.removeEventListener("click", onClick);
      node.removeEventListener("keydown", onKeyDown);
    };
  }, [props.glossary, props.contentHtml, wide]);

  // ⌘/Ctrl+Enter: 어디서든 퀴즈 버튼과 같다. 조합키라 읽다가 실수로 넘어갈 일이 적다.
  const ctaHref = readerCtaHref(props);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat || !isPrimaryEnter(event) || isModalOpen()) return;
      // 링크 위의 ⌘/Ctrl+Enter는 브라우저의 "새 탭에서 열기"다 — 가로채지 않는다.
      if ((event.target as Element | null)?.closest?.("a[href]")) return;
      event.preventDefault();
      router.push(ctaHref);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, ctaHref]);

  // 노트북: 강조된 용어만 펼친 상태로 알린다.
  useEffect(() => {
    const node = bodyRef.current;
    if (!node || !wide) return;
    for (const mark of node.querySelectorAll("mark[data-w]")) {
      mark.setAttribute("aria-expanded", mark.getAttribute("data-w") === activeTerm ? "true" : "false");
    }
  }, [activeTerm, wide]);

  // 정책.md §8 — 원문으로 가는 문은 리더 어디서든 보여야 한다(머리말 또는 오른쪽 칸 + 하단).
  const actions = <>
    {props.bookmarked !== undefined && (
      <BookmarkButton key={`${props.articleId}:${props.bookmarked}`} articleId={props.articleId} initialBookmarked={props.bookmarked} />
    )}
    {props.sourceUrl && !props.isOriginal && <a
      href={props.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 text-sm font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline"
    >
      원문 읽기 ↗
    </a>}
  </>;
  const ctaProps = { variantId: props.variantId, isOriginal: props.isOriginal,
    progressStatus: props.progressStatus, quizScore: props.quizScore };
  const cta = <ReaderCta {...ctaProps} />;

  return (
    <main className="pb-28 lg:grid lg:grid-cols-[minmax(0,680px)_240px] lg:justify-center lg:gap-12 lg:pb-16">
      <div className="min-w-0">
      <header className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-700">
            ← 홈
          </Link>
          {!wide && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: coreColor(props.domainSlug) }}
            aria-hidden="true"
          />
          <span className="font-medium text-stone-600">{props.domainLabel}</span>
          <span className="text-stone-400">·</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-600">
            {props.isOriginal ? "Original · 기초" : levelShort(props.level)}
          </span>
          {props.readingMinutes != null && (
            <>
              <span className="text-stone-400">·</span>
              <span className="text-stone-500">{props.readingMinutes}분</span>
            </>
          )}
        </div>

        <h1 className="mt-2 text-2xl font-bold leading-snug tracking-tight text-stone-900">
          {props.title}
        </h1>
      </header>

      <div
        ref={bodyRef}
        className="prose-article text-[17px] text-stone-800"
        dangerouslySetInnerHTML={{ __html: props.contentHtml }}
      />

      {/* 출처 표기는 선택이 아니다 — spec §11.1 저작권 완화책 (a). */}
      <footer className="mt-10 border-t border-stone-200 pt-4 text-xs text-stone-500">
        {props.isOriginal ? <div className="space-y-3 leading-relaxed">
          <p className="font-medium text-stone-700">artice cream Original</p>
          <p>AI의 도움으로 구성·집필하고 사실 근거와 문항을 점검한 기초 콘텐츠예요. 모든 읽기 수준에서 같은 본문으로 학습해요.</p>
          <p>기초 퀴즈는 수준에 영향을 주지 않아요. 콘에 올린 뒤에도 횟수 제한 없이 복습할 수 있어요.</p>
          <div><p className="font-medium text-stone-700">사실 확인에 참고한 자료</p>
            <ul className="mt-2 space-y-2">{props.referenceLinks?.map(ref => <li key={ref.url}>
              <a href={ref.url} target="_blank" rel="noopener noreferrer" className="underline">{ref.title} ↗</a>
              <span className="ml-2">확인 {ref.checkedAt.slice(0,10)}</span>
            </li>)}</ul>
          </div>
        </div> : <>
        {props.attribution && <div className="mb-3 space-y-1 leading-relaxed">
          <p>원제: {props.attribution.originalTitle}</p>
          <p>저자: {props.attribution.author}</p>
          <p>이용 조건: <a href={props.attribution.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">{props.attribution.licenseLabel}</a></p>
          <p>변경: {props.attribution.changes}</p>
          {props.attribution.notices && <p className="whitespace-pre-wrap">{props.attribution.notices}</p>}
        </div>}
        <p>
          이 글은 {props.sourceName && (
            <strong className="font-medium">{props.sourceName}</strong>
          )}
          의 글을 한국어 읽기 수준에 맞게 재구성하고 용어 설명·퀴즈를 덧붙였습니다.
          원 발행처의 승인이나 보증을 의미하지 않습니다.
        </p>
        {props.sourceUrl && <a
          href={props.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block font-medium text-stone-700 underline"
        >
          원문 보기 ↗
        </a>}
        </>}
      </footer>

      </div>

      {wide ? (
        <ReaderRail items={glossaryItems} activeId={activeTerm} cta={<ReaderCta {...ctaProps} hint />} actions={actions} />
      ) : (
        <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-[#faf7f2]/95 backdrop-blur">
          <div
            className="mx-auto w-full max-w-lg px-4 pt-3"
            style={{
              paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {cta}
          </div>
        </div>
      )}
    </main>
  );
}
