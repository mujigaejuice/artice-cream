/** Public entry and resumed-page regression checks; no external requests. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://entry-test.invalid/" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://auth-test.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key", NEXT_PUBLIC_API_BASE: "" });
  let calls = 0;
  let mode: "ok" | "error" | "pending" = "ok";
  const pending: Array<(response: Response) => void> = [];
  const feed = (remaining: number) => ({ status: "ok", picks: [], quota: { remaining, canRead: true, canUnlockWithAd: false } });
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), dom.window.location.origin);
    assert.equal(url.pathname, "/api/feed");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
    calls++;
    if (mode === "error") return Response.json({ error: "internal vendor detail" }, { status: 503 });
    if (mode === "pending") return new Promise<Response>((resolve) => pending.push(resolve));
    return Response.json(feed(1));
  };
  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { default: TodayPage } = await import("../app/(tabs)/page");
  const { createClient } = await import("../lib/supabase/client");
  const redirects: string[] = [];
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace(href: string) { redirects.push(href); }, prefetch() {}, bfcacheId: "test" };
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  function session(anonymous: boolean) {
    dom.window.localStorage.setItem("artice-auth", JSON.stringify({ access_token: "test-token", refresh_token: "test-refresh", token_type: "bearer",
      expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "test-user", is_anonymous: anonymous } }));
  }
  async function render(key: string) {
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router }, createElement(TodayPage, { key }))); });
  }
  async function resume() {
    await act(async () => { dom.window.dispatchEvent(new dom.window.PageTransitionEvent("pageshow", { persisted: true })); });
  }
  try {
    await render("signed-out");
    assert.equal(redirects.at(-1), "/onboarding");
    assert.equal(calls, 0, "first entry needs no feed API when signed out");
    session(true);
    await render("legacy-guest");
    assert.equal(redirects.length, 2);
    assert.equal(calls, 0, "legacy anonymous accounts also go to introduction");
    session(false);
    await render("signed-in");
    assert.equal(calls, 1);
    assert.match(container.textContent!, /오늘 1편 남음/);
    mode = "error";
    await resume();
    assert.match(container.textContent!, /불러오지 못했어요/);
    assert.doesNotMatch(container.textContent!, /internal vendor detail|HTTP 503/);
    assert.ok(container.querySelector('a[href^="/privacy"]'));
    mode = "ok";
    await act(async () => { container.querySelector<HTMLButtonElement>("button")!.click(); });
    assert.match(container.textContent!, /오늘 1편 남음/);
    mode = "pending";
    await resume();
    await resume();
    assert.equal(pending.length, 2);
    await act(async () => { pending[1](Response.json(feed(2))); });
    assert.match(container.textContent!, /오늘 2편 남음/);
    await act(async () => { pending[0](Response.json({ status: "onboarding" })); });
    assert.match(container.textContent!, /오늘 2편 남음/, "late response cannot overwrite refreshed state");
    assert.equal(redirects.length, 2, "late response cannot send a signed-in user to onboarding");
    dom.window.localStorage.removeItem("artice-auth");
    const previousCalls = calls;
    await resume();
    assert.equal(calls, previousCalls);
    assert.equal(redirects.length, 3, "resuming after logout returns to introduction");
    console.log("Entry: no-session/anonymous routing, authenticated feed, error retry, stale responses and logout resume passed.");
  } finally {
    await act(async () => { root.unmount(); });
    await createClient().auth.stopAutoRefresh();
    dom.window.close();
  }
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
