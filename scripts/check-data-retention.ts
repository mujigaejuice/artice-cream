/** Real route and SDK with in-memory usage rows. Never connects to a database. */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { deleteExpiredUsage, retentionCutoffs } from "../lib/data-retention";

async function main() {
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://retention.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "test-admin-key", CRON_SECRET: "test-cron-secret" });
  const now = new Date("2026-10-11T00:00:00+09:00");
  const cutoff = retentionCutoffs(now);
  assert.deepEqual(cutoff, { quotaDate: "2026-09-11", adCreatedAt: "2026-09-10T15:00:00.000Z" });
  assert.equal(retentionCutoffs(new Date(now.getTime() - 1)).quotaDate, "2026-09-10", "KST midnight boundary");
  assert.throws(() => retentionCutoffs(new Date("invalid")));

  type Row = { key: string; quota_date?: string; created_at?: string };
  const rows: Record<string, Row[]> = {
    daily_quota: [{ key: "old", quota_date: "2026-09-10" }, { key: "boundary", quota_date: cutoff.quotaDate },
      { key: "today", quota_date: "2026-10-11" }],
    ad_views: [{ key: "old", created_at: "2026-09-10T14:59:59.999Z" },
      { key: "boundary", created_at: cutoff.adCreatedAt }, { key: "today", created_at: now.toISOString() }],
  };
  let calls = 0;
  let failTable: string | null = null;
  globalThis.fetch = async (input, init) => {
    calls++;
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://retention.invalid");
    assert.equal(init?.method, "DELETE");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-admin-key");
    assert.match(new Headers(init?.headers).get("prefer") ?? "", /count=exact/);
    const table = url.pathname.split("/").pop()!;
    assert.ok(["daily_quota", "ad_views"].includes(table), "must never touch account, reading history or content tables");
    if (table === failTable) return Response.json({ message: "private database details", code: "XX000" }, { status: 500 });
    const column = table === "daily_quota" ? "quota_date" : "created_at";
    assert.deepEqual([...url.searchParams.keys()], [column], "deletion requires exactly the age predicate");
    const filter = url.searchParams.get(column)!;
    assert.ok(filter.startsWith("lt."));
    const before = rows[table].length;
    rows[table] = rows[table].filter((row) => row[column]! >= filter.slice(3));
    return new Response(null, { status: 204, headers: { "content-range": `*/${before - rows[table].length}` } });
  };
  const admin = createClient("https://retention.invalid", "test-admin-key", { auth: { persistSession: false, autoRefreshToken: false } });
  assert.deepEqual(await deleteExpiredUsage(admin, now), { dailyQuotaDeleted: 1, adViewsDeleted: 1 });
  for (const table of Object.keys(rows)) assert.deepEqual(rows[table].map((row) => row.key), ["boundary", "today"]);
  assert.deepEqual(await deleteExpiredUsage(admin, now), { dailyQuotaDeleted: 0, adViewsDeleted: 0 }, "safe to rerun");

  // A failed second delete must be reported, and retry must complete the remaining work.
  rows.daily_quota.push({ key: "retry", quota_date: "2026-01-01" });
  rows.ad_views.push({ key: "retry", created_at: "2026-01-01T00:00:00.000Z" });
  failTable = "ad_views";
  await assert.rejects(deleteExpiredUsage(admin, now), /Usage cleanup failed/);
  assert.equal(rows.ad_views.some((row) => row.key === "retry"), true);
  failTable = null;
  assert.deepEqual(await deleteExpiredUsage(admin, now), { dailyQuotaDeleted: 0, adViewsDeleted: 1 });

  const { GET } = await import("../app/api/cron/cleanup/route.api");
  const request = (token?: string) => new Request("https://app.invalid/api/cron/cleanup?days=0", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const beforeDenied = calls;
  for (const token of [undefined, "wrong", "test-admin-key"]) {
    assert.equal((await GET(request(token))).status, 401);
  }
  delete process.env.CRON_SECRET;
  assert.equal((await GET(request())).status, 401, "missing cron secret must fail closed, including in development");
  assert.equal(calls, beforeDenied, "unauthorized callers cannot contact the database");
  process.env.CRON_SECRET = "test-cron-secret";
  rows.daily_quota = [{ key: "today", quota_date: retentionCutoffs(new Date(Date.now() + 30 * 86_400_000)).quotaDate }];
  rows.ad_views = [{ key: "today", created_at: new Date().toISOString() }];
  failTable = "daily_quota";
  const failed = await GET(request("test-cron-secret"));
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: "cleanup_failed" }, "no vendor details exposed");
  failTable = null;
  const success = await GET(request("test-cron-secret"));
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("cache-control"), "no-store");
  assert.deepEqual(await success.json(), { ok: true, dailyQuotaDeleted: 0, adViewsDeleted: 0 });
  assert.equal(rows.daily_quota.length, 1, "query parameters cannot shorten retention");
  assert.equal(rows.ad_views.length, 1, "today's nonce records remain for replay prevention");
  console.log("Data retention: KST/30-day boundaries, narrow scope, auth, retry and error privacy passed.");
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
