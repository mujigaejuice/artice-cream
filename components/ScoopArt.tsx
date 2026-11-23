"use client";

import {
  CHERRY_FILL,
  CHERRY_GLINT,
  CHERRY_STEM,
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
  GLINTS,
  HIGHLIGHT,
  LINE,
  R,
  SCOOP_BOTTOM,
  SCOOP_DOME,
  WAVE_MARKS,
  cherryStemPath,
  du,
  waveMarkPath,
} from "@/lib/cone";
import type { Scoop } from "@/lib/feed";
import type { Equipped, ScoopColors } from "@/lib/cosmetics";

/**
 * 스쿱 한 개의 그림. 콘(ScoopCone)과 보울(ScoopBowl)이 같이 쓴다 — 실루엣, 색 계산,
 * 팔레트, 질감, 토핑이 어디서나 같아야 한다. 배치(transform)와 고르기·도착 처리는 부모가 맡는다.
 *
 * 외곽선·하이라이트·물결 자국은 모두 채움색에서 파생한다(outlineColor 등).
 */

/** 선택/포커스 링 — 스쿱이 원이 아니라 납작해서 타원으로 감싼다. */
const RING_CY = ((-SCOOP_DOME + SCOOP_BOTTOM) / 2) * R;
const RING_RX = R * 1.16;
const RING_RY = ((SCOOP_DOME + SCOOP_BOTTOM) / 2) * R * 1.16;
const CHEESE_CUBES = [[-18, -20, -15], [0, -28, 12], [18, -20, 17],
  [-11, 0, -12], [14, 4, -15]] as const;

export function ScoopArt({ scoop, appearance, chosenColors, d, clipId, gradientId, gelato, focused, selected, crowned }: {
  scoop: Scoop;
  appearance: Equipped;
  chosenColors: ScoopColors;
  /** 스쿱 실루엣 경로(기본 또는 젤라토). */
  d: string;
  clipId: string;
  gradientId: string;
  gelato: boolean;
  focused: boolean;
  selected: boolean;
  /** 토핑·기본 체리를 얹는 스쿱(콘은 맨 위, 보울은 가장 높이 있는 스쿱). */
  crowned: boolean;
}) {
  const original = scoopShade(scoop.domain, scoop.date, scoop.articleId);
  const base = appearance.palette === "berry-palette"
    ? customScoopShade(scoop.domain, scoop.date, scoop.articleId, chosenColors[scoop.domain as keyof ScoopColors])
    : original;
  const fill = hslStr(base);
  const ink = hslStr(outlineColor(base));
  const glow = hslStr(highlightColor(base));
  const mark = hslStr(markColor(base));
  const cherryInk = hslStr(outlineColor(CHERRY_FILL));

  return (
    <>
      {gelato && <defs><linearGradient id={gradientId} x1="12%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor={glow} />
        <stop offset="45%" stopColor={fill} />
        <stop offset="100%" stopColor={mark} />
      </linearGradient></defs>}
      {/* 선택 표시는 스택에서 빠져나온 것 자체다(화면구성.md §4-2) — 링은 없앴다.
          키보드 포커스 링(점선)만 남긴다: 훑을 때 위치를 알 방법이 그것뿐이라서. */}
      {focused && !selected && (
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
      {gelato && <path d={d} fill={`url(#${gradientId})`} opacity=".42" />}

      {appearance.texture === "cloud-swirl" && <g clipPath={`url(#${clipId})`}
        fill="none" stroke="#FFFDF9" strokeLinecap="round" opacity=".82">
        <path d="M-62 -19C-42 -34-32 -14-13-23S18-40 39-28s31 5 43-8" strokeWidth="8" />
        <path d="M-63 4C-42-11-33 9-13 0S22-19 45-7s27 6 39-3" strokeWidth="6" opacity=".74" />
        <path d="M-58 23C-36 10-28 30-9 21s38-13 53-2 31 4 42-3" strokeWidth="5" opacity=".62" />
      </g>}
      {gelato && <g clipPath={`url(#${clipId})`} fill="none" strokeLinecap="round">
        <path d="M-37-6C-26-18-17-22-8-17 2-10 5-17 15-20 23-22 30-15 35-11"
          stroke={mark} strokeWidth="9" opacity=".27" />
        <path d="M-37-11C-25-23-17-27-7-21 3-15 6-22 15-24 25-26 31-19 36-15"
          stroke={glow} strokeWidth="4" opacity=".77" />
        <path d="M-40 12C-29 1-25-10-14-8-3-6-5 7 8 7 20 7 23-8 39-4"
          stroke={mark} strokeWidth="13" opacity=".34" />
        <path d="M-40 5C-28-5-24-17-13-15-2-13-4 0 8 0 20 0 24-14 39-10"
          stroke={glow} strokeWidth="5" opacity=".83" />
        <path d="M-38 25C-27 12-18 14-11 21-2 32 8 26 15 17 23 8 30 12 40 18"
          stroke={mark} strokeWidth="14" opacity=".33" />
        <path d="M-39 18C-27 5-18 7-10 14 0 24 8 19 16 10 25 2 31 6 40 11"
          stroke={glow} strokeWidth="5" opacity=".76" />
        <path d="M-27 34C-16 26-12 27-4 31 6 37 16 24 29 28"
          stroke={mark} strokeWidth="8" opacity=".27" />
        <path d="M-29 29C-18 20-12 21-3 25 6 31 17 18 30 22"
          stroke={glow} strokeWidth="3.5" opacity=".63" />
        <path d="M-24-16c5-2 8-1 12 1M16-17c5-1 9 0 12 3M-30 9c4-2 8-1 11 2M10 30c4-1 8-2 11-5"
          stroke="#FFF9EC" strokeWidth="1.4" opacity=".5" />
      </g>}

      {/* 빛은 왼쪽 위에서 온다 — 돔의 큰 하이라이트와 로브의 윤기가 한 광원이다. */}
      {!gelato && <ellipse
        cx={0}
        cy={0}
        rx={du(HIGHLIGHT.rx)}
        ry={du(HIGHLIGHT.ry)}
        fill={glow}
        transform={`translate(${du(HIGHLIGHT.x)} ${du(HIGHLIGHT.y)}) rotate(${HIGHLIGHT.rot})`}
      />}
      {!gelato && GLINTS.map((g, gi) => (
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
      {!gelato && WAVE_MARKS.map((m, mi) => (
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
      {crowned && appearance.topping === "sugar-stars" && (
        <g aria-label="설탕 별 토핑" fill="#F8D872" stroke="#9A7334" strokeWidth="1.4">
          <path d="M-27 -45 l3 7 8 1 -6 5 2 8 -7 -4 -7 4 2 -8 -6 -5 8 -1 Z" />
          <path d="M0 -57 l3 7 8 1 -6 5 2 8 -7 -4 -7 4 2 -8 -6 -5 8 -1 Z" />
          <path d="M27 -44 l3 7 8 1 -6 5 2 8 -7 -4 -7 4 2 -8 -6 -5 8 -1 Z" />
        </g>
      )}
      {crowned && appearance.topping === "rainbow-sprinkles" && <g aria-label="무지개 스프링클"
        clipPath={`url(#${clipId})`}>
        {[[-20,-17,-25,"#F37E9A"],[0,-25,26,"#F7D56E"],[18,-17,-36,"#8EC8B0"],
          [-28,-3,28,"#B2A0DE"],[-8,-8,-24,"#F49765"],[11,-7,30,"#78B7D7"],
          [29,-1,32,"#A9A1E8"],[-21,12,-18,"#F5D271"],[1,11,30,"#E56B85"],
          [20,12,-33,"#8FC9AE"],[-4,1,25,"#F49765"],[10,22,-19,"#B2A0DE"]].map(([x,y,rot,color], index) =>
          <rect key={index} x={Number(x)-4.5} y={Number(y)-1.8} width="9" height="3.6" rx="1.8"
            fill={String(color)} transform={`rotate(${rot} ${x} ${y})`} />)}
      </g>}
      {crowned && appearance.topping === "chocolate-drizzle" && <g aria-label="초코 드리즐"
        clipPath={`url(#${clipId})`} fill="none" stroke="#654137" strokeLinecap="round" strokeLinejoin="round">
        <path d="M-35-8C-24-19-13-16-3-11 9-6 18-18 33-12M-34 6C-24-4-13-2-3 3 9 9 21-2 33 1"
          strokeWidth="6" />
        <path d="M-22-12C-20-4-25 3-20 8-16 12-17 5-16 2M9-7C12 1 7 8 11 13 14 16 16 9 14 6"
          strokeWidth="4" />
        <path d="M-33-11C-23-21-12-18-2-14 10-9 20-21 32-15" stroke="#A8775A"
          strokeWidth="2" opacity=".8" />
      </g>}
      {crowned && appearance.topping === "cheese-cubes" && <g aria-label="치즈 큐브"
        stroke="#D4A95D" strokeWidth="1.6" strokeLinejoin="round">
        <g clipPath={`url(#${clipId})`} fill={mark} stroke="none" opacity=".27">
          {CHEESE_CUBES.map(([x, y], index) =>
            <ellipse key={index} cx={x} cy={y + 7} rx="10" ry="4.5" />)}
        </g>
        {CHEESE_CUBES.map(([x,y,rot], index) =>
          <g key={index} transform={`translate(${x} ${y}) rotate(${rot})`}>
            <path d="M-8-6h16l5 5-5 10H-8l-5-5Z" fill="#F9DE8A" />
            <path d="M8-6l5 5-5 10-5-5Z" fill="#EBC773" />
            <circle cx="-2" cy="1" r="1.4" fill="#E8C46E" stroke="none" />
            <path d="M-10 5Q0 12 10 5" fill="none" stroke={fill} strokeWidth="4" />
          </g>)}
      </g>}
      {crowned && appearance.topping === "fresh-strawberry" && <g aria-label="딸기 토핑"
        transform="translate(0 -34) rotate(-14) scale(.8)">
        <path d="M-13-9Q0-17 13-9L10 2Q7 12 0 15Q-7 12-10 2Z"
          fill="#B93C51" stroke="#8D3445" strokeWidth="1.6" />
        <path d="M-10-7Q0-14 10-7L8 2Q5 9 0 11Q-5 9-8 2Z"
          fill="#FFD4BB" stroke="#F8A89E" strokeWidth="1" />
        <path d="M-7-6Q0-10 7-6L5 2Q3 6 0 7Q-3 6-5 2Z" fill="#F27B85" />
        <path d="M-13-9Q0-17 13-9" fill="none" stroke="#6D9F68" strokeWidth="2.5"
          strokeLinecap="round" />
        {[[ -5,-3],[4,-4],[-6,3],[4,3],[0,6]].map(([x,y], index) =>
          <ellipse key={index} cx={x} cy={y} rx=".8" ry="1.6" fill="#FFE6B7" />)}
      </g>}
      {crowned && !appearance.topping && (
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

      <title>{`${scoop.domainLabel} — ${scoop.title} (${formatDate(scoop.date)})`}</title>
    </>
  );
}
