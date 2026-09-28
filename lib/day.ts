// lib/day.ts — 정책.md §10. 하루·한 달의 경계는 항상 APP_TIMEZONE(KST) 기준이다.
// UTC 타임스탬프를 다루는 모든 곳(쿼터 날짜, 스쿱 날짜, 콘 월 필터)이 여길 거친다.

import { APP_TIMEZONE } from "./policy";

const KST_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 임의의 시각을 APP_TIMEZONE 기준 'YYYY-MM-DD'로. */
export function dayKey(d: Date = new Date()): string {
  // en-CA 로케일은 'YYYY-MM-DD'를 그대로 낸다.
  return KST_FORMATTER.format(d);
}

/** 'YYYY-MM-DD'(KST 기준 하루)의 UTC 경계 — [시작, 다음날 시작) 반개구간. */
export function dayRangeUtc(day: string): [string, string] {
  // KST는 UTC+9 고정(서머타임 없음)이므로 오프셋 계산이 단순하다.
  const start = new Date(`${day}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 86_400_000);
  return [start.toISOString(), end.toISOString()];
}

/** 'YYYY-MM-DD' 하루를 다음 날로. */
export function nextDayKey(day: string): string {
  const [, end] = dayRangeUtc(day);
  return dayKey(new Date(end));
}

/** 'YYYY-MM'(KST 기준 한 달)의 UTC 경계 — [시작, 다음달 시작) 반개구간. 정책.md §1 콘 월 필터. */
export function monthRangeUtc(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(`${month}-01T00:00:00+09:00`);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const end = new Date(`${nextMonth}-01T00:00:00+09:00`);
  return [start.toISOString(), end.toISOString()];
}

/** timestamptz(또는 그 문자열) → KST 기준 'YYYY-MM'. */
export function monthKey(d: Date | string): string {
  return dayKey(typeof d === "string" ? new Date(d) : d).slice(0, 7);
}
