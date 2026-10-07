/** Real Supabase client + fake storage/HTTP: no network or real account access. */
import assert from "node:assert/strict";

async function main() {
  const native = process.argv.includes("--native");
  const storage = new Map<string, string>();
  let denyRemoval = false;
  const remove = (key: string) => {
    if (denyRemoval) throw new Error("Storage unavailable");
    storage.delete(key);
  };

  if (native) {
    Object.defineProperty(globalThis, "Capacitor", { configurable: true, value: {
      isNativePlatform: () => true,
      Plugins: { Preferences: {
        get: async ({ key }: { key: string }) => ({ value: storage.get(key) ?? null }),
        set: async ({ key, value }: { key: string; value: string }) => { storage.set(key, value); },
        remove: async ({ key }: { key: string }) => { remove(key); },
      } },
    } });
  } else {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { storage.set(key, value); },
        removeItem: remove,
      },
    } });
  }

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-test.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  const requests: URL[] = [];
  let logoutStatus = 204;
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://auth-test.invalid");
    assert.equal(url.pathname, "/auth/v1/logout");
    requests.push(url);
    return logoutStatus === 204 ? new Response(null, { status: 204 }) :
      Response.json({ error_code: "user_not_found", msg: "deleted user" }, { status: logoutStatus });
  };

  const session = JSON.stringify({
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "test-user", email: "reader@example.test", is_anonymous: false },
  });
  storage.set("artice-auth", session);
  storage.set("unrelated-preference", "keep");

  const { createClient, signOutCurrentDevice } = await import("../lib/supabase/client");
  const client = createClient();
  try {
    assert.ok((await client.auth.getSession()).data.session);
    await signOutCurrentDevice();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].searchParams.get("scope"), "local", "do not revoke other devices");
    assert.equal(storage.has("artice-auth"), false);
    assert.equal((await client.auth.getSession()).data.session, null);
    assert.equal(storage.get("unrelated-preference"), "keep");

    // Already signed out: safe to retry without another HTTP request.
    await signOutCurrentDevice();
    assert.equal(requests.length, 1);

    // Failed persistence must not be reported as a successful logout.
    storage.set("artice-auth", session);
    denyRemoval = true;
    await assert.rejects(signOutCurrentDevice(), /Session was not cleared/);
    assert.ok(storage.has("artice-auth"));
    denyRemoval = false;
    await signOutCurrentDevice();
    assert.equal((await client.auth.getSession()).data.session, null);
    // Auth has already been hard-deleted: cleanup must still remove local tokens.
    for (const status of [403, 404]) {
      storage.set("artice-auth", session);
      logoutStatus = status;
      await signOutCurrentDevice();
      assert.equal(storage.has("artice-auth"), false);
      assert.equal((await client.auth.getSession()).data.session, null);
    }
    console.log(`${native ? "native Preferences" : "web localStorage"}: logout checks passed`);
  } finally {
    await client.auth.stopAutoRefresh();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
