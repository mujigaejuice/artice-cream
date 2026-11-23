/** Laptop top bar and page frame; jsdom with a fixed session and fake credits API. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement, type ReactNode } from "react";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://site-header.invalid/" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const userId = "11111111-1111-4111-8111-111111111111";
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://header-auth.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture", NEXT_PUBLIC_API_BASE: "" });
  dom.window.localStorage.setItem("artice-auth", JSON.stringify({ access_token: "fixture", refresh_token: "refresh",
    token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: userId, is_anonymous: false } }));
  const { WIDE_QUERY } = await import("../lib/use-wide-layout");
  Object.defineProperty(window, "matchMedia", { configurable: true, value: (q: string) => ({
    matches: q === WIDE_QUERY, media: q, addEventListener() {}, removeEventListener() {} }) });
  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { PathnameContext } = await import("next/dist/shared/lib/hooks-client-context.shared-runtime");
  const { SiteHeader } = await import("../components/SiteHeader");
  const { PageFrame } = await import("../components/PageFrame");
  const { CREDITS_CHANGED_EVENT } = await import("../lib/cosmetics");
  const { createClient } = await import("../lib/supabase/client");
  const container = document.getElementById("root")!;
  const root = createRoot(container);
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {}, bfcacheId: "test" };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "/api/credits");
    calls++;
    return Response.json({ userId, balance: 120, spendableBalance: 120, policyVersion: 1, earningMode: "active",
      spendingEnabled: true, hasWelcome: true, rules: { article: 10, quizBonusMax: 10, welcome: 100 },
      streak: { enabled: true, days: 3, reward: 50, blockDays: 7, daysUntilReward: 4 } });
  };
  const settle = async () => {
    for (let i = 0; i < 5; i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  };
  const render = async (pathname: string, node: ReactNode) => {
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router },
      createElement(PathnameContext.Provider, { value: pathname }, node))); });
    await settle();
  };
  const header = (pathname: string) => render(pathname,
    createElement(SiteHeader, null, createElement("span", { "data-testid": "music" }, "음악")));
  try {
    await header("/cone");
    const nav = container.querySelector('nav[aria-label="주요 메뉴"]')!;
    assert.ok(nav, "top bar renders the main menu");
    assert.deepEqual([...nav.querySelectorAll("a")].map(a => a.textContent), ["오늘", "내 콘", "단어장", "나"]);
    assert.equal(nav.querySelector('a[href="/cone"]')!.getAttribute("aria-current"), "page");
    assert.equal(nav.querySelectorAll("[aria-current]").length, 1);
    assert.ok([...container.querySelectorAll('a[href="/"]')].some(a => a.textContent?.trim() === "artice cream"), "logo links home");
    assert.match(container.textContent!, /120/, "header shows the credit balance");
    assert.ok(container.querySelector('[data-testid="music"]'));

    const before = calls;
    await act(async () => { window.dispatchEvent(new window.Event(CREDITS_CHANGED_EVENT)); });
    await settle();
    assert.equal(calls, before + 1, "credit change event refetches the balance");

    await header("/words");
    assert.equal(calls, before + 2, "route change refetches the balance");
    assert.equal(container.querySelector('nav[aria-label="주요 메뉴"] [aria-current]')!.getAttribute("href"), "/words");

    await header("/onboarding");
    assert.equal(container.querySelector('nav[aria-label="주요 메뉴"]'), null, "bare routes hide the menu");
    assert.equal(container.querySelector('[aria-label="크레딧"]'), null, "bare routes hide credits");
    assert.ok(container.querySelector('[data-testid="music"]'), "bare routes keep the music slot");

    // Phones never see the top-bar balance, so they must not pay for it on every navigation.
    Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
    await render("/", null);
    const narrowBefore = calls;
    await header("/cone");
    await header("/words");
    assert.equal(calls, narrowBefore, "narrow width never fetches the header balance");
    assert.ok(container.querySelector('[data-testid="music"]'));

    const frameClass = async (pathname: string) => {
      await render(pathname, createElement(PageFrame, null, createElement("p", null, "본문")));
      return (container.firstElementChild as HTMLElement).className;
    };
    const home = await frameClass("/");
    assert.ok(home.includes("lg:max-w-[1100px]") && home.includes("max-w-lg px-4 pb-16"));
    const words = await frameClass("/words");
    assert.ok(words.includes("lg:max-w-[680px]") && words.includes("max-w-lg px-4 pb-16"));
    console.log("Site header: menu order and current tab, credit refresh on event and route, bare routes and page frame widths passed.");
  } finally {
    await act(async () => root.unmount());
    createClient().auth.stopAutoRefresh();
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
