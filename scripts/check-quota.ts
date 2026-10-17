/** Real handlers/SDK with isolated HTTP; concurrency is covered by test:quota-db. */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { getQuota } from "../lib/quota";

async function main() {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://quota.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public",
    SUPABASE_SERVICE_ROLE_KEY: "test-private", AD_REWARD_SECRET: "quota-test-secret",
  });
  const userId = "11111111-1111-4111-8111-111111111111";
  const quota = { date: "2026-10-16", freeUsed: false, adUnlocks: 1, remaining: 2,
    canRead: true, canUnlockWithAd: true, adUnlocksGrantedToday: 1 };
  let result: unknown = { status: "granted", quota };
  let unavailable = false;
  let writes = 0;
  let expectedNonce = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://quota.invalid", "no real HTTP calls");
    if (url.pathname === "/auth/v1/user") return Response.json({ id: userId, is_anonymous: false });
    const body = JSON.parse(String(init?.body));
    assert.equal(body.p_user_id, userId, "user ID must come from the verified session");
    if (url.pathname === "/rest/v1/rpc/grant_ad_unlock") {
      writes++;
      assert.equal(body.p_nonce, expectedNonce);
    } else {
      assert.equal(url.pathname, "/rest/v1/rpc/get_daily_quota");
    }
    if (unavailable) return Response.json({ message: "DB unavailable", code: "XX000" }, { status: 500 });
    return Response.json(result);
  };
  try {
    const { GET, POST } = await import("../app/api/ads/reward/route.api");
    const { createAdminClient } = await import("../lib/supabase/admin");
    const request = (body?: unknown, signedIn = true) => new Request("https://app.invalid/api/ads/reward", {
      headers: { ...(signedIn ? { Authorization: "Bearer test-session" } : {}),
        Origin: "https://localhost", "Content-Type": "application/json" },
      ...(body !== undefined ? { method: "POST", body: JSON.stringify(body) } : {}),
    });
    assert.equal((await GET(request(undefined, false))).status, 401);
    assert.equal((await POST(request({ nonce: "fake" }, false))).status, 401);
    expectedNonce = (await (await GET(request())).json()).nonce;
    const post = () => POST(request({ nonce: expectedNonce, userId: "attacker-controlled" }));
    for (const status of ["granted", "replayed"]) {
      result = { status, quota };
      const response = await post();
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { quota });
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("access-control-allow-origin"), "https://localhost");
    }
    for (const [status, httpStatus] of [["limit", 429], ["conflict", 409]] as const) {
      result = { status };
      assert.equal((await post()).status, httpStatus);
    }
    unavailable = true;
    assert.equal((await post()).status, 503, "storage errors must not masquerade as nonce reuse");
    await assert.rejects(getQuota(createAdminClient(), userId), { message: "DB unavailable" });
    unavailable = false;
    for (const invalid of [null, {}, { opened: true }, { status: "unknown" }]) {
      result = invalid;
      assert.equal((await post()).status, 503);
    }
    result = quota;
    assert.deepEqual(await getQuota(createAdminClient(), userId), quota);
    result = null;
    await assert.rejects(getQuota(createAdminClient(), userId), /Missing quota/);

    const sign = (user: string, at: number) => {
      const payload = `${user}.${at}-1234abcd`;
      return `${payload}.${createHmac("sha256", process.env.AD_REWARD_SECRET!).update(payload).digest("hex")}`;
    };
    const before = writes;
    for (const nonce of [undefined, null, 123, {}, [], "x".repeat(513), "bad", `${expectedNonce}.extra`,
      `${expectedNonce.slice(0, -64)}${"0".repeat(64)}`, `${expectedNonce}zz`,
      sign(userId, Date.now() - 601_000), sign(userId, Date.now() + 60_000), sign("other-user", Date.now())]) {
      assert.equal((await POST(request({ nonce }))).status, 400);
    }
    const malformed = new Request("https://app.invalid/api/ads/reward", {
      method: "POST", headers: { Authorization: "Bearer test-session" }, body: "{",
    });
    assert.equal((await POST(malformed)).status, 400);
    assert.equal(writes, before, "invalid nonces never reach the reward transaction");
    console.log("Quota API: session binding, idempotent response, cap/conflict, DB failure, malformed/expired/future nonce and no-store/CORS passed.");
  } finally { globalThis.fetch = originalFetch; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
