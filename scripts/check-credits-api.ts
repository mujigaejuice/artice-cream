/** Exercise the real private credit handlers against isolated Supabase HTTP responses. */
import assert from "node:assert/strict";

async function main() {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://credits-api.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public",
    SUPABASE_SERVICE_ROLE_KEY: "test-private",
  });
  const originalFetch = globalThis.fetch;
  let currentUser = "11111111-1111-4111-8111-111111111111";
  let storageFails = false;
  const events = Array.from({ length: 25 }, (_, i) => ({
    event_id: String(25 - i), amount: i === 0 ? 100 : 10,
    reason: i === 0 ? "welcome" : "article_read",
    created_at: `2026-10-25T00:00:${String(25 - i).padStart(2, "0")}.123456+00:00`,
    article_id: String(25 - i),
    article_title: "Fixture",
  }));

  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://credits-api.invalid");
    if (url.pathname === "/auth/v1/user") {
      return currentUser ? Response.json({ id: currentUser, is_anonymous: false })
        : Response.json({ message: "unauthenticated" }, { status: 401 });
    }
    const rpc = url.pathname.split("/").pop();
    const body = JSON.parse(String(init?.body));
    assert.equal(body.p_user_id, currentUser, "server binds the verified account");
    if (storageFails) return Response.json({ message: "database unavailable" }, { status: 503 });
    if (rpc === "get_credit_snapshot") return Response.json({
      balance: currentUser.startsWith("1") ? "340" : "0", policyVersion: 1,
      earningMode: "active", spendingEnabled: false, hasWelcome: true,
      rules: { article: 10, quizBonusMax: 10, welcome: 100 },
    });
    assert.equal(rpc, "get_credit_history");
    const start = body.p_before_id == null ? 0 : events.findIndex(row => row.event_id === body.p_before_id) + 1;
    return Response.json(events.slice(start, start + body.p_limit));
  };

  try {
    const { GET: balance } = await import("../app/api/credits/route.api");
    const { GET: history } = await import("../app/api/credits/history/route.api");
    const request = (path: string) => new Request(`https://app.invalid${path}`, {
      headers: { Authorization: "Bearer signed-token", Origin: "https://localhost" },
    });
    let response = await balance(request("/api/credits"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const firstSnapshot = await response.json();
    assert.equal(firstSnapshot.balance, 340);
    assert.equal(firstSnapshot.userId, currentUser);
    response = await history(request("/api/credits/history"));
    assert.equal(response.status, 200);
    const first = await response.json();
    assert.equal(first.userId, currentUser);
    assert.equal(first.events.length, 20);
    assert.equal(first.events[0].id, "25");
    assert.ok(first.nextCursor);
    const second = await (await history(request(`/api/credits/history?cursor=${first.nextCursor}`))).json();
    assert.equal(second.events.length, 5);
    assert.equal(second.nextCursor, null);
    assert.equal(new Set([...first.events, ...second.events].map(row => row.id)).size, 25);
    assert.equal((await history(request("/api/credits/history?cursor=invalid"))).status, 400);
    assert.equal((await history(request("/api/credits/history?limit=51"))).status, 400);
    currentUser = "22222222-2222-4222-8222-222222222222";
    assert.equal((await (await balance(request("/api/credits"))).json()).balance, 0);
    currentUser = "";
    assert.equal((await balance(request("/api/credits"))).status, 401);
    assert.equal((await history(request("/api/credits/history"))).status, 401);
    currentUser = "11111111-1111-4111-8111-111111111111";
    storageFails = true;
    assert.equal((await balance(request("/api/credits"))).status, 503);
    assert.equal((await history(request("/api/credits/history"))).status, 503);
    console.log("Credits API: account binding, exact cursor pagination, private responses and storage errors passed.");
  } finally { globalThis.fetch = originalFetch; }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
