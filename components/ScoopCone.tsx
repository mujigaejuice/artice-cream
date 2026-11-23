"use client";

import { useId, useMemo, useState } from "react";

import { ScoopArt } from "@/components/ScoopArt";
import {
  COCOA_DARK,
  COCOA_FILL,
  CONE_FILL,
  CONE_LATTICE,
  formatDate,
  hslStr,
  outlineColor,
} from "@/lib/color";
import {
  CONE_H,
  CONE_HALF,
  CX,
  DETACH_CX,
  DETACH_SCALE,
  PUSH_BELOW,
  LINE,
  VB_W,
  coneHeight,
  coneTopY,
  gelatoScoopPath,
  scoopCy,
  scoopPath,
} from "@/lib/cone";
import type { Scoop } from "@/lib/feed";
import { safeEquipped, safeScoopColors, type Equipped, type ScoopColors } from "@/lib/cosmetics";
import { useScoopArrival } from "@/lib/use-scoop-arrival";

/**
 * 콘 — 아이스크림 도안.png(시안 4번 물결형)의 플랫 일러스트를 따른다.
 *
 * 기본 도안의 단색과 외곽선을 유지한다. 구매한 질감만 스쿱 내부에 얹고,
 * 그래서 렌더 순서가 아래→위인 것이 중요하다.
 *
 * **외곽선은 도형마다 자기 채움색의 진한 버전이다**(outlineColor). 모든 도형에
 * 같은 색 선을 쓰면 밝은 스쿱일수록 선만 떠 보인다 — 도안도 초록 스쿱은 진한
 * 초록, 체리는 진한 빨강으로 그려져 있다. 하이라이트(highlightColor)와 물결
 * 자국(markColor)도 같은 방식으로 채움색에서 파생한다.
 *
 * 색은 scoopShade(도메인 슬러그, 완료 날짜, 기사 ID)로 렌더 시점에 계산한다. 순수 함수라
 * DB에 색을 저장할 필요가 없고, 서버가 같은 값을 계산해도 결과가 일치한다.
 *
 * 스쿱은 circle의 cy가 아니라 바깥 g의 transform으로 배치한다. 속성은 CSS
 * 트랜지션이 안 걸리지만 transform은 걸리기 때문 — 스쿱이 빠져나갈 때 위쪽이
 * 내려앉는 움직임이 이 트랜지션 하나로 처리된다.
 */

type Props = {
  scoops: Scoop[];
  selectedId?: number | null;
  justAddedId?: number | null;
  onSelect?: (scoop: Scoop) => void;
  onArrivalComplete?: (id: number) => void;
  equipped?: Equipped;
  scoopColors?: ScoopColors;
  interactive?: boolean;
  previewCrop?: boolean;
};

export function ScoopCone({ scoops, selectedId, justAddedId, onSelect, onArrivalComplete, equipped, scoopColors,
  interactive = true, previewCrop = false }: Props) {
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const patternId = `ac-waffle-${useId().replace(/:/g, "")}`;
  const clipId = `ac-scoop-clip-${useId().replace(/:/g, "")}`;
  const gelatoShadeId = `ac-gelato-shade-${useId().replace(/:/g, "")}`;
  const appearance = safeEquipped(equipped);
  const chosenColors = safeScoopColors(scoopColors);
  const arrival = useScoopArrival(
    scoops.some((scoop) => scoop.id === justAddedId) ? justAddedId ?? null : null,
    onArrivalComplete,
  );

  // 오래된 것이 아래. 날짜 문자열 비교로 정렬한다(YYYY-MM-DD라 사전순 = 시간순).
  const ordered = useMemo(
    () => [...scoops].sort((a, b) => a.date.localeCompare(b.date)),
    [scoops],
  );
  const n = ordered.length;

  const selIdx = useMemo(() => {
    if (selectedId == null) return null;
    const i = ordered.findIndex((s) => s.id === selectedId);
    return i === -1 ? null : i;
  }, [ordered, selectedId]);

  const H = coneHeight(n);
  const topY = coneTopY(n); // 쉴 때 기준 — 선택 중의 이동은 아래 <g>의 transform이 맡는다
  const tipY = topY + CONE_H;
  const gelato = appearance.texture === "gelato-folds";
  const d = useMemo(() => gelato ? gelatoScoopPath() : scoopPath(), [gelato]);

  const coneFill = appearance.cone === "cocoa-cone" ? COCOA_FILL : CONE_FILL;
  const coneLattice = appearance.cone === "cocoa-cone" ? COCOA_DARK : CONE_LATTICE;
  const coneInk = hslStr(outlineColor(coneFill));
  const conePath = `M ${CX - CONE_HALF} ${topY} L ${CX + CONE_HALF} ${topY} L ${CX + 4} ${tipY - 6} Q ${CX} ${tipY} ${CX - 4} ${tipY - 6} Z`;

  // 체리는 가장 최근에 쌓은 스쿱(맨 위)에 귀속된다. 그 스쿱을 골라 빠져나와도
  // 체리는 따라간다 — 아래 스쿱으로 옮겨 달면 "최신"의 표식이 아니게 된다.
  const cherryIdx = n - 1;
  const coneArt = <g className="ac-cone"
    transform={`translate(0 ${selIdx != null ? PUSH_BELOW : 0})`}>
    <path d={conePath} fill={`url(#${patternId})`} stroke={coneInk} strokeWidth={LINE}
      strokeLinejoin="round" strokeLinecap="round" />
  </g>;
  const coneInFront = gelato && n > 0;

  // 화면구성.md §7 — 스크린리더·키보드는 SVG 대신 옆의 실제 버튼 목록을 쓴다.
  // SVG 안 <g role="button">은 그림 역할과 충돌하므로 그림은 통째로 숨기고,
  // 버튼에 포커스가 가면 그림 위 같은 스쿱에 점선 링을 그려 위치를 보여 준다.
  // 최신(맨 위) 스쿱부터 읽는다.
  const listed = interactive ? [...ordered].reverse() : [];

  return (
    <>
    <svg
      className="ac-svg"
      viewBox={previewCrop && n === 1 ? "80 35 100 110" : `0 0 ${VB_W} ${H}`}
      preserveAspectRatio="xMidYMax meet"
      {...(interactive
        ? { "aria-hidden": true, focusable: "false" }
        : { role: "img", "aria-label": `아이스크림 콘, 스쿱 ${n}개` })}
    >
      <defs>
        <pattern id={patternId} width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill={hslStr(coneFill)} />
          <path
            d="M0 0 L16 16 M16 0 L0 16"
            stroke={hslStr(coneLattice)}
            strokeWidth="1.6"
          />
        </pattern>
        <clipPath id={clipId}><path d={d} /></clipPath>
      </defs>

      {/* 콘 — 선택 중에는 아래 무리와 함께 내려가 슬롯을 대칭으로 벌린다.
          내려갈 자리는 뷰박스에 늘 비워 둔 몫이라 콘 높이는 변하지 않는다. */}
      {!coneInFront && coneArt}

      {/* 빈 상태 */}
      {n === 0 && (
        <text x={CX} y={topY - 26} textAnchor="middle" fontSize="13" fill="#9A90A6">
          아직 스쿱이 없어요
        </text>
      )}

      {/* 스쿱: 오래된 것(아래) → 최신(위). 위가 나중에 그려져 아래를 덮는다. */}
      {ordered.map((s, i) => {
        const isSel = selIdx != null && i === selIdx;
        const cy = scoopCy(i, n, selIdx);
        const x = isSel ? DETACH_CX : CX;
        const scale = isSel ? DETACH_SCALE : 1;

        return (
          <g
            key={s.id}
            ref={s.id === justAddedId ? arrival.slotRef : undefined}
            className="ac-slot"
            transform={`translate(${x} ${cy}) scale(${scale})`}
          >
            <g
              className={`ac-scoop${s.id === focusedId ? " ac-scoop-focus" : ""}${s.id === justAddedId && arrival.waiting ? " ac-scoop-waiting" : ""}${s.id === justAddedId && arrival.falling ? " ac-plop" : ""}`}
              style={s.id === justAddedId && arrival.falling ? { animationPlayState: arrival.paused ? "paused" : "running" } : undefined}
              onAnimationEnd={(event) => {
                if (event.target !== event.currentTarget || s.id !== justAddedId) return;
                if (event.animationName === "ac-plop") arrival.land();
                if (event.animationName === "ac-settle") arrival.complete();
              }}
              data-scoop-id={s.id}
              onClick={interactive ? () => onSelect?.(s) : undefined}
            >
              <ScoopArt scoop={s} appearance={appearance} chosenColors={chosenColors} d={d} clipId={clipId}
                gradientId={`${gelatoShadeId}-${s.id}`} gelato={gelato} focused={s.id === focusedId}
                selected={isSel} crowned={i === cherryIdx} />
            </g>
          </g>
        );
      })}
      {coneInFront && coneArt}
    </svg>
    {interactive && (
      <ul className="sr-only" aria-label={`아이스크림 콘, 스쿱 ${n}개`}>
        {listed.map((s) => {
          const waiting = s.id === justAddedId && arrival.waiting;
          if (waiting) return null;
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
    )}
    </>
  );
}
