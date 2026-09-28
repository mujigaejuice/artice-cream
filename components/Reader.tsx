"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { coreColor } from "@/lib/color";
import { levelShort } from "@/lib/level";
import { quizHref } from "@/lib/routes";

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
  sourceUrl: string;
  /** 이 아티클을 어디까지 진행했는지 — 하단 CTA 분기의 기준(화면구성.md §5). */
  progressStatus: "started" | "completed" | "saved";
  /** progressStatus가 completed·saved일 때의 점수. */
  quizScore: number | null;
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

  // 본문은 서버 HTML이라 붙일 React 노드가 없다. 위임 리스너 하나로 처리한다.
  useEffect(() => {
    const node = bodyRef.current;
    if (!node) return;

    function activate(target: EventTarget | null) {
      const mark = (target as HTMLElement | null)?.closest?.("mark[data-w]") as HTMLElement | null;
      const id = mark?.getAttribute("data-w");
      const entry = id ? props.glossary[id] : null;
      if (mark && entry) toggleInlineDefinition(mark, entry.term, entry.definition);
    }

    function onClick(event: MouseEvent) {
      activate(event.target);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate(event.target);
      }
    }

    node.addEventListener("click", onClick);
    node.addEventListener("keydown", onKeyDown);

    // HTML로 들어온 <mark>라 키보드로도 닿게 만들어 준다.
    for (const mark of node.querySelectorAll("mark[data-w]")) {
      mark.setAttribute("tabindex", "0");
      mark.setAttribute("role", "button");
      mark.setAttribute("aria-expanded", "false");
      mark.setAttribute("aria-label", `${mark.textContent} 뜻 펼치기`);
    }

    return () => {
      node.removeEventListener("click", onClick);
      node.removeEventListener("keydown", onKeyDown);
    };
  }, [props.glossary, props.contentHtml]);

  return (
    <main className="pb-28">
      <header className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-700">
            ← 홈
          </Link>
          {/* 정책.md §8 — 원문으로 가는 문은 리더 어디서든 보여야 한다(헤더 + 하단). */}
          <a
            href={props.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-sm font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline"
          >
            원문 읽기 ↗
          </a>
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
            {levelShort(props.level)}
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
        <p>
          이 글은 {props.sourceName && (
            <strong className="font-medium">{props.sourceName}</strong>
          )}
          의 보도를 바탕으로 읽기 수준에 맞게 다시 쓴 것입니다.
        </p>
        <a
          href={props.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block font-medium text-stone-700 underline"
        >
          원문 보기 ↗
        </a>
      </footer>

      <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-[#faf7f2]/95 backdrop-blur">
        <div
          className="mx-auto w-full max-w-lg px-4 pt-3"
          style={{
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* 화면구성.md §5 — 세 상태로 갈린다. 재제출은 항상 복습이라(정책.md §7),
              저장까지 끝난 글은 퀴즈 CTA를 다시 보여주지 않는다. */}
          {props.progressStatus === "saved" ? (
            <div className="flex gap-2">
              <Link
                href={quizHref(props.variantId)}
                className="flex-1 rounded-xl bg-stone-100 px-4 py-3 text-center text-sm font-medium text-stone-700 transition hover:bg-stone-200"
              >
                퀴즈 {props.quizScore != null ? `${Math.round(props.quizScore * 100)}점` : ""} · 문항 다시 보기
              </Link>
            </div>
          ) : props.progressStatus === "completed" ? (
            <Link
              href={quizHref(props.variantId)}
              className="block w-full rounded-xl bg-stone-900 px-4 py-3 text-center font-medium text-white transition hover:bg-stone-800"
            >
              결과 보고 콘에 올리기
            </Link>
          ) : (
            <Link
              href={quizHref(props.variantId)}
              className="block w-full rounded-xl bg-stone-900 px-4 py-3 text-center font-medium text-white transition hover:bg-stone-800"
            >
              다 읽었어요 · 퀴즈 풀기
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
