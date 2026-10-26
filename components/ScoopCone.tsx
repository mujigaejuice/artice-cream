"use client";

import { useId, useMemo, useState } from "react";

import {
  CHERRY_FILL,
  CHERRY_GLINT,
  CHERRY_STEM,
  CONE_FILL,
  CONE_LATTICE,
  customScoopShade,
  formatDate,
  highlightColor,
  hslStr,
  markColor,
  outlineColor,
  scoopShade,
} from "@/lib/color";
import {
  CHERRY,
  CONE_H,
  CONE_HALF,
  CX,
  DETACH_CX,
  DETACH_SCALE,
  PUSH_BELOW,
  GLINTS,
  HIGHLIGHT,
  LINE,
  R,
  SCOOP_BOTTOM,
  SCOOP_DOME,
  VB_W,
  WAVE_MARKS,
  cherryStemPath,
  coneHeight,
  coneTopY,
  du,
  scoopCy,
  scoopPath,
  waveMarkPath,
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

/** 선택/포커스 링 — 스쿱이 원이 아니라 납작해서 타원으로 감싼다. */
const RING_CY = ((-SCOOP_DOME + SCOOP_BOTTOM) / 2) * R;
const RING_RX = R * 1.16;
const RING_RY = ((SCOOP_DOME + SCOOP_BOTTOM) / 2) * R * 1.16;

type Props = {
  scoops: Scoop[];
  selectedId?: number | null;
  justAddedId?: number | null;
  onSelect?: (scoop: Scoop) => void;
  onArrivalComplete?: (id: number) => void;
  equipped?: Equipped;
  scoopColors?: ScoopColors;
  interactive?: boolean;
};

export function ScoopCone({ scoops, selectedId, justAddedId, onSelect, onArrivalComplete, equipped, scoopColors,
  interactive = true }: Props) {
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const patternId = `ac-waffle-${useId().replace(/:/g, "")}`;
  const clipId = `ac-scoop-clip-${useId().replace(/:/g, "")}`;
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
  const d = useMemo(() => scoopPath(), []);

  const coneFill = appearance.cone === "cocoa-cone" ? { h: 25, s: 43, l: 43 } : CONE_FILL;
  const coneLattice = appearance.cone === "cocoa-cone" ? { h: 24, s: 35, l: 32 } : CONE_LATTICE;
  const coneInk = hslStr(outlineColor(coneFill));
  const cherryInk = hslStr(outlineColor(CHERRY_FILL));
  const conePath = `M ${CX - CONE_HALF} ${topY} L ${CX + CONE_HALF} ${topY} L ${CX + 4} ${tipY - 6} Q ${CX} ${tipY} ${CX - 4} ${tipY - 6} Z`;

  // 체리는 가장 최근에 쌓은 스쿱(맨 위)에 귀속된다. 그 스쿱을 골라 빠져나와도
  // 체리는 따라간다 — 아래 스쿱으로 옮겨 달면 "최신"의 표식이 아니게 된다.
  const cherryIdx = n - 1;

  return (
    <svg
      className="ac-svg"
      viewBox={`0 0 ${VB_W} ${H}`}
      preserveAspectRatio="xMidYMax meet"
      role="group"
      aria-label={`아이스크림 콘, 스쿱 ${n}개`}
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
      <g
        className="ac-cone"
        transform={`translate(0 ${selIdx != null ? PUSH_BELOW : 0})`}
      >
        <path
          d={conePath}
          fill={`url(#${patternId})`}
          stroke={coneInk}
          strokeWidth={LINE}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>

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

        const original = scoopShade(s.domain, s.date, s.articleId);
        const base = appearance.palette === "berry-palette"
          ? customScoopShade(s.domain, s.date, s.articleId, chosenColors[s.domain as keyof ScoopColors])
          : original;
        const fill = hslStr(base);
        const ink = hslStr(outlineColor(base));
        const glow = hslStr(highlightColor(base));
        const mark = hslStr(markColor(base));

        return (
          <g
            key={s.id}
            ref={s.id === justAddedId ? arrival.slotRef : undefined}
            className="ac-slot"
            transform={`translate(${x} ${cy}) scale(${scale})`}
          >
            <g
              className={`ac-scoop${s.id === justAddedId && arrival.waiting ? " ac-scoop-waiting" : ""}${s.id === justAddedId && arrival.falling ? " ac-plop" : ""}`}
              style={s.id === justAddedId && arrival.falling ? { animationPlayState: arrival.paused ? "paused" : "running" } : undefined}
              onAnimationEnd={(event) => {
                if (event.target !== event.currentTarget || s.id !== justAddedId) return;
                if (event.animationName === "ac-plop") arrival.land();
                if (event.animationName === "ac-settle") arrival.complete();
              }}
              role={interactive ? "button" : undefined}
              tabIndex={interactive && !(s.id === justAddedId && arrival.waiting) ? 0 : -1}
              aria-hidden={s.id === justAddedId && arrival.waiting ? true : undefined}
              aria-pressed={isSel}
              aria-label={`${s.domainLabel} · ${formatDate(s.date)} · ${s.title}`}
              onClick={() => onSelect?.(s)}
              onFocus={() => setFocusedId(s.id)}
              onBlur={() => setFocusedId(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(s);
                }
              }}
            >
              {/* 선택 표시는 스택에서 빠져나온 것 자체다(화면구성.md §4-2) — 링은 없앴다.
                  키보드 포커스 링(점선)만 남긴다: 훑을 때 위치를 알 방법이 그것뿐이라서. */}
              {s.id === focusedId && !isSel && (
                <ellipse
                  cx={0}
                  cy={RING_CY}
                  rx={RING_RX}
                  ry={RING_RY}
                  fill="none"
                  stroke={ink}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              )}

              {/* 본체는 기본 도안의 단색. 선택한 질감은 도형 안에서만 보인다. */}
              <path d={d} fill={fill} />

              {appearance.texture === "cloud-swirl" && <g clipPath={`url(#${clipId})`}
                fill="none" stroke="#FFFDF9" strokeLinecap="round" opacity=".82">
                <path d="M-62 -19C-42 -34-32 -14-13-23S18-40 39-28s31 5 43-8" strokeWidth="8" />
                <path d="M-63 4C-42-11-33 9-13 0S22-19 45-7s27 6 39-3" strokeWidth="6" opacity=".74" />
                <path d="M-58 23C-36 10-28 30-9 21s38-13 53-2 31 4 42-3" strokeWidth="5" opacity=".62" />
              </g>}
              {appearance.texture === "gelato-folds" && <g clipPath={`url(#${clipId})`}
                fill="none" strokeLinecap="round" opacity=".8">
                <path d="M-57-4q16-29 35-21t30 5q12-18 33-9t30 5" stroke={glow} strokeWidth="10" />
                <path d="M-63 13q22-19 37-11t31 3q17-16 34-6t34 1" stroke={mark} strokeWidth="5" opacity=".7" />
                <path d="M-42 31q18-19 35-8t33-4q21-12 40 0" stroke={glow} strokeWidth="8" opacity=".7" />
              </g>}

              {/* 빛은 왼쪽 위에서 온다 — 돔의 큰 하이라이트와 로브의 윤기가 한 광원이다. */}
              <ellipse
                cx={0}
                cy={0}
                rx={du(HIGHLIGHT.rx)}
                ry={du(HIGHLIGHT.ry)}
                fill={glow}
                transform={`translate(${du(HIGHLIGHT.x)} ${du(HIGHLIGHT.y)}) rotate(${HIGHLIGHT.rot})`}
              />
              {GLINTS.map((g, gi) => (
                <ellipse
                  key={gi}
                  cx={0}
                  cy={0}
                  rx={du(g.rx)}
                  ry={du(g.ry)}
                  fill={glow}
                  transform={`translate(${du(g.x)} ${du(g.y)}) rotate(${g.rot})`}
                />
              ))}

              {/* 물결 자국 — 이 셋이 있어야 바닥 로브가 물결로 읽힌다. */}
              {WAVE_MARKS.map((m, mi) => (
                <path
                  key={mi}
                  d={waveMarkPath(m)}
                  fill="none"
                  stroke={mark}
                  strokeWidth={du(m.w)}
                  strokeLinecap="round"
                />
              ))}

              {/* 외곽선은 맨 위에 — 도안도 자국과 윤기가 선을 넘지 않는다. */}
              <path
                d={d}
                fill="none"
                stroke={ink}
                strokeWidth={LINE}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* 가장 최근 스쿱: 체리. 중심이 돔 정수리에 얹힌다. 빠져나와도 따라간다. */}
              {i === cherryIdx && appearance.topping === "sugar-stars" && (
                <g aria-label="설탕 별 토핑" fill="#F8D872" stroke="#9A7334" strokeWidth="1.4">
                  <path d="M-27 -45 l3 7 8 1 -6 5 2 8 -7 -4 -7 4 2 -8 -6 -5 8 -1 Z" />
                  <path d="M0 -57 l3 7 8 1 -6 5 2 8 -7 -4 -7 4 2 -8 -6 -5 8 -1 Z" />
                  <path d="M27 -44 l3 7 8 1 -6 5 2 8 -7 -4 -7 4 2 -8 -6 -5 8 -1 Z" />
                </g>
              )}
              {i === cherryIdx && appearance.topping === "rainbow-sprinkles" && <g aria-label="무지개 스프링클">
                {[[ -39,-25,-25,"#F37E9A"],[-26,-38,26,"#F7D56E"],[-10,-29,-36,"#8EC8B0"],
                  [7,-42,28,"#B2A0DE"],[24,-29,-24,"#F49765"],[39,-18,30,"#78B7D7"],
                  [-32,-4,32,"#A9A1E8"],[-15,-12,-18,"#F5D271"],[5,-15,30,"#E56B85"],
                  [23,-7,-33,"#8FC9AE"],[-7,9,25,"#F49765"],[35,8,-19,"#B2A0DE"]].map(([x,y,rot,color], index) =>
                  <rect key={index} x={Number(x)-5} y={Number(y)-2} width="10" height="4" rx="2"
                    fill={String(color)} transform={`rotate(${rot} ${x} ${y})`} />)}
              </g>}
              {i === cherryIdx && appearance.topping === "chocolate-drizzle" && <g aria-label="초코 드리즐"
                fill="none" stroke="#654137" strokeLinecap="round" strokeLinejoin="round">
                <path d="M-48-17q24-17 48-5t48-3M-53-5q26-15 52-4t53-2" strokeWidth="8" />
                <path d="M-37-16v22q0 9 6 9t6-9V-8M6-19v30q0 11 7 11t7-11V-15M38-20V1q0 8 6 8t6-8V-18"
                  strokeWidth="7" />
                <path d="M-45-19q24-14 45-3t45-3" stroke="#9A6950" strokeWidth="2" opacity=".7" />
              </g>}
              {i === cherryIdx && appearance.topping === "cheese-cubes" && <g aria-label="치즈 큐브"
                stroke="#D4A95D" strokeWidth="1.6" strokeLinejoin="round">
                {[[ -33,-26,-15],[0,-41,12],[31,-25,17],[-9,-11,-12],[21,-4,-15]].map(([x,y,rot], index) =>
                  <g key={index} transform={`translate(${x} ${y}) rotate(${rot})`}>
                    <path d="M-8-6h16l5 5-5 10H-8l-5-5Z" fill="#F9DE8A" />
                    <path d="M8-6l5 5-5 10-5-5Z" fill="#EBC773" />
                    <circle cx="-2" cy="1" r="1.4" fill="#E8C46E" stroke="none" />
                  </g>)}
              </g>}
              {i === cherryIdx && appearance.topping === "fresh-strawberry" && <g aria-label="딸기 토핑">
                <path d="M-17-46q0-15 17-13 17-2 17 13Q15-21 0-12q-15-9-17-34Z"
                  fill="#F06273" stroke="#BB4055" strokeWidth="2.6" />
                <path d="M0-57q-10-10-17-8 6 8 13 10-13-3-17 2 11 8 21 2 10 6 21-2-5-5-17-2 7-2 13-10-8-2-17 8Z"
                  fill="#75A979" stroke="#4F8059" strokeWidth="2" />
                <path d="M0-55v-13" stroke="#4F8059" strokeWidth="2.5" strokeLinecap="round" />
                {[[ -8,-43],[5,-42],[-4,-32],[9,-29],[1,-21]].map(([x,y], index) =>
                  <ellipse key={index} cx={x} cy={y} rx="1.5" ry="2.4" fill="#FFE3B4" />)}
              </g>}
              {i === cherryIdx && !appearance.topping && (
                <>
                  <circle
                    cx={0}
                    cy={du(CHERRY.cy)}
                    r={du(CHERRY.r)}
                    fill={hslStr(CHERRY_FILL)}
                    stroke={cherryInk}
                    strokeWidth={du(CHERRY.line)}
                  />
                  {/* 줄기는 체리 위로 지나간다 — 도안에서 체리 안쪽까지 들어와 있다. */}
                  <path
                    d={cherryStemPath()}
                    fill="none"
                    stroke={hslStr(CHERRY_STEM)}
                    strokeWidth={du(CHERRY.stem.w)}
                    strokeLinecap="round"
                  />
                  <circle
                    cx={du(CHERRY.glint.x)}
                    cy={du(CHERRY.cy + CHERRY.glint.y)}
                    r={du(CHERRY.glint.r)}
                    fill={hslStr(CHERRY_GLINT)}
                  />
                </>
              )}

              <title>{`${s.domainLabel} — ${s.title} (${formatDate(s.date)})`}</title>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
