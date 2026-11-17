/** Exercise the real bookmark handlers against isolated Supabase HTTP responses. No network or DB. */
import assert from "node:assert/strict";

async function main() {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://bookmarks.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public",
    SUPABASE_SERVICE_ROLE_KEY: "test-private",
  });
  const userId = "11111111-1111-4111-8111-111111111111";
  const past = new Date(Date.now() - 60_000).toISOString();
  const source = (name: string) => ({ source: name, rights_status: "permitted", evidence_url: "https://rights.invalid/license",
    reviewed_at: past, expires_at: null, allow_collect: true, allow_process: true, allow_publish: true });
  const attribution = { author: "Author", originalTitle: "Original", licenseLabel: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/", changes: "Adapted", notices: "" };
  const article = (id: number, overrides: Record<string, unknown> = {}) => ({
    source: "publisher", status: "ready", rights_status: "permitted", rights_evidence_url: "https://rights.invalid/license",
    rights_reviewed_at: past, rights_expires_at: null, rights_attribution: attribution, content_kind: "external",
    original_key: null, editorial_status: "draft", reference_links: [], source_url: `https://www.publisher.invalid/${id}`,
    domains: { slug: "economy", name_ko: "경제" }, ...overrides,
  });
  const row = (articleId: number, title: string, bookmarkedAt: string, articleOverrides: Record<string, unknown> = {}) => ({
    article_id: articleId, variant_id: articleId * 10, status: "started", bookmarked_at: bookmarkedAt,
    article_variants: { title, level: 2, reading_minutes: 3, articles: article(articleId, articleOverrides) },
  });
  const listRows = [
    row(3, "Newest external", "2026-11-16T03:00:00Z"),
    row(2, "Secret withdrawn title", "2026-11-16T02:00:00Z", { rights_status: "blocked", source_url: "https://secret.invalid/leak" }),
    row(1, "Original basics", "2026-11-16T01:00:00Z", { source: "artice-original", content_kind: "original", original_key: "basics-1",
      editorial_status: "approved", rights_attribution: null, source_url: null,
      reference_links: [{ title: "Ref", url: "https://ref.invalid", checkedAt: past }] }),
  ];
  /** Progress rows that exist per user: articleId -> bookmarked. */
  const progress = new Map<number, boolean>([[3, true], [2, true], [1, true], [7, false]]);

  let currentUser: string | null = userId;
  let listFails = false;
  let rpcMode: "ok" | "error" | "malformed" = "ok";
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://bookmarks.invalid", "test must never use the network");
    calls.push(url.pathname);
    if (url.pathname === "/auth/v1/user") {
      return currentUser ? Response.json({ id: currentUser, is_anonymous: false })
        : Response.json({ message: "unauthenticated" }, { status: 401 });
    }
    if (url.pathname === "/rest/v1/content_source_rights") {
      return Response.json([source("publisher"), source("artice-original")]);
    }
    if (url.pathname === "/rest/v1/user_article_progress") {
      assert.ok(!init?.method || init.method === "GET", "list is read-only");
      assert.equal(url.searchParams.get("user_id"), `eq.${userId}`, "list is bound to the verified user");
      assert.equal(url.searchParams.get("bookmarked_at"), "not.is.null");
      assert.equal(url.searchParams.get("order"), "bookmarked_at.desc,id.desc");
      assert.equal(url.searchParams.get("limit"), "100");
      if (listFails) return Response.json({ message: "storage error" }, { status: 500 });
      return Response.json(listRows);
    }
    assert.equal(url.pathname, "/rest/v1/rpc/set_article_bookmark", `unexpected call ${url.pathname}`);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.p_user_id, userId, "server binds the verified account, never the request body");
    if (rpcMode === "error") return Response.json({ message: "database unavailable" }, { status: 503 });
    if (rpcMode === "malformed") return Response.json({ ok: true });
    if (!progress.has(body.p_article_id)) return Response.json({ error: "not found" });
    progress.set(body.p_article_id, body.p_bookmarked);
    return Response.json({ ok: true, articleId: body.p_article_id, bookmarked: body.p_bookmarked,
      bookmarkedAt: body.p_bookmarked ? new Date().toISOString() : null });
  };

  try {
    const { GET, POST, OPTIONS } = await import("../app/api/bookmarks/route.api");
    const request = (method: "GET" | "POST", body?: unknown, signedIn = true) =>
      new Request("https://app.invalid/api/bookmarks", { method,
        headers: { ...(signedIn ? { Authorization: "Bearer signed-token" } : {}), Origin: "https://localhost",
          "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });

    assert.equal(OPTIONS(request("GET")).status, 204);
    assert.equal(OPTIONS(request("GET")).headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");

    // Unauthenticated requests never reach storage.
    calls.length = 0;
    assert.equal((await GET(request("GET", undefined, false))).status, 401);
    assert.equal((await POST(request("POST", { articleId: 3, bookmarked: true }, false))).status, 401);
    assert.deepEqual(calls, []);
    currentUser = null;
    assert.equal((await GET(request("GET"))).status, 401);
    assert.equal((await POST(request("POST", { articleId: 3, bookmarked: true }))).status, 401);
    assert.deepEqual(calls, ["/auth/v1/user", "/auth/v1/user"]);
    currentUser = userId;

    // List: newest first, link info, withdrawn content redacted.
    const listed = await GET(request("GET"));
    assert.equal(listed.status, 200);
    assert.equal(listed.headers.get("cache-control"), "no-store");
    assert.equal(listed.headers.get("access-control-allow-origin"), "https://localhost");
    const raw = await listed.text();
    const { userId: listedUser, bookmarks } = JSON.parse(raw);
    assert.equal(listedUser, userId);
    assert.deepEqual(bookmarks.map((b: { articleId: number }) => b.articleId), [3, 2, 1], "newest bookmark first");
    assert.deepEqual(bookmarks[0], { articleId: 3, variantId: 30, available: true, title: "Newest external", domain: "economy",
      domainLabel: "경제", level: 2, isOriginal: false, sourceName: "publisher.invalid", readingMinutes: 3,
      progressStatus: "started", bookmarkedAt: "2026-11-16T03:00:00Z" });
    assert.equal(bookmarks[1].available, false);
    assert.equal(bookmarks[1].variantId, null, "withdrawn bookmarks have no reader link");
    assert.equal(bookmarks[1].title, "현재 열람 불가");
    assert.doesNotMatch(raw, /Secret withdrawn title|secret\.invalid/, "withdrawn metadata never leaves the server");
    assert.equal(bookmarks[2].isOriginal, true);
    assert.equal(bookmarks[2].sourceName, "artice cream Original");
    assert.equal(bookmarks[2].variantId, 10);

    // Invalid bodies are rejected before any write.
    for (const body of ["{", null, [], {}, { articleId: 3 }, { bookmarked: true }, { articleId: "3", bookmarked: true },
      { articleId: 0, bookmarked: true }, { articleId: -1, bookmarked: true }, { articleId: 1.5, bookmarked: true },
      { articleId: Number.MAX_SAFE_INTEGER + 1, bookmarked: true }, { articleId: 3, bookmarked: "true" },
      { articleId: 3, bookmarked: 1 }]) {
      calls.length = 0;
      const response = await POST(request("POST", body));
      assert.equal(response.status, 400, `rejects ${JSON.stringify(body)}`);
      assert.deepEqual(calls, ["/auth/v1/user"]);
    }

    // Toggle an existing progress row; an attacker-supplied user id is ignored.
    calls.length = 0;
    let response = await POST(request("POST", { articleId: 7, bookmarked: true, userId: "22222222-2222-4222-8222-222222222222" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, articleId: 7, bookmarked: true });
    assert.equal(progress.get(7), true);
    assert.deepEqual(calls, ["/auth/v1/user", "/rest/v1/rpc/set_article_bookmark"],
      "bookmarking never touches quota, reader or progress-creation paths");
    response = await POST(request("POST", { articleId: 7, bookmarked: false }));
    assert.deepEqual(await response.json(), { ok: true, articleId: 7, bookmarked: false });

    // Never-opened articles: 404 and nothing is created.
    const before = progress.size;
    response = await POST(request("POST", { articleId: 99, bookmarked: true }));
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "not found");
    assert.equal(progress.size, before);

    // Storage failures fail closed.
    rpcMode = "error";
    assert.equal((await POST(request("POST", { articleId: 7, bookmarked: true }))).status, 503);
    rpcMode = "malformed";
    assert.equal((await POST(request("POST", { articleId: 7, bookmarked: true }))).status, 503);
    rpcMode = "ok";
    listFails = true;
    assert.equal((await GET(request("GET"))).status, 503);
    listFails = false;
    console.log("Bookmarks API: account binding, newest-first list, rights redaction, existing-row writes and fail-closed errors passed.");
  } finally { globalThis.fetch = originalFetch; }

  // The reader route surfaces the bookmark state without an extra round trip.
  const good = { opened: true, variant: { id: 2, level: 1, title: "Original", content_html: "<p>Body</p>",
    glossary: {}, reading_minutes: 2, articles: { id: 1, source_url: null, content_kind: "original",
      reference_links: [], rights_attribution: null, domains: { slug: "cloud", name_ko: "클라우드" } } },
    progress: { status: "started", quiz_score: null, bookmarked: true } as Record<string, unknown> };
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: userId, is_anonymous: false });
    assert.equal(url.pathname, "/rest/v1/rpc/open_article_reader");
    return Response.json(good);
  };
  try {
    const { POST: open } = await import("../app/api/read/open/route.api");
    const openRequest = () => new Request("https://app.invalid/api/read/open", { method: "POST",
      body: JSON.stringify({ variantId: 2 }), headers: { Authorization: "Bearer signed-token" } });
    assert.equal((await (await open(openRequest())).json()).reader.bookmarked, true);
    delete good.progress.bookmarked;
    assert.equal((await (await open(openRequest())).json()).reader.bookmarked, false, "older RPC without the field means not bookmarked");
    console.log("Reader API: bookmark state passed through, defaulting to false.");
  } finally { globalThis.fetch = originalFetch; }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
