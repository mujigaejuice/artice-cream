/**
 * 스쿱 플레이버 색. scoop-cone.jsx 프로토타입에서 그대로 추출했다.
 *
 * 서버와 클라이언트가 같은 색을 계산해야 하므로 순수 함수로 둔다(plan §1).
 * 입력이 (도메인 슬러그, 날짜)뿐이라 DB에 색을 저장할 필요가 없다 —
 * user_article_progress에 색 컬럼이 없는 이유.
 *
 * 날짜 문자열('YYYY-MM-DD')에서 직접 계산한다(정책.md §10) — 로컬 `new Date()`
 * 파싱을 거치면 서버·클라이언트 실행 환경(타임존)에 따라 다른 색이 나올 수 있다.
 */

export type Hsl = { h: number; s: number; l: number };

/**
 * 도메인 코어 컬러(플레이버). 키는 domains.slug와 일치해야 한다.
 * 소스분류.md §3 — 도안에 맞춰 둔 기존 여섯 플레이버를 재사용하고, CS 기초(바닐라)와
 * 데이터(녹차) 둘을 새로 더했다. 이 둘은 도안에 대 보지 않았으니 /preview에서 확인한다.
 */
export const DOMAIN_FLAVORS: Record<string, { label: string } & Hsl> = {
  cloud: { label: "클라우드", h: 199, s: 66, l: 77 }, // 블루라즈베리
  infra: { label: "인프라", h: 148, s: 52, l: 77 }, // 피스타치오
  data: { label: "데이터", h: 85, s: 38, l: 72 }, // 녹차
  "cs-fundamentals": { label: "CS 기초", h: 48, s: 50, l: 87 }, // 바닐라
  "deep-learning": { label: "딥러닝", h: 244, s: 56, l: 81 }, // 블루베리
  llm: { label: "LLM", h: 279, s: 52, l: 82 }, // 포도
  "ai-security": { label: "AI 보안", h: 342, s: 70, l: 84 }, // 딸기
  security: { label: "보안", h: 30, s: 84, l: 79 }, // 망고
};

/** 슬러그가 DOMAIN_FLAVORS에 없을 때(새 도메인 추가 등) 쓰는 중립색. */
const FALLBACK: Hsl = { h: 40, s: 30, l: 62 };

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export const hslc = (h: number, s: number, l: number) =>
  `hsl(${h}, ${s}%, ${l}%)`;

export const hslStr = (c: Hsl) => hslc(c.h, c.s, c.l);

/** 'YYYY-MM-DD' 문자열에서 직접 계산 — 어디서 돌든 같은 값이 나온다. */
const dayIndex = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * 외곽선 = 채움색의 진한 버전.
 *
 * 아이스크림 도안.png에서 잰 값 — 스쿱 채움 hsl(134,49%,86%) / 선 hsl(157,27%,46%),
 * 체리 채움 hsl(356,98%,66%) / 선 hsl(359,58%,49%). 채도는 둘 다 약 0.56배인데
 * 명도는 40 낮은 곳과 17 낮은 곳으로 갈린다. 갈리는 게 아니라 **선이 둘 다
 * l≈47에 내려앉은 것**이라, 명도 차가 아니라 도달점으로 규칙을 잡았다.
 *
 * `l - 20`은 그 위의 상한이다. 어두운 채움(scoopShade의 하한 l=44)에 47을 그대로
 * 쓰면 선이 채움보다 밝아져 버린다.
 *
 * 색상은 그대로 둔다. 도안의 초록 선은 +23° 틀어져 있지만 같은 그림의 빨강 선은
 * +3°뿐이라, 규칙이 아니라 그 물감의 성질로 본다. 모든 스쿱에 같은 색 선을 쓰면
 * 색이 밝을수록 선만 떠 보인다 — 그걸 막는 게 이 함수의 본래 목적이다.
 */
export function outlineColor(c: Hsl): Hsl {
  return {
    h: c.h,
    s: round1(clamp(c.s * 0.56, 0, 100)),
    l: round1(clamp(Math.min(c.l - 20, 47), 0, 100)),
  };
}

/**
 * 물결 자국 = 채움과 외곽선 사이의 중간톤.
 *
 * 도안 실측: 채움 hsl(134,49%,86%)에 자국 hsl(146,31%,64%). 채도 0.63배,
 * 명도 -22다. 외곽선만큼 진하면 자국이 실루엣처럼 읽히고, 더 옅으면 물결이
 * 사라진다 — 이 그림을 "물결형"으로 만드는 것이 사실상 이 자국이다.
 */
export function markColor(c: Hsl): Hsl {
  return {
    h: c.h,
    s: round1(clamp(c.s * 0.63, 0, 100)),
    l: round1(clamp(c.l - 22, 0, 100)),
  };
}

/**
 * 하이라이트 = 채움색의 흰 쪽 끝.
 *
 * 도안 실측: 채움 hsl(134,49%,86%)에 하이라이트 hsl(109,62%,95%). 색상이 -25°
 * 틀어져 있으나 명도 95에서는 색상이 거의 드러나지 않아 그대로 둔다.
 */
export function highlightColor(c: Hsl): Hsl {
  return {
    h: c.h,
    s: round1(clamp(c.s * 1.25, 0, 100)),
    l: round1(clamp(c.l + 9, 0, 97)),
  };
}

/** 콘(와플)과 체리 — 선은 outlineColor로 파생한다. */
export const CONE_FILL: Hsl = { h: 32, s: 69, l: 71 };
export const CONE_LATTICE: Hsl = { h: 32, s: 45, l: 58 };
/** 아이스크림 도안.png의 체리 실측값. */
export const CHERRY_FILL: Hsl = { h: 356, s: 98, l: 66 };
export const CHERRY_GLINT: Hsl = { h: 5, s: 96, l: 88 };
export const CHERRY_STEM: Hsl = { h: 10, s: 30, l: 34 };

export function coreColor(domainKey: string): string {
  const c = DOMAIN_FLAVORS[domainKey] ?? FALLBACK;
  return hslc(c.h, c.s, c.l);
}

/** 도메인 코어 컬러에 '완료한 날짜'로 결정되는 소폭 오프셋을 더한다(결정론적). */
export function scoopShade(domainKey: string, dateStr: string): Hsl {
  const c = DOMAIN_FLAVORS[domainKey] ?? FALLBACK;
  const k = dayIndex(dateStr);
  const h = c.h + ((k % 9) - 4) * 1.7; // ≈ ±7°
  const s = clamp(c.s + (((k * 5) % 9) - 4) * 1.6, 30, 92); // ≈ ±6
  const l = clamp(c.l + (((k * 3) % 11) - 5) * 1.5, 44, 90); // ≈ ±8
  return { h, s, l };
}

export const formatDate = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
