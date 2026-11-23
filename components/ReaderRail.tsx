"use client";

import { useEffect, useRef } from "react";

import type { GlossaryItem } from "@/lib/glossary-order";

/** 노트북 리더의 오른쪽 고정 칸: 이 글의 용어, 퀴즈 버튼, 북마크·원문 링크. */
export function ReaderRail(props: {
  items: GlossaryItem[];
  activeId: string | null;
  cta: React.ReactNode;
  actions: React.ReactNode;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!props.activeId) return;
    const id = `gloss-${props.activeId}`;
    const item = [...(listRef.current?.children ?? [])].find(node => node.id === id);
    if (typeof item?.scrollIntoView === "function") item.scrollIntoView({ block: "nearest" });
  }, [props.activeId]);

  return (
    <aside aria-label="읽기 도구" className="lg:sticky lg:top-20 lg:self-start">
      {props.items.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white/70 p-4">
          <h2 className="text-xs font-semibold text-stone-500">이 글의 용어 {props.items.length}</h2>
          <ul ref={listRef} className="mt-2 max-h-[calc(100dvh-20rem)] space-y-1 overflow-y-auto">
            {props.items.map((item) => {
              const active = item.id === props.activeId;
              return (
                <li key={item.id} id={`gloss-${item.id}`} aria-current={active ? "true" : undefined}
                  className={`px-2 py-1.5 text-sm transition-colors ${active ? "rounded-lg bg-amber-100" : ""}`}>
                  <p className="font-medium text-stone-900">{item.term}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-stone-600">{item.definition}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="mt-4">{props.cta}</div>
      <div className="mt-3 flex items-center justify-between gap-3">{props.actions}</div>
    </aside>
  );
}
