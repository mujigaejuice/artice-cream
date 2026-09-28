/**
 * 수준 조정 (spec §4.3, artice-cream-flow.jsx의 `grade`에서 추출).
 *
 * 서버가 신뢰 소스다 — /api/quiz/grade가 이걸 돌려 user_domain_levels를 갱신한다.
 * 클라이언트도 같은 함수를 import하지만 결과 화면 표시용일 뿐이므로,
 * 순수 함수로 유지한다(plan §1).
 *
 * MVP 규칙: 최근 3회 점수의 이동평균. ≥ 0.75 이면 +1, ≤ 0.4 이면 −1, 1~3 클램프.
 * Elo/IRT는 후속(spec §4.3).
 */

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 3;

/** 이동평균 창 크기. */
export const WINDOW = 3;

/**
 * 정책.md §11 — 4문항 고정(§5)으로 점수가 0.25 눈금에 떨어지면서 0.8은 그 눈금
 * 어디에도 닿지 않는다("4문제 중 3개를 세 번 연속"이 정확히 0.75). 0.8을 그대로
 * 두면 승급에 매번 만점이 필요해진다.
 */
export const PROMOTE_AT = 0.75;
export const DEMOTE_AT = 0.4;

/** 정책.md §14 — 초급·중급·고급은 사람에 대한 평가로 읽힌다. 바뀌는 건 글의 형태다. */
export const LEVEL_LABEL: Record<number, string> = {
  1: "쉽게 풀어쓴",
  2: "핵심만 정리한",
  3: "원문에 가까운",
};

/** 좁은 자리(카드, 리더 헤더)에 쓰는 축약형. */
export const levelShort = (level: number) => `Lv${clampLevel(level)}`;

export type LevelState = {
  level: number;
  /** 최근 점수(0~1), 오래된 것부터. 최대 WINDOW개. */
  history: number[];
};

export type LevelChange = LevelState & {
  prevLevel: number;
  /** 이동평균 값. user_domain_levels.rolling_accuracy에 그대로 저장한다. */
  rollingAccuracy: number;
  dir: "상승" | "유지" | "하강";
};

export const clampLevel = (level: number) =>
  Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));

export const levelLabel = (level: number) =>
  LEVEL_LABEL[clampLevel(level)] ?? LEVEL_LABEL[2];

/**
 * 퀴즈 1회 결과를 (user, domain) 수준에 반영한다.
 *
 * 창이 3개로 차기를 기다리지 않는다 — 프로토타입이 의도적으로 그렇게 동작한다
 * (history가 2개뿐인 도메인도 이번 퀴즈로 바로 움직인다). 이동평균 자체가
 * 급변을 막아 주므로 추가 게이트는 두지 않는다.
 *
 * @param score 이번 퀴즈 정답률 0~1
 */
export function applyQuiz(state: LevelState, score: number): LevelChange {
  const prevLevel = clampLevel(state.level);
  const ratio = Math.min(1, Math.max(0, score));
  const history = [...(state.history ?? []), ratio].slice(-WINDOW);
  const rollingAccuracy =
    history.reduce((a, b) => a + b, 0) / history.length;

  let level = prevLevel;
  let dir: LevelChange["dir"] = "유지";

  if (rollingAccuracy >= PROMOTE_AT && prevLevel < MAX_LEVEL) {
    level = prevLevel + 1;
    dir = "상승";
  } else if (rollingAccuracy <= DEMOTE_AT && prevLevel > MIN_LEVEL) {
    level = prevLevel - 1;
    dir = "하강";
  }

  return { level, history, prevLevel, rollingAccuracy, dir };
}
