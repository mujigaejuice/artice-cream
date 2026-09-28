// lib/news/ingest.ts — 인제스트 두 단계가 같이 쓰는 것들.
//
// 한 런이 Vercel 함수 상한에 들어가지 않아서(2026-09-21 실측 15분 초과) 수집을
// 두 단계로 쪼갰다. 소스분류.md §3의 흐름은 그대로고, 끊는 자리만 달라진다.
//
//   /api/cron/ingest              피드 → 중복 제거 → 분류 → articles(pending | rejected)
//   /api/cron/ingest/<분류>       pending → 본문 추출 → LLM ×3수준 → articles(ready)
//
// 왜 분류마다 cron을 따로 두는가: Hobby 플랜의 함수 상한은 300초로 고정이라 올릴
// 수가 없다. 대신 cron은 플랜과 무관하게 프로젝트당 100개까지 걸 수 있고, Hobby도
// "각각 하루 한 번"이면 규칙에 맞는다. 분류 하나를 가공하는 데 1~2분이면 되므로
// 8개로 나누면 어느 조각도 상한 근처에 가지 않는다.
//
// 분류를 8번 반복하면서 피드를 다시 읽지 않는 이유도 같다 — 수집과 분류는 런당
// 한 번이면 되고, 8번 반복하면 분류 콜 값을 여덟 배로 낸다(정책.md §12).

import type { NextRequest } from "next/server";

/**
 * 라우트의 `maxDuration`과 같이 움직여야 하는 값이다. `maxDuration`은 정적으로
 * 읽히는 리터럴이어야 해서 환경변수를 넣을 수 없다. Pro로 올려 800초를 쓰게 되면
 * 두 라우트의 리터럴과 이 기본값을 같이 고친다.
 */
export const INGEST_MAX_SECONDS = Number(process.env.INGEST_MAX_SECONDS ?? 300);

/**
 * 상한에 닿기 전에 우리가 먼저 멈추는 여유. 플랫폼이 함수를 죽이면 응답도 로그도
 * 남지 않아서 어디까지 했는지 알 수가 없다.
 */
const SAFETY_SECONDS = 30;

export type Deadline = {
  expired: () => boolean;
  remainingSeconds: () => number;
  elapsedSeconds: () => number;
};

export function startDeadline(startedAt: number = Date.now()): Deadline {
  const endsAt = startedAt + Math.max(30, INGEST_MAX_SECONDS - SAFETY_SECONDS) * 1000;
  return {
    expired: () => Date.now() >= endsAt,
    remainingSeconds: () => Math.max(0, Math.round((endsAt - Date.now()) / 1000)),
    elapsedSeconds: () => Math.round((Date.now() - startedAt) / 1000),
  };
}

/** Vercel Cron은 `Authorization: Bearer $CRON_SECRET`을 보낸다. */
export function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** 동시에 `limit`개까지만 돌리는 map. 피드 41개를 순서대로 열면 그것만으로 몇 분이 간다. */
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** 피드를 한 번에 몇 개까지 여는가. 41개를 8개씩 열면 실측 20초 안쪽이다. */
export const FEED_CONCURRENCY = 8;

/**
 * `pending`으로 남은 후보를 며칠까지 들고 있는가.
 *
 * 분류는 통과했지만 아직 가공하지 못한 글이다. 매일 분류당 한 편만 가공하므로
 * 공급이 많은 분류에서는 줄이 계속 길어진다. 오래된 것은 어차피 읽을 가치가
 * 떨어지므로 잘라낸다.
 */
export const PENDING_TTL_DAYS = 10;

/** PostgREST는 `in()` 목록을 쿼리스트링에 싣는다. 수백 건을 한 번에 넣으면 URL이 깨진다. */
export const URL_FILTER_CHUNK = 80;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
