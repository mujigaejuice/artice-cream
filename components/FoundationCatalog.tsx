"use client";
import { useState } from "react";
import type { TodayPick } from "@/lib/feed";
import type { DomainRow } from "@/lib/supabase/types";
import { ArticleCard } from "./ArticleCard";

export function FoundationCatalog({ picks, domains, selectedDomainIds, unlocked }: {
  picks: TodayPick[]; domains: DomainRow[]; selectedDomainIds: number[]; unlocked: boolean;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const active = choice ?? selectedDomainIds[0] ?? domains[0]?.id;
  const selected = picks.filter(p => p.domain.id === active);
  return <section aria-label="분야별 오리지널 기초">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold text-stone-900">기초부터 차근차근</h2>
        <p className="mt-1 text-xs leading-relaxed text-stone-500">모든 수준에서 같은 글을 읽어요. 쌓은 뒤에도 퀴즈를 다시 풀 수 있어요.</p></div>
      <label className="text-xs text-stone-600">분야 <select value={active ?? ""} onChange={e=>setChoice(Number(e.target.value))}
        className="ml-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800">
        {domains.map(d=><option key={d.id} value={d.id}>{d.name_ko}</option>)}
      </select></label>
    </div>
    <p className="mb-3 text-xs text-stone-500">{selected.length}편 중 {selected.filter(p=>p.progressStatus === "saved").length}편 쌓았어요 · 순서는 자유예요</p>
    {selected.length ? <ol className="space-y-3">{selected.map(p=><li key={p.articleId}><ArticleCard pick={p} unlocked={unlocked}/></li>)}</ol> :
      <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-sm text-stone-600">이 분야의 기초 콘텐츠를 준비하고 있어요.</p>}
  </section>;
}
