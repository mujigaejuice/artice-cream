// lib/policy.ts — 정책.md의 결정을 코드로 옮긴 것.
// 숫자를 바꾸려면 정책.md를 먼저 고친다.

import type { Level } from "./ai/schemas";

/** 정책.md §3 재작성 본문 목표 길이(공백 제외 문자 수). [하한, 상한] */
export const SUMMARY_CHARS: Record<Level, [number, number]> = {
  1: [500, 800],
  2: [900, 1400],
  3: [1300, 2000],
};

/** 정책.md §3 원문이 짧아 하한에 못 미쳐도, 원문 대비 이 비율을 넘으면 통과시킨다. */
export const SUMMARY_MIN_RATIO = 0.6;

/** 정책.md §3 뉴스 원문 입력 상한. 넘으면 앞에서부터 자른다(역피라미드라 안전). */
export const MAX_BODY_CHARS = 12000;

/**
 * 정책.md §3 블로그 원문 입력 상한. 넘으면 그 글을 건너뛴다(결론이 뒤에 있어 자를 수 없다).
 * 글별 권리 검토 대상 중 12,000~15,000자 블로그도 온전히 추출하도록 뉴스와 분리한다.
 * 길이 제한과 별도로 소스·개별 글의 권리 게이트를 통과해야 가공·공개할 수 있다.
 */
export const MAX_BLOG_BODY_CHARS = 15000;

/** 정책.md §4 수준별 하이라이트 용어 개수 상한. */
export const GLOSSARY_MAX: Record<Level, number> = { 1: 12, 2: 8, 3: 5 };

/** 정책.md §5 퀴즈 문항 수 — 수준과 무관하게 고정. */
export const QUIZ_QUESTIONS = 4;

/** 정책.md §1 콘을 끊는 단위. */
export const CONE_PERIOD = "month" as const;

/** 정책.md §10 하루·한 달의 경계를 정하는 타임존. */
export const APP_TIMEZONE = "Asia/Seoul";

/** 소스분류.md §3 일일 수집 예산(USD). 넘으면 그 런을 처리한 만큼만 남기고 중단한다. */
export const INGEST_DAILY_BUDGET_USD = Number(
  process.env.INGEST_DAILY_BUDGET_USD ?? 1.0,
);

/**
 * 소스분류.md §1의 분류 수. `CATEGORY_SLUGS.length`로 읽지 않는 것은 schemas.ts가 이
 * 파일을 도로 import해서 순환이 되기 때문이다. scripts/check-logic.ts가 둘이 어긋나면
 * 잡는다.
 */
export const CATEGORY_COUNT = 8;

/** vercel.json schedules four collection/processing rounds per day. */
export const INGEST_RUNS_PER_DAY = 4;
export const COLLECT_CANDIDATES_PER_SOURCE = 20;
export const AUTO_REVIEW_LIMIT = 128;

/**
 * 한 분류의 가공 조각이 쓸 수 있는 예산.
 *
 * 인제스트를 분류별 cron으로 쪼개면서 조각마다 계측기가 따로 생겼다. 조각마다 일일
 * 예산을 통째로 주면 실행 횟수만큼 배가 된다. 정책.md §12의 일일 예산을
 * 분류 수와 하루 예약 실행 횟수로 나눠 쓴다. 수동 실행의 전역 예산은 아니다.
 */
export const INGEST_BUDGET_PER_CATEGORY_USD = INGEST_DAILY_BUDGET_USD / CATEGORY_COUNT / INGEST_RUNS_PER_DAY;

/** 소스분류.md §3 분류마다 실제 가공할 기사 수. */
export const ARTICLES_PER_CATEGORY = Number(
  process.env.INGEST_ARTICLES_PER_DOMAIN ?? 4,
);

/** 소스분류.md §4 분류 콜 배치 크기. */
export const CLASSIFY_BATCH_SIZE = 20;
