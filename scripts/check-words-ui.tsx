/** Vocabulary tab states, client-side search/filter and tab bar entry; no external requests. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://words-ui.invalid/words" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://words-auth.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture", NEXT_PUBLIC_API_BASE: "" });
  const userId = "11111111-1111-4111-8111-111111111111";
  const session = () => dom.window.localStorage.setItem("artice-auth", JSON.stringify({
    access_token: "fixture", refresh_token: "refresh", token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: userId, is_anonymous: false },
  }));

  const domains = [
    { id: 1, slug: "cloud", name_ko: "클라우드", name_en: null, rss_topic: null, active: true },
    { id: 2, slug: "infra", name_ko: "인프라", name_en: null, rss_topic: null, active: true },
    { id: 3, slug: "security", name_ko: "보안", name_en: null, rss_topic: null, active: true },
  ];
  const src = (articleId: number, domain: string, domainLabel: string, date: string) =>
    ({ variantId: 100 + articleId, articleId, title: `기사 ${articleId}`, date, domain, domainLabel });
  const words = [
    { term: "API", definition: "프로그램끼리 대화하는 약속", domain: "infra", domainLabel: "인프라",
      domains: ["infra", "cloud"], sources: [src(2, "infra", "인프라", "2026-11-12"), src(1, "cloud", "클라우드", "2025-09-14")] },
    { term: "캐시", definition: "자주 쓰는 데이터를 가까이 두는 곳", domain: "cloud", domainLabel: "클라우드",
      domains: ["cloud"], sources: [src(1, "cloud", "클라우드", "2025-09-14")] },
  ];
  type Mode = "ok" | "empty" | "error" | "mismatch";
  let mode: Mode = "ok";
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), dom.window.location.origin);
    assert.equal(url.pathname, "/api/words");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture");
    calls++;
    if (mode === "error") return Response.json({ error: "internal vendor detail" }, { status: 503 });
    return Response.json({ status: "ok", userId: mode === "mismatch" ? "someone-else" : userId, domains,
      words: mode === "empty" ? [] : words });
  };

  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { PathnameContext } = await import("next/dist/shared/lib/hooks-client-context.shared-runtime");
  const { default: WordsPage } = await import("../app/(tabs)/words/page");
  const { TabBar } = await import("../components/TabBar");
  const { createClient } = await import("../lib/supabase/client");
  const redirects: string[] = [];
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {},
    replace(href: string) { redirects.push(href); }, prefetch() {}, bfcacheId: "fixture" };
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  const render = async (key: string) => {
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router },
      createElement(WordsPage, { key }))); });
    await act(async () => { await Promise.resolve(); });
  };
  const text = () => container.textContent ?? "";
  const items = () => [...container.querySelectorAll('ul[aria-label="단어 목록"] > li')];
  const type = async (value: string) => {
    const input = container.querySelector<HTMLInputElement>("input[type=search]")!;
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, value);
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
  };
  const chip = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('nav[aria-label="분야"] button')]
    .find((button) => button.textContent === label)!;

  try {
    await render("signed-out");
    assert.equal(redirects.at(-1), "/onboarding");
    assert.equal(calls, 0, "signed-out visitors need no API call");

    session();
    await render("signed-in");
    assert.equal(calls, 1);
    assert.match(container.querySelector("h1")!.textContent!, /단어장/);
    assert.match(text(), /2개/);
    assert.equal(items().length, 2);
    assert.deepEqual(items().map((li) => li.querySelector("h2")!.textContent), ["API", "캐시"]);

    const input = container.querySelector<HTMLInputElement>("input[type=search]")!;
    const label = container.querySelector(`label[for="${input.id}"]`);
    assert.equal(label?.textContent, "단어 검색", "search input has a programmatic label");
    assert.ok(container.querySelector('[role="search"]'));

    const firstLinks = [...items()[0].querySelectorAll("a")];
    assert.equal(firstLinks[0].getAttribute("href"), "/read?v=102", "newest source first");
    assert.match(firstLinks[0].textContent!, /11월 12일 · 기사 2/);
    assert.match(items()[0].querySelector("summary")!.textContent!, /다른 글 1편/);
    assert.equal(firstLinks[1].getAttribute("href"), "/read?v=101");
    assert.match(firstLinks[1].textContent!, /2025년 9월 14일/, "other years are spelled out");

    // 칩은 단어가 있는 분야만 — 보안은 없다.
    assert.deepEqual([...container.querySelectorAll('nav[aria-label="분야"] button')].map((b) => b.textContent),
      ["전체", "클라우드", "인프라"]);
    assert.equal(chip("전체").getAttribute("aria-pressed"), "true");
    await act(async () => { chip("인프라").click(); });
    assert.equal(chip("인프라").getAttribute("aria-pressed"), "true");
    assert.deepEqual(items().map((li) => li.querySelector("h2")!.textContent), ["API"]);
    assert.match(container.querySelector('[role="status"]')!.textContent!, /찾은 단어 1개/);
    await act(async () => { chip("클라우드").click(); });
    assert.equal(items().length, 2, "a term matches every domain it appeared in");
    await act(async () => { chip("전체").click(); });

    await type("데이터");
    assert.deepEqual(items().map((li) => li.querySelector("h2")!.textContent), ["캐시"], "searches definitions");
    await type("api");
    assert.deepEqual(items().map((li) => li.querySelector("h2")!.textContent), ["API"], "case-insensitive term search");
    await type("없는말");
    assert.equal(items().length, 0);
    assert.match(text(), /‘없는말’에 맞는 단어가 없어요/);
    const reset = [...container.querySelectorAll("button")].find((b) => b.textContent === "전체 단어 보기")!;
    await act(async () => { reset.click(); });
    assert.equal(items().length, 2);
    assert.equal(container.querySelector<HTMLInputElement>("input[type=search]")!.value, "");

    mode = "empty";
    await render("empty");
    assert.match(text(), /아직 모은 단어가 없어요/);
    assert.equal(container.querySelector("input[type=search]"), null);
    assert.ok(container.querySelector('a[href="/"]'));

    mode = "error";
    await render("error");
    assert.match(text(), /불러오지 못했어요/);
    assert.doesNotMatch(text(), /internal vendor detail|HTTP 503/);
    mode = "ok";
    await act(async () => { container.querySelector<HTMLButtonElement>("button")!.click(); });
    await act(async () => { await Promise.resolve(); });
    assert.equal(items().length, 2, "retry recovers");

    mode = "mismatch";
    await render("mismatch");
    assert.match(text(), /불러오지 못했어요/, "another account's response is rejected");
    assert.doesNotMatch(text(), /프로그램끼리/);

    await act(async () => { root.render(createElement(PathnameContext.Provider, { value: "/words" }, createElement(TabBar))); });
    const tabs = [...container.querySelectorAll("nav a")];
    assert.deepEqual(tabs.map((a) => a.textContent), ["오늘", "내 콘", "단어장", "나"]);
    assert.equal(tabs[2].getAttribute("href"), "/words");
    assert.equal(tabs[2].getAttribute("aria-current"), "page");
    assert.ok(tabs[2].querySelector('svg[aria-hidden="true"]'), "line icon, hidden from screen readers");

    console.log("Words UI: onboarding redirect, list, labelled search, domain chips, empty/no-match/error states, account isolation and tab entry passed.");
  } finally {
    globalThis.fetch = originalFetch;
    await act(async () => { root.unmount(); });
    await createClient().auth.stopAutoRefresh();
    dom.window.close();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
