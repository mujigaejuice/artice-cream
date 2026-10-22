/** Exercise the real SDK/handler without production accounts or network writes. */
import assert from "node:assert/strict";

async function main() {
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://reader.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public", SUPABASE_SERVICE_ROLE_KEY: "private" });
  const calls: string[] = [];
  let anonymous = false;
  const good = { opened: true, variant: { id: 2, level: 1, title: "Original", content_html: "<p>Body</p>",
    glossary: {}, reading_minutes: 2, articles: { id: 1, source_url: null, content_kind: "original",
      reference_links: [], rights_attribution: null, domains: { slug: "cloud", name_ko: "클라우드" } } },
    progress: { status: "saved", quiz_score: 0.75 } };
  let result: unknown = good;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://reader.invalid");
    calls.push(url.pathname);
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "verified-user", is_anonymous: anonymous });
    assert.equal(url.pathname, "/rest/v1/rpc/open_article_reader");
    assert.deepEqual(JSON.parse(String(init?.body)), { p_user_id: "verified-user", p_variant_id: 2 });
    return Response.json(result);
  };
  try {
    const { POST } = await import("../app/api/read/open/route.api");
    const request = (body: unknown = { variantId: 2, userId: "attacker-controlled" }, signedIn = true) =>
      new Request("https://app.invalid/api/read/open", { method: "POST", body: JSON.stringify(body),
        headers: { ...(signedIn ? { Authorization: "Bearer test" } : {}), Origin: "https://localhost" } });
    for (let i = 0; i < 2; i++) {
      calls.length = 0;
      const response = await POST(request());
      assert.equal(response.status, 200);
      assert.deepEqual(calls, ["/auth/v1/user", "/rest/v1/rpc/open_article_reader"], "exactly two external calls, including repeat opens");
      const body = await response.json();
      assert.equal(body.reader.progressStatus, "saved");
      assert.equal(body.reader.quizScore, 0.75);
      assert.equal(body.reader.isOriginal, true);
      assert.equal(body.reader.sourceName, "artice cream Original");
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("access-control-allow-origin"), "https://localhost");
      assert.match(response.headers.get("server-timing")!, /^auth;dur=[\d.]+, reader;dur=[\d.]+, total;dur=[\d.]+$/);
    }
    calls.length = 0;
    assert.equal((await POST(request(undefined, false))).status, 401);
    assert.equal(calls.length, 0);
    anonymous = true;
    assert.equal((await POST(request())).status, 401);
    assert.deepEqual(calls, ["/auth/v1/user"]);
    anonymous = false;
    for (const variantId of [null, 0, -1, 1.5, "invalid", Number.MAX_SAFE_INTEGER + 1]) {
      calls.length = 0;
      assert.equal((await POST(request({ variantId }))).status, 400);
      assert.deepEqual(calls, ["/auth/v1/user"], "invalid IDs cannot consume quota");
    }
    for (const malformed of [null, {}, { opened: true }, { opened: false }, { ...good, progress: null },
      { ...good, variant: { ...good.variant, id: 3 } }]) {
      result = malformed;
      const response = await POST(request());
      assert.equal(response.status, 503);
      assert.equal((await response.json()).reader, undefined);
    }
    result = { error: "not found" };
    assert.equal((await POST(request())).status, 404);
    result = { opened: false, quota: { canUnlockWithAd: false }, variant: good.variant };
    assert.deepEqual(await (await POST(request())).json(), { opened: false, quota: { canUnlockWithAd: false } });
    console.log("Reader API: two calls, verified identity, response timings, private responses and fail-closed gates passed.");
  } finally { globalThis.fetch = originalFetch; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
