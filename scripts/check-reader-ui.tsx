import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://reader-ui.invalid/read?v=2" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://reader-auth.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture", NEXT_PUBLIC_API_BASE: "" });
  dom.window.localStorage.setItem("artice-auth", JSON.stringify({ access_token: "fixture", refresh_token: "refresh",
    token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "fixture-user", is_anonymous: false } }));
  const originalFetch = globalThis.fetch;
  const requests: { resolve: (value: Response) => void; signal: AbortSignal | null | undefined }[] = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "/api/read/open");
    assert.equal(init?.method, "POST");
    // Deliberately ignore abort: late transports must not overwrite newer state.
    return new Promise<Response>(resolve => requests.push({ resolve, signal: init?.signal }));
  };
  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { default: ReadPage } = await import("../app/read/page");
  const { createClient } = await import("../lib/supabase/client");
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {}, bfcacheId: "test" };
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  const render = (key: string) => act(async () => {
    root.render(createElement(AppRouterContext.Provider, { value: router }, createElement(ReadPage, { key })));
  });
  const resume = () => act(async () => {
    dom.window.dispatchEvent(new dom.window.PageTransitionEvent("pageshow", { persisted: true }));
  });
  const body = (title: string) => ({ opened: true, reader: { variantId: 2, articleId: 1, level: 1, title,
    contentHtml: "<p>본문</p>", glossary: {}, readingMinutes: 1, domainSlug: "cloud", domainLabel: "클라우드",
    sourceName: null, sourceUrl: null, progressStatus: "started", quizScore: null } });
  try {
    await render("first");
    assert.equal(requests.length, 1);
    await resume(); await resume();
    assert.equal(requests.length, 1, "overlapping resume events share the pending open");
    await act(async () => { requests[0].resolve(Response.json(body("첫 기사"))); });
    assert.match(container.textContent!, /첫 기사/);
    await resume();
    assert.equal(requests.length, 2, "completed responses are never used as authorization caches");
    assert.doesNotMatch(container.textContent!, /첫 기사/, "restored content waits for current rights validation");
    await resume();
    assert.equal(requests.length, 2);
    await act(async () => { requests[1].resolve(Response.json({ error: "not found" }, { status: 404 })); });
    assert.match(container.textContent!, /없는 아티클/);
    await resume();
    assert.equal(requests.length, 3);
    await render("replacement");
    assert.equal(requests[2].signal?.aborted, true);
    assert.equal(requests.length, 4);
    await act(async () => { requests[3].resolve(Response.json(body("최신 기사"))); });
    await act(async () => { requests[2].resolve(Response.json({ error: "unauthenticated" }, { status: 401 })); });
    assert.match(container.textContent!, /최신 기사/, "late response from unmounted reader is ignored");
    console.log("Reader UI: pending-request deduplication, fresh rights on resume, abort and stale response isolation passed.");
  } finally {
    await act(async () => { root.unmount(); });
    createClient().auth.stopAutoRefresh();
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
