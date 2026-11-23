"use client";

import Link from "next/link";

import { BowlBackdrop } from "@/components/BowlBackdrop";
import { ScoopBowl } from "@/components/ScoopBowl";
import { ScoopPanel } from "@/components/ScoopPanel";
import { BOWL_VB_H, BOWL_VB_W, STAGE_PANEL } from "@/lib/bowl";
import type { Equipped, ScoopColors } from "@/lib/cosmetics";
import type { Scoop } from "@/lib/feed";
import { useScoopSelection } from "@/lib/use-scoop-selection";

/**
 * 노트북 내 콘의 장면 — 가로용 배경 위에 보울을 놓고, 고른 스쿱의 제목을 오른쪽 무대 아래에 쓴다.
 * 선택·URL 동기화·닫기(Esc, 배경, 같은 스쿱)는 콘(ConeBoard)과 같은 useScoopSelection이다.
 */
export function BowlBoard({ scoops, initialScoopId, justAddedId = null, equipped, scoopColors }: {
  scoops: Scoop[];
  initialScoopId: number | null;
  justAddedId?: number | null;
  equipped?: Equipped;
  scoopColors?: ScoopColors;
}) {
  const { selectedId, selected, select, animatePanel, finishArrival, onBackgroundClick } =
    useScoopSelection(scoops, initialScoopId);
  const pct = (value: number, whole: number) => `${(value / whole) * 100}%`;

  return (
    <div>
      <div className="relative isolate aspect-3/2 overflow-hidden rounded-3xl bg-[#f3efe7]" onClick={onBackgroundClick}>
        <BowlBackdrop scene={equipped?.background} />
        <div className="relative z-10 h-full">
          <ScoopBowl
            scoops={scoops}
            selectedId={selectedId}
            justAddedId={justAddedId}
            onSelect={select}
            onArrivalComplete={finishArrival}
            equipped={equipped}
            scoopColors={scoopColors}
          />
        </div>
        {selected && (
          <div
            className={`ac-panel absolute z-20 overflow-hidden ${equipped?.background ? "rounded-xl bg-white/95 px-2" : ""}`}
            style={{
              left: pct(STAGE_PANEL.x, BOWL_VB_W),
              top: pct(STAGE_PANEL.y, BOWL_VB_H),
              width: pct(STAGE_PANEL.w, BOWL_VB_W),
              height: pct(STAGE_PANEL.h, BOWL_VB_H),
            }}
          >
            <ScoopPanel scoop={selected} animate={animatePanel} />
          </div>
        )}
      </div>

      {scoops.length === 0 && (
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
      )}
    </div>
  );
}
