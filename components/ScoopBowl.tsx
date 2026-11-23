"use client";

import { useId, useMemo, useState } from "react";

import { ScoopArt } from "@/components/ScoopArt";
import {
  BOWL_CX,
  BOWL_RIM_Y,
  BOWL_SHIFT_X,
  BOWL_VB_H,
  BOWL_VB_W,
  STAGE,
  bowlPaths,
  dropOrder,
  layoutBowl,
} from "@/lib/bowl";
import { BOWL_FILL, BOWL_INNER, COCOA_DARK, COCOA_FILL, formatDate, hslStr, outlineColor } from "@/lib/color";
import { LINE, gelatoScoopPath, scoopPath } from "@/lib/cone";
import { safeEquipped, safeScoopColors, type Equipped, type ScoopColors } from "@/lib/cosmetics";
import type { Scoop } from "@/lib/feed";
import { useScoopArrival } from "@/lib/use-scoop-arrival";

type Props = {
  scoops: Scoop[];
  selectedId?: number | null;
  justAddedId?: number | null;
  onSelect?: (scoop: Scoop) => void;
  onArrivalComplete?: (id: number) => void;
  equipped?: Equipped;
  scoopColors?: ScoopColors;
};

/**
 * 노트북 내 콘의 보울 — 그 달 스쿱을 콘에 올린 순서대로 떨어뜨려 쌓는다(lib/bowl.ts).
 * 스쿱 그림은 콘과 같은 ScoopArt다. 앞 테두리가 맨 아래 줄 스쿱의 아랫부분을 가려
 * 담긴 것처럼 보인다. 외곽선은 채움색의 진한 버전이고 그림자·광택은 없다.
 *
 * 스쿱을 고르면 보울과 더미가 왼쪽으로 비켜나고(.ac-bowl), 고른 스쿱만 오른쪽 무대로 나온다.
 * 빠진 자리는 비워 둔다 — 위 스쿱이 내려앉지 않는다.
 */
export function ScoopBowl({ scoops, selectedId, justAddedId, onSelect, onArrivalComplete, equipped, scoopColors }: Props) {
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const clipId = `ac-bowl-clip-${useId().replace(/:/g, "")}`;
  const gradientBase = `ac-bowl-gelato-${useId().replace(/:/g, "")}`;
  const appearance = safeEquipped(equipped);
  const chosenColors = safeScoopColors(scoopColors);
  const arrival = useScoopArrival(
    scoops.some((scoop) => scoop.id === justAddedId) ? justAddedId ?? null : null,
    onArrivalComplete,
  );

  const ordered = useMemo(() => dropOrder(scoops), [scoops]);
  const layout = useMemo(() => layoutBowl(scoops), [scoops]);
  const spots = useMemo(() => new Map(layout.placements.map((p) => [p.id, p])), [layout]);
  const n = ordered.length;
  const selected = selectedId != null && spots.has(selectedId) ? selectedId : null;
  const gelato = appearance.texture === "gelato-folds";
  const d = useMemo(() => (gelato ? gelatoScoopPath() : scoopPath()), [gelato]);

  const cocoa = appearance.cone === "cocoa-cone";
  const front = cocoa ? COCOA_FILL : BOWL_FILL;
  const inner = cocoa ? COCOA_DARK : BOWL_INNER;
  const { back, front: frontPath } = bowlPaths(BOWL_CX);

  // 화면구성.md §7 — 스크린리더·키보드는 SVG 대신 실제 버튼 목록을 쓴다. 최신부터 읽는다.
  const listed = [...ordered].reverse();

  return (
    <>
      <svg className="ac-svg h-full w-full" viewBox={`0 0 ${BOWL_VB_W} ${BOWL_VB_H}`}
        preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
        <defs><clipPath id={clipId}><path d={d} /></clipPath></defs>
        <g className="ac-bowl" transform={`translate(${selected != null ? BOWL_SHIFT_X : 0} 0)`}>
          <path d={back} fill={hslStr(inner)} stroke={hslStr(outlineColor(inner))} strokeWidth={LINE} />

          {n === 0 && (
            <text x={BOWL_CX} y={BOWL_RIM_Y - 60} textAnchor="middle" fontSize="15" fill="#9A90A6">
              아직 스쿱이 없어요
            </text>
          )}

          {ordered.map((s) => {
            const spot = spots.get(s.id)!;
            const isSel = s.id === selected;
            const transform = isSel
              ? `translate(${STAGE.x - BOWL_SHIFT_X} ${STAGE.y}) scale(${Math.max(layout.scale, 0.9)})`
              : `translate(${spot.x} ${spot.y}) scale(${layout.scale})`;
            const arriving = s.id === justAddedId;
            // 줄어든 스쿱 안에서 잰 거리라 배율로 나눠 장면 위 밖에서 떨어지게 한다.
            const dropFrom = `${-(spot.y + 80) / layout.scale}px`;
            return (
              <g key={s.id} ref={arriving ? arrival.slotRef : undefined} className="ac-slot" transform={transform}
                opacity={selected != null && !isSel ? ".45" : undefined}>
                <g
                  className={`ac-scoop${s.id === focusedId ? " ac-scoop-focus" : ""}${arriving && arrival.waiting ? " ac-scoop-waiting" : ""}${arriving && arrival.falling ? " ac-bowl-drop" : ""}`}
                  style={arriving && arrival.falling
                    ? { "--ac-drop-from": dropFrom, animationPlayState: arrival.paused ? "paused" : "running" } as React.CSSProperties
                    : undefined}
                  onAnimationEnd={(event) => {
                    if (event.target !== event.currentTarget || !arriving) return;
                    if (event.animationName === "ac-bowl-drop") arrival.land();
                    if (event.animationName === "ac-settle") arrival.complete();
                  }}
                  data-scoop-id={s.id}
                  onClick={() => onSelect?.(s)}
                >
                  <ScoopArt scoop={s} appearance={appearance} chosenColors={chosenColors} d={d} clipId={clipId}
                    gradientId={`${gradientBase}-${s.id}`} gelato={gelato} focused={s.id === focusedId}
                    selected={isSel} crowned={s.id === layout.topId} />
                </g>
              </g>
            );
          })}

          <path data-bowl="front" d={frontPath} fill={hslStr(front)} stroke={hslStr(outlineColor(front))}
            strokeWidth={LINE} strokeLinejoin="round" />
        </g>
      </svg>
      <ul className="sr-only" aria-label={`보울, 스쿱 ${n}개`}>
        {listed.map((s) => {
          if (s.id === justAddedId && arrival.waiting) return null;
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={s.id === selectedId}
                onClick={() => onSelect?.(s)}
                onFocus={() => setFocusedId(s.id)}
                onBlur={() => setFocusedId(null)}
              >
                {`${s.domainLabel} · ${formatDate(s.date)} · ${s.title}`}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
