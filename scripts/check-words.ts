/** Vocabulary API: account binding, merge rules and content-rights gating against mocked Supabase HTTP. */
import assert from "node:assert/strict";

async function main() {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://words-api.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public",
    SUPABASE_SERVICE_ROLE_KEY: "test-private",
  });
  const userId = "11111111-1111-4111-8111-111111111111";
  const past = new Date(Date.now() - 60_000).toISOString();
  const source = { source: "publisher", rights_status: "permitted", evidence_url: "https://publisher.invalid/license",
    reviewed_at: past, expires_at: null, allow_collect: true, allow_process: true, allow_publish: true };
  const domains = [
    { id: 1, slug: "cloud", name_ko: "클라우드", name_en: "Cloud", rss_topic: null, active: true },
    { id: 2, slug: "infra", name_ko: "인프라", name_en: "Infrastructure", rss_topic: null, active: true },
  ];
  const article = (id: number, domain: (typeof domains)[number], overrides: Record<string, unknown> = {}) => ({
    source: "publisher", status: "ready", rights_status: "permitted", rights_evidence_url: source.evidence_url,
    rights_reviewed_at: past, rights_expires_at: null, content_kind: "external", original_key: null,
    editorial_status: "approved", reference_links: [],
    rights_attribution: { author: "Author", originalTitle: `Original ${id}`, licenseLabel: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/", changes: "Adapted", notices: "" },
    domains: { slug: domain.slug, name_ko: domain.name_ko }, ...overrides,
  });
  const row = (id: number, completedAt: string | null, glossary: unknown, articleOverrides: Record<string, unknown> = {},
    domain = domains[0]) => ({
    article_id: id, variant_id: 100 + id, completed_at: completedAt,
    article_variants: { title: `Article ${id}`, glossary, articles: article(id, domain, articleOverrides) },
  });
  const progress = [
    row(1, "2026-11-10T03:00:00Z", { w1: { term: "API", definition: "old definition" },
      w2: { term: "캐시", definition: "자주 쓰는 데이터를 가까이 두는 곳" }, w3: { term: "API", definition: "duplicate in same article" } }),
    row(2, "2026-11-12T03:00:00Z", { w1: { term: " api ", definition: "newest definition" },
      w2: { term: "", definition: "empty term" }, w3: { term: "깨진 항목" }, w4: "not an entry" }, {}, domains[1]),
    row(3, "2026-11-14T03:00:00Z", { w1: { term: "API", definition: "LEAK blocked" }, w2: { term: "차단용어", definition: "LEAK blocked" } },
      { rights_status: "blocked" }),
    row(4, "2026-11-14T04:00:00Z", { w1: { term: "보류용어", definition: "LEAK not ready" } }, { status: "pending" }),
    row(5, "2026-11-14T05:00:00Z", { w1: { term: "만료용어", definition: "LEAK expired" } }, { rights_expires_at: past }),
    row(6, "2026-11-14T06:00:00Z", { w1: { term: "출처용어", definition: "LEAK unknown source" } }, { source: "unknown" }),
    row(7, "2026-11-14T07:00:00Z", { w1: { term: "표기용어", definition: "LEAK no attribution" } }, { rights_attribution: null }),
    row(8, null, { w1: { term: "미완료", definition: "never completed" } }),
    { article_id: 9, variant_id: 109, completed_at: "2026-11-15T00:00:00Z", article_variants: null },
    row(10, "2026-11-11T03:00:00Z", null),
  ];
  let currentUser: { id: string; is_anonymous: boolean } | null = { id: userId, is_anonymous: false };
  let sourcesFail = false;
  let progressFail = false;
  const restCalls: string[] = [];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://words-api.invalid");
    const headers = new Headers(init?.headers);
    if (url.pathname === "/auth/v1/user") {
      return currentUser ? Response.json(currentUser) : Response.json({ message: "unauthenticated" }, { status: 401 });
    }
    assert.ok(!init?.method || init.method === "GET", "vocabulary reads never write");
    // 요청자 토큰으로 읽어 RLS를 받는다 — service role 키가 실려 나가면 안 된다.
    assert.equal(headers.get("authorization"), "Bearer signed-token");
    assert.equal(headers.get("apikey"), "test-public");
    const table = url.pathname.split("/").pop()!;
    restCalls.push(table);
    if (table === "domains") return Response.json(domains);
    if (table === "content_source_rights") {
      return sourcesFail ? Response.json({ message: "registry down" }, { status: 503 }) : Response.json([source]);
    }
    assert.equal(table, "user_article_progress");
    assert.equal(url.searchParams.get("user_id"), `eq.${userId}`);
    assert.equal(url.searchParams.get("status"), "in.(completed,saved)");
    assert.match(url.searchParams.get("select") ?? "", /rights_attribution/);
    assert.match(url.searchParams.get("select") ?? "", /glossary/);
    if (progressFail) return Response.json({ message: "internal vendor detail" }, { status: 500 });
    return Response.json(progress);
  };

  const errors = console.error;
  console.error = () => {};
  try {
    const { GET, OPTIONS } = await import("../app/api/words/route.api");
    const request = (token: string | null = "signed-token") => new Request("https://app.invalid/api/words", {
      headers: { Origin: "https://localhost", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });

    const preflight = OPTIONS(new Request("https://app.invalid/api/words", { method: "OPTIONS", headers: { Origin: "https://localhost" } }));
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "https://localhost");

    let response = await GET(request(null));
    assert.deepEqual(await response.json(), { status: "onboarding" });
    assert.deepEqual(restCalls, [], "signed-out requests read nothing");
    currentUser = { id: "anon", is_anonymous: true };
    response = await GET(request());
    assert.deepEqual(await response.json(), { status: "onboarding" }, "legacy anonymous sessions go to onboarding");
    currentUser = { id: userId, is_anonymous: false };

    response = await GET(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("access-control-allow-origin"), "https://localhost");
    const raw = await response.text();
    assert.doesNotMatch(raw, /LEAK|차단용어|보류용어|만료용어|출처용어|표기용어|Article [3-7]\b/,
      "terms, definitions and titles of non-publishable articles must not leak");
    assert.doesNotMatch(raw, /미완료|empty term|깨진 항목|duplicate in same article/);
    const body = JSON.parse(raw);
    assert.equal(body.status, "ok");
    assert.equal(body.userId, userId);
    assert.deepEqual(body.domains.map((d: { slug: string }) => d.slug), ["cloud", "infra"]);
    assert.deepEqual(body.words.map((w: { term: string }) => w.term), ["api", "캐시"], "newest first, same term merged");
    const [api, cache] = body.words;
    assert.equal(api.definition, "newest definition");
    assert.equal(api.domain, "infra");
    assert.equal(api.domainLabel, "인프라");
    assert.deepEqual(api.domains, ["infra", "cloud"]);
    assert.deepEqual(api.sources, [
      { variantId: 102, articleId: 2, title: "Article 2", date: "2026-11-12", domain: "infra", domainLabel: "인프라" },
      { variantId: 101, articleId: 1, title: "Article 1", date: "2026-11-10", domain: "cloud", domainLabel: "클라우드" },
    ], "each source article once, newest first");
    assert.equal(cache.sources.length, 1);
    assert.equal(cache.domain, "cloud");

    const { readHref } = await import("../lib/routes");
    assert.equal(readHref(api.sources[0].variantId), "/read?v=102");

    restCalls.length = 0;
    sourcesFail = true;
    response = await GET(request());
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).words, [], "unreadable rights registry fails closed");
    sourcesFail = false;

    progressFail = true;
    response = await GET(request());
    assert.equal(response.status, 503);
    const failure = await response.text();
    assert.doesNotMatch(failure, /internal vendor detail/);
    progressFail = false;

    const { collectWords, termKey } = await import("../lib/words");
    assert.equal(termKey("  Large   Language Model "), termKey("large language model"));
    assert.deepEqual(collectWords([], new Map()), []);
    assert.deepEqual(collectWords(progress as never, new Map()), [], "no source registry means no words");

    console.log("Words API: onboarding, user-scoped reads, newest-definition merge, source dedupe, rights gating (blocked/pending/expired/unknown source/no attribution) and failures passed.");
  } finally {
    globalThis.fetch = originalFetch;
    console.error = errors;
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
