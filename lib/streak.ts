// lib/streak.ts — 크레딧정책.md P4 스트릭 보상. 지급 판단의 기준은 DB 함수
// grant_credit_streak / credit_streak_runs이고, 이 파일은 같은 규칙의 KST 날짜 계산을
// lib/day.ts로 표현한다. API는 현재 연속일 표시에, 검사는 DB 결과의 기대값 계산에 쓴다.

import { dayKey, nextDayKey } from "./day";

export const STREAK_BLOCK_DAYS = 7;

export type StreakPolicy = {
  enabled: boolean;
  /** 'YYYY-MM-DD' KST. 이 날짜 이전 완료일은 세지 않는다. */
  countsFrom: string | null;
  reward: number;
};

export type StreakRun = { start: string; end: string; days: number };

/** 원장 멱등 키: streak:<구간 시작일>:<7일 블록 번호>. */
export function streakSourceId(runStart: string, block: number): string {
  return `streak:${runStart}:${block}`;
}

/** 최초 완료 시각 → countsFrom 이후의 중복 없는 KST 날짜(오름차순). */
export function completionDays(completedAt: Array<Date | string>, countsFrom: string | null): string[] {
  const days = new Set(completedAt.map((at) => dayKey(typeof at === "string" ? new Date(at) : at)));
  return [...days].filter((day) => countsFrom === null || day >= countsFrom).sort();
}

/** 연속된 KST 날짜 구간. 하루라도 비면 새 구간이 시작된다. */
export function streakRuns(days: string[]): StreakRun[] {
  const runs: StreakRun[] = [];
  for (const day of [...new Set(days)].sort()) {
    const last = runs.at(-1);
    if (last && nextDayKey(last.end) === day) {
      last.end = day;
      last.days += 1;
    } else {
      runs.push({ start: day, end: day, days: 1 });
    }
  }
  return runs;
}

/**
 * `now`에 최초 완료가 기록된 직후 지급할 스트릭 보상. 이전 완료 시각 목록에는 이번 완료를
 * 포함한다. 그날로 끝나는 구간이 7의 배수일 때만 그 블록을 지급 대상으로 돌려준다.
 */
export function streakGrantAt(
  completedAt: Array<Date | string>, now: Date, policy: StreakPolicy,
): { sourceId: string; runStart: string; block: number; amount: number } | null {
  if (!policy.enabled || !policy.countsFrom) return null;
  const today = dayKey(now);
  if (today < policy.countsFrom) return null;
  const upToNow = completedAt.filter((at) => new Date(at).getTime() <= now.getTime());
  const run = streakRuns(completionDays(upToNow, policy.countsFrom)).find((r) => r.end === today);
  if (!run || run.days % STREAK_BLOCK_DAYS !== 0) return null;
  const block = run.days / STREAK_BLOCK_DAYS;
  return { sourceId: streakSourceId(run.start, block), runStart: run.start, block, amount: policy.reward };
}

/** 마지막 완료일이 오늘이나 어제(KST)면 연속이 이어지는 중이다. 그보다 오래됐으면 0. */
export function currentStreakDays(lastDay: string | null, days: number, now: Date = new Date()): number {
  if (!lastDay || !Number.isSafeInteger(days) || days <= 0) return 0;
  const today = dayKey(now);
  return lastDay === today || nextDayKey(lastDay) === today ? days : 0;
}

/** 다음 보상까지 남은 연속일(1~7). */
export function daysUntilStreakReward(days: number): number {
  return STREAK_BLOCK_DAYS - (Math.max(0, days) % STREAK_BLOCK_DAYS);
}
