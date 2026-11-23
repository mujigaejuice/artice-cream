/** Streak reward rules (크레딧정책.md P4) and the credits API streak field, without a database.
 * The same cases run against real PostgreSQL sessions in scripts/check-credits-db.mjs. */
import assert from "node:assert/strict";

import { dayKey, nextDayKey } from "../lib/day";
import {
  completionDays, currentStreakDays, daysUntilStreakReward, streakGrantAt, streakRuns,
  streakSourceId, type StreakPolicy,
} from "../lib/streak";

const kst = (day: string, time = "12:00") => new Date(`${day}T${time}:00+09:00`);
const addDays = (day: string, n: number) => {
  let value = day;
  for (let i = 0; i < n; i++) value = nextDayKey(value);
  return value;
};
const on: StreakPolicy = { enabled: true, countsFrom: "2026-11-01", reward: 50 };

/** Replays first completions in order against a ledger keyed like credit_events. */
function replay(completions: Date[], policy: StreakPolicy, retries = 1) {
  const ledger = new Map<string, number>();
  const seen: Date[] = [];
  for (const at of completions) {
    seen.push(at);
    for (let i = 0; i < retries; i++) {
      const grant = streakGrantAt(seen, at, policy);
      if (grant && !ledger.has(grant.sourceId)) ledger.set(grant.sourceId, grant.amount);
    }
  }
  return ledger;
}

function checkRules() {
  const week = Array.from({ length: 7 }, (_, i) => kst(addDays("2026-11-02", i)));

  assert.equal(replay(week, { ...on, enabled: false }).size, 0, "disabled grants nothing");
  assert.equal(replay(week, { enabled: true, countsFrom: null, reward: 50 }).size, 0, "no counting start, no grant");
  assert.deepEqual([...replay(week, on)], [["streak:2026-11-02:1", 50]], "day 7 pays block 1");

  // 23:30 KST and 00:30 KST are one UTC date but two KST dates.
  const late = kst("2026-11-02", "23:30");
  const early = kst("2026-11-03", "00:30");
  assert.equal(late.toISOString().slice(0, 10), early.toISOString().slice(0, 10));
  assert.deepEqual(completionDays([late, early], null), ["2026-11-02", "2026-11-03"]);
  assert.deepEqual(streakRuns(completionDays([late, early], null)), [{ start: "2026-11-02", end: "2026-11-03", days: 2 }]);
  // Day 7 completed at 00:30 KST pays on that KST date; 23:59 of day 6 does not.
  const boundaryWeek = [...week.slice(0, 6), kst("2026-11-08", "00:30")];
  assert.equal(replay(boundaryWeek, on).size, 1);
  assert.equal(replay([...week.slice(0, 6), kst("2026-11-07", "23:59")], on).size, 0);

  // Several first completions on one date count as one day, and pay once.
  const crowded = [...week.slice(0, 3), kst("2026-11-04", "08:00"), kst("2026-11-04", "21:00"), ...week.slice(3)];
  assert.deepEqual([...replay(crowded, on).keys()], ["streak:2026-11-02:1"]);
  const sameDay = [...week, kst("2026-11-08", "18:00"), kst("2026-11-08", "22:00")];
  assert.equal(replay(sameDay, on).size, 1);

  // Reviews do not write completed_at: only first-completion times enter the model. A day
  // with only a review is a gap.
  const reviewOnlyDay = week.filter((_, i) => i !== 3);
  assert.equal(replay(reviewOnlyDay, on).size, 0);

  // Retries and repeated evaluations of the same completion grant 7 and 14 exactly once.
  const fortnight = Array.from({ length: 14 }, (_, i) => kst(addDays("2026-11-02", i)));
  assert.deepEqual([...replay(fortnight, on, 5)],
    [["streak:2026-11-02:1", 50], ["streak:2026-11-02:2", 50]]);
  assert.equal(replay(Array.from({ length: 21 }, (_, i) => kst(addDays("2026-11-02", i))), on).size, 3);

  // A gap starts a new run with its own start date in the key.
  const gap = [...week.slice(0, 3), ...Array.from({ length: 7 }, (_, i) => kst(addDays("2026-11-06", i)))];
  assert.deepEqual([...replay(gap, on).keys()], ["streak:2026-11-06:1"]);
  assert.deepEqual(streakRuns(completionDays(gap, null)).map((run) => run.days), [3, 7]);

  // Dates before streak_counts_from never count, so a run straddling it starts there.
  const straddle = Array.from({ length: 11 }, (_, i) => kst(addDays("2026-10-28", i)));
  assert.deepEqual([...replay(straddle, on).keys()], ["streak:2026-11-01:1"]);
  assert.equal(replay(straddle, { ...on, countsFrom: "2026-11-04" }).size, 0);
  assert.equal(streakSourceId("2026-11-01", 3), "streak:2026-11-01:3");

  const now = kst("2026-11-10", "09:00");
  assert.equal(currentStreakDays("2026-11-10", 5, now), 5);
  assert.equal(currentStreakDays("2026-11-09", 5, now), 5, "today's completion may still come");
  assert.equal(currentStreakDays("2026-11-08", 5, now), 0, "a missed day ends the streak");
  assert.equal(currentStreakDays("2026-11-09", 5, kst("2026-11-11", "00:10")), 0, "KST midnight, not UTC");
  assert.equal(currentStreakDays(null, 5, now), 0);
  assert.deepEqual([0, 1, 6, 7, 8, 14].map(daysUntilStreakReward), [7, 6, 1, 7, 6, 7]);
  console.log("Streak rules: disabled, KST boundary, same-day, review, 7/14 once, gap and counting start passed.");
}

async function checkApi() {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://streak-api.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public",
    SUPABASE_SERVICE_ROLE_KEY: "test-private",
  });
  const userId = "11111111-1111-4111-8111-111111111111";
  let streak: unknown;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: userId, is_anonymous: false });
    assert.equal(url.pathname.split("/").pop(), "get_credit_snapshot");
    assert.equal(JSON.parse(String(init?.body)).p_user_id, userId);
    return Response.json({
      balance: "190", spendableBalance: "140", policyVersion: 5, earningMode: "active",
      spendingEnabled: true, hasWelcome: true, rules: { article: 10, quizBonusMax: 10, welcome: 100 },
      ...(streak === undefined ? {} : { streak }),
    });
  };
  try {
    const { GET } = await import("../app/api/credits/route");
    const read = async () => {
      const response = await GET(new Request("https://app.invalid/api/credits", {
        headers: { Authorization: "Bearer signed-token", Origin: "http://localhost:3000" },
      }));
      assert.equal(response.status, 200);
      return (await response.json()).streak;
    };
    const today = dayKey();
    const yesterday = dayKey(new Date(Date.now() - 86_400_000));
    const older = dayKey(new Date(Date.now() - 2 * 86_400_000));
    streak = { enabled: true, reward: 50, blockDays: 7, days: 7, lastDay: today };
    assert.deepEqual(await read(), { enabled: true, days: 7, reward: 50, blockDays: 7, daysUntilReward: 7 });
    streak = { enabled: true, reward: 50, blockDays: 7, days: 3, lastDay: yesterday };
    assert.equal((await read()).days, 3);
    streak = { enabled: true, reward: 50, blockDays: 7, days: 3, lastDay: older };
    assert.deepEqual(await read(), { enabled: true, days: 0, reward: 50, blockDays: 7, daysUntilReward: 7 });
    streak = { enabled: false, reward: 50, blockDays: 7, days: 0, lastDay: null };
    assert.equal((await read()).enabled, false);
    streak = undefined;
    assert.deepEqual(await read(), { enabled: false, days: 0, reward: 0, blockDays: 7, daysUntilReward: 7 },
      "a database without the streak migration reads as disabled");
    console.log("Streak API: current-run days, expiry after a missed KST day and disabled fallback passed.");
  } finally { globalThis.fetch = originalFetch; }
}

checkRules();
checkApi().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
