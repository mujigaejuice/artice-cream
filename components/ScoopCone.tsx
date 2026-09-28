"use client";

import { useMemo, useState } from "react";

import {
  CHERRY_FILL,
  CHERRY_GLINT,
  CHERRY_STEM,
  CONE_FILL,
  CONE_LATTICE,
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

/**
 * 콘 — 아이스크림 도안.png(시안 4번 물결형)의 플랫 일러스트를 따른다.
 *
 * 입체 표현을 쓰지 않는다(그림자·그라디언트·질감 없음). 깊이는 겹침으로만 만들고,
 * 그래서 렌더 순서가 아래→위인 것이 중요하다.
 *
 * **외곽선은 도형마다 자기 채움색의 진한 버전이다**(outlineColor). 모든 도형에
 * 같은 색 선을 쓰면 밝은 스쿱일수록 선만 떠 보인다 — 도안도 초록 스쿱은 진한
 * 초록, 체리는 진한 빨강으로 그려져 있다. 하이라이트(highlightColor)와 물결
 * 자국(markColor)도 같은 방식으로 채움색에서 파생한다.
 *
 * 색은 scoopShade(도메인 슬러그, 완료 날짜)로 렌더 시점에 계산한다. 순수 함수라
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
};

export function ScoopCone({ scoops, selectedId, justAddedId, onSelect }: Props) {
  const [focusedId, setFocusedId] = useState<number | null>(null);

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

  const coneInk = hslStr(outlineColor(CONE_FILL));
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
        <pattern id="ac-waffle" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill={hslStr(CONE_FILL)} />
          <path
            d="M0 0 L16 16 M16 0 L0 16"
            stroke={hslStr(CONE_LATTICE)}
            strokeWidth="1.6"
          />
        </pattern>
      </defs>

      {/* 콘 — 선택 중에는 아래 무리와 함께 내려가 슬롯을 대칭으로 벌린다.
          내려갈 자리는 뷰박스에 늘 비워 둔 몫이라 콘 높이는 변하지 않는다. */}
      <g
        className="ac-cone"
        transform={`translate(0 ${selIdx != null ? PUSH_BELOW : 0})`}
      >
        <path
          d={conePath}
          fill="url(#ac-waffle)"
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

        const base = scoopShade(s.domain, s.date);
        const fill = hslStr(base);
        const ink = hslStr(outlineColor(base));
        const glow = hslStr(highlightColor(base));
        const mark = hslStr(markColor(base));

        return (
          <g
            key={s.id}
            className="ac-slot"
            transform={`translate(${x} ${cy}) scale(${scale})`}
          >
            <g
              className={`ac-scoop${s.id === justAddedId ? " ac-plop" : ""}`}
              role="button"
              tabIndex={0}
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

              {/* 본체 — 단색 + 자기 색 외곽선. 그라디언트도 질감도 없다. */}
              <path d={d} fill={fill} />

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
              {i === cherryIdx && (
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
