"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";

import { ScoopCone } from "@/components/ScoopCone";
import { ConeScene } from "@/components/ConeScene";
import { FlavorLegend } from "@/components/FlavorLegend";
import { ScoopPanel } from "@/components/ScoopPanel";
import { coneHeight, slotRange } from "@/lib/cone";
import type { Scoop } from "@/lib/feed";
import type { Equipped, ScoopColors } from "@/lib/cosmetics";
import type { DomainRow } from "@/lib/supabase/types";
import { useScoopSelection } from "@/lib/use-scoop-selection";

/**
 * 콘 탭의 본체 — 스쿱 선택 상태를 들고 콘과 타이틀 패널을 배치한다.
 *
 * 선택 상태·URL 동기화는 useScoopSelection(보울과 공용)이 맡는다.
 *
 * 경로는 `window.location.pathname`에서 읽는다. 같은 컴포넌트가 `/cone`과
 * 목데이터 미리보기(`/preview` 아래) 양쪽에서 돈다.
 */

type Props = {
  scoops: Scoop[];
  domains: DomainRow[];
  /** `/cone?scoop=<id>`로 바로 들어온 경우의 초기 선택. */
  initialScoopId: number | null;
  /** 저장 직후 떨어뜨릴 스쿱 — ScoopCone이 ac-plop을 건다. */
  justAddedId?: number | null;
  /** 리더 링크 접두사. 목데이터 미리보기가 /preview 아래에서 쓴다. */
  base?: string;
  equipped?: Equipped;
  scoopColors?: ScoopColors;
};

export function ConeBoard({
  scoops,
  domains,
  initialScoopId,
  justAddedId = null,
  base = "",
  equipped,
  scoopColors,
}: Props) {
  const { selectedId, selected, select, animatePanel, finishArrival, onBackgroundClick } =
    useScoopSelection(scoops, initialScoopId);
  const panelRef = useRef<HTMLDivElement>(null);

  const ordered = useMemo(
    () => [...scoops].sort((a, b) => a.date.localeCompare(b.date)),
    [scoops],
  );
  const n = ordered.length;

  // 화면 밖 스쿱을 골랐을 때(딥링크 포함) 패널이 보이도록 최소한만 스크롤한다.
  useEffect(() => {
    if (selected) panelRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  /**
   * 패널이 놓일 빈 슬롯. 콘 SVG는 viewBox 비율대로 렌더되고 감싼 div의 높이가 곧
   * SVG 높이이므로, 픽셀을 재지 않고 백분율로 잡으면 어떤 폭에서도 슬롯에 정확히
   * 앉는다. **높이까지 슬롯에 맞춰 잘라야** 글이 위아래 스쿱을 덮지 않는다.
   */
  const slot = useMemo(() => {
    if (selected == null) return null;
    const i = ordered.findIndex((s) => s.id === selected.id);
    if (i === -1) return null;
    const H = coneHeight(n);
    const { top, height } = slotRange(i, n);
    return { top: `${(top / H) * 100}%`, height: `${(height / H) * 100}%` };
  }, [selected, ordered, n]);

  if (n === 0) {
    return (
      <div className="py-6">
        <div className="relative isolate overflow-hidden rounded-3xl">
          <ConeScene scene={equipped?.background} />
          <div className="relative z-10"><ScoopCone scoops={[]} equipped={equipped} scoopColors={scoopColors} /></div>
        </div>
        <div className="mt-6 text-center">
          <p className="text-sm text-stone-600">
            아티클을 읽고 퀴즈를 풀면 스쿱이 하나 올라가요.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white"
          >
            오늘의 아티클 읽으러 가기 →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 높이가 선택 상태에 따라 변하지 않는다 — 콘도 아래 스쿱도 그 자리에 있는다. */}
      <div className="relative isolate overflow-hidden rounded-3xl" onClick={onBackgroundClick}>
        <ConeScene scene={equipped?.background} />
        <div className="relative z-10"><ScoopCone
          scoops={ordered}
          selectedId={selectedId}
          justAddedId={justAddedId}
          onArrivalComplete={finishArrival}
          onSelect={select}
          equipped={equipped}
          scoopColors={scoopColors}
        /></div>

        {selected && slot && (
          <div
            ref={panelRef}
            /* 왼쪽은 빠져나온 스쿱(오른끝 x=88≈34%)을 피해 잡는다. */
            className={`ac-panel absolute left-[37%] right-[3%] z-20 overflow-hidden ${equipped?.background ? "rounded-xl bg-white/95 px-2" : ""}`}
            style={{ top: slot.top, height: slot.height }}
          >
            <ScoopPanel scoop={selected} base={base} animate={animatePanel} />
          </div>
        )}
      </div>

      <FlavorLegend domains={domains} equipped={equipped} scoopColors={scoopColors} />
    </div>
  );
}
