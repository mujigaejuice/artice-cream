/** Real route + real Supabase SDK, isolated HTTP. Never touches live accounts. */
import assert from "node:assert/strict";

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://deletion-test.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-test-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "private-test-key";
  const id = "11111111-1111-4111-8111-111111111111";
  const otherId = "22222222-2222-4222-8222-222222222222";
  const now = Math.floor(Date.now() / 1000);
  const token = (claims: Record<string, unknown> = {}) => [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: id, role: "authenticated", exp: now + 3600,
      iat: now, amr: [{ method: "otp", timestamp: now }], ...claims })).toString("base64url"),
    "mock-signature",
  ].join(".");
  const user = { id, email: "reader@example.test", is_anonymous: false, last_sign_in_at: new Date().toISOString() };
  let authMode: "valid" | "invalid" | "anonymous" | "unavailable" = "valid";
  let deletionMode: "success" | "failure" | "missing" | "throw" = "success";
  let deleteCalls = 0;
  let deleted = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://deletion-test.invalid", "test must never use the network");
    if (url.pathname === "/auth/v1/user") {
      if (authMode === "unavailable") throw new Error("Auth connection unavailable");
      if (authMode === "invalid" || deleted) return Response.json({ code: "user_not_found", msg: "missing user" }, { status: 403 });
      return Response.json({ ...user, is_anonymous: authMode === "anonymous" });
    }
    assert.equal(url.pathname, `/auth/v1/admin/users/${id}`, "only verified self can be deleted");
    assert.equal(init?.method, "DELETE");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer private-test-key");
    assert.deepEqual(JSON.parse(String(init?.body)), { should_soft_delete: false });
    deleteCalls++;
    if (deletionMode === "throw") throw new Error("sensitive vendor detail");
    if (deletionMode === "failure") return Response.json({ code: "unexpected_failure", msg: "sensitive vendor detail" }, { status: 400 });
    if (deletionMode === "missing") return Response.json({ code: "user_not_found", msg: "already deleted" }, { status: 404, headers: { "x-supabase-api-version": "2024-01-01" } });
    deleted = true;
    return Response.json({ user });
  };

  const { GET, POST, OPTIONS } = await import("../app/api/account/delete/route.api");
  const { hasRecentAuthentication } = await import("../lib/account-deletion");
  const request = (bearer: string | null = token(), body: unknown = { expectedUserId: id, confirmation: "계정 삭제" }) =>
    new Request("https://app.invalid/api/account/delete", { method: "POST", headers: {
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), "Content-Type": "application/json", Origin: "https://localhost",
    }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const check = async (req: Request, status: number, code: string) => {
    const response = await POST(req);
    assert.equal(response.status, status);
    assert.equal((await response.json()).error, code);
    assert.equal(response.headers.get("cache-control"), "no-store");
  };
  assert.equal(OPTIONS(request()).status, 204);
  assert.equal(OPTIONS(request()).headers.get("access-control-allow-origin"), "https://localhost");
  assert.equal((await GET(request(null))).status, 401);
  await check(request(null), 401, "unauthenticated");
  authMode = "invalid";
  await check(request(), 401, "unauthenticated");
  authMode = "anonymous";
  await check(request(), 401, "unauthenticated");
  authMode = "valid";
  await check(request(token(), "{"), 400, "confirmation_required");
  await check(request(token(), null), 400, "confirmation_required");
  await check(request(token(), { expectedUserId: id, confirmation: "삭제" }), 400, "confirmation_required");
  await check(request(token(), { expectedUserId: id, confirmation: "계정 삭제", userId: otherId }), 400, "confirmation_required");
  await check(request(token(), { expectedUserId: otherId, confirmation: "계정 삭제" }), 409, "account_changed");
  for (const amr of [undefined, [], ["otp"], [null], [{ method: "token_refresh", timestamp: now }],
    [{ method: "otp", timestamp: now - 601 }], [{ method: "otp", timestamp: now + 60 }],
    [{ method: "otp", timestamp: "recent" }]]) {
    await check(request(token({ amr })), 403, "reauthentication_required");
  }
  await check(request(token({ sub: otherId })), 403, "reauthentication_required");
  await check(request("malformed"), 403, "reauthentication_required");
  assert.equal(deleteCalls, 0, "invalid requests cannot reach admin deletion");
  assert.equal((await (await GET(request(token({ amr: [] })))).json()).canDelete, false);
  const profile = await (await GET(request())).json();
  assert.deepEqual(profile, { userId: id, email: user.email, canDelete: true });
  for (const method of ["oauth", "otp", "password"]) {
    assert.equal(hasRecentAuthentication(token({ amr: [{ method, timestamp: now }] }), user as never, now * 1000), true);
  }
  // iat/last_sign_in_at can be recent after another device logs in; own AMR must still be fresh.
  assert.equal(hasRecentAuthentication(token({ amr: [{ method: "oauth", timestamp: now - 3600 }] }), user as never), false);
  deletionMode = "failure";
  await check(request(), 503, "deletion_failed");
  assert.equal(deleted, false);
  deletionMode = "missing";
  assert.deepEqual(await (await POST(request())).json(), { deleted: true });
  deletionMode = "success";
  const success = await POST(request());
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { deleted: true });
  assert.equal(success.headers.get("access-control-allow-origin"), "https://localhost");
  const callsAfterDeletion = deleteCalls;
  await check(request(), 401, "unauthenticated");
  assert.equal((await GET(request())).status, 401);
  assert.equal(deleteCalls, callsAfterDeletion, "old sessions cannot delete again");

  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } } });
  const returns = await import("../lib/deletion-return");
  returns.rememberDeletionReturn();
  assert.equal(returns.consumeDeletionReturn("/"), "/account/delete/");
  assert.equal(returns.consumeDeletionReturn("/"), "/", "hint is consumed once");
  for (const value of ["https://evil.invalid", String(Date.now() - 3600_001), String(Date.now() + 60_000)]) {
    storage.set("artice-delete-return", value);
    assert.equal(returns.consumeDeletionReturn("/"), "/");
  }
  assert.equal(returns.deletionAuthFailure("/account/delete/", "/onboarding"), "/account/delete/?error=auth");
  console.log("Account deletion: verified self, confirmation, recent auth, hard delete, failure, stale session, CORS and callback checks passed.");
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
