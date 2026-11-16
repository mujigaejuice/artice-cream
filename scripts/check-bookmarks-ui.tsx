/** Bookmark toggle and list: accessible state, optimistic updates and rollback. No network or browser session. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://bookmarks-ui.invalid/" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const userA = "11111111-1111-4111-8111-111111111111";
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://bookmarks-auth.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture", NEXT_PUBLIC_API_BASE: "" });
  dom.window.localStorage.setItem("artice-auth", JSON.stringify({
    access_token: "fixture", refresh_token: "refresh", token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: userA, is_anonymous: false },
  }));
  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { BookmarkButton } = await import("../components/BookmarkButton");
  const { BookmarkList } = await import("../components/BookmarkList");
  const { Reader } = await import("../components/Reader");
  const { createClient } = await import("../lib/supabase/client");
  const container = document.getElementById("root")!;
  const root = createRoot(container);
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {},
    replace() {}, prefetch() {}, bfcacheId: "fixture" };
  const render = async (node: React.ReactNode) => {
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router }, node)); });
  };
  const click = async (element: Element | null | undefined) => {
    assert.ok(element, "element exists");
    await act(async () => { (element as HTMLElement).click(); });
  };
  const originalFetch = globalThis.fetch;
  const pending: { method: string; body: unknown; resolve: (response: Response) => void }[] = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "/api/bookmarks");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer fixture");
    return new Promise<Response>((resolve) => {
      pending.push({ method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null, resolve });
    });
  };
  const bookmark = (articleId: number, title: string, available = true) => ({
    articleId, variantId: available ? articleId * 10 : null, available, title: available ? title : "현재 열람 불가",
    domain: available ? "economy" : "", domainLabel: available ? "경제" : "", level: available ? 2 : null, isOriginal: false,
    sourceName: available ? "publisher.invalid" : null, readingMinutes: 3, progressStatus: "started", bookmarkedAt: "2026-11-16T00:00:00Z",
  });

  try {
    // Reader: no toggle without bookmark state (preview), toggle when the API supplies it.
    const readerProps = { variantId: 20, articleId: 2, level: 2, title: "기사", contentHtml: "<p>본문</p>", glossary: {},
      readingMinutes: 2, domainSlug: "economy", domainLabel: "경제", sourceName: null, sourceUrl: null,
      progressStatus: "started" as const, quizScore: null };
    await render(createElement(Reader, readerProps));
    assert.equal(container.querySelector("button[aria-pressed]"), null, "preview reader has no bookmark toggle");
    await render(createElement(Reader, { ...readerProps, bookmarked: true }));
    assert.equal(container.querySelector("button[aria-pressed]")?.getAttribute("aria-pressed"), "true");

    // Toggle: optimistic, then confirmed.
    await render(createElement(BookmarkButton, { key: "a", articleId: 2, initialBookmarked: false }));
    const button = () => container.querySelector("button[aria-pressed]")!;
    assert.equal(button().getAttribute("aria-label"), "이 글 북마크");
    assert.match(button().textContent!, /북마크/);
    assert.equal(button().getAttribute("aria-pressed"), "false");
    await click(button());
    assert.equal(button().getAttribute("aria-pressed"), "true", "optimistic update");
    assert.deepEqual(pending[0].body, { articleId: 2, bookmarked: true });
    await click(button());
    assert.equal(pending.length, 1, "no second request while one is pending");
    await act(async () => { pending.shift()!.resolve(Response.json({ ok: true, articleId: 2, bookmarked: true })); });
    assert.equal(button().getAttribute("aria-pressed"), "true");
    assert.match(container.querySelector('[role="status"]')!.textContent!, /북마크했어요/);

    // Toggle: server failure rolls back and alerts.
    await click(button());
    assert.equal(button().getAttribute("aria-pressed"), "false");
    assert.deepEqual(pending[0].body, { articleId: 2, bookmarked: false });
    await act(async () => { pending.shift()!.resolve(Response.json({ error: "bookmark temporarily unavailable" }, { status: 503 })); });
    assert.equal(button().getAttribute("aria-pressed"), "true", "rollback on failure");
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /해제하지 못했어요/);

    // List: loads, rejects other-account responses, and removes optimistically with rollback.
    await render(createElement(BookmarkList, { key: userA, userId: userA }));
    assert.match(container.textContent!, /북마크 불러오는 중/);
    await act(async () => { pending.shift()!.resolve(Response.json({ userId: "someone-else", bookmarks: [bookmark(9, "남의 글")] })); });
    assert.doesNotMatch(container.textContent!, /남의 글/, "wrong account response is rejected");
    await click([...container.querySelectorAll("button")].find((b) => /재시도/.test(b.textContent!)));
    await act(async () => { pending.shift()!.resolve(Response.json({ userId: userA, bookmarks: [bookmark(3, "최근 글"), bookmark(2, "", false), bookmark(1, "오래된 글")] })); });
    const titles = () => [...container.querySelectorAll("li")].map((li) => li.textContent!);
    assert.equal(titles().length, 3);
    assert.match(titles()[0], /최근 글/);
    assert.equal(container.querySelector("li a")?.getAttribute("href"), "/read?v=30");
    assert.match(titles()[1], /현재 열람 불가/);
    assert.equal(container.querySelectorAll("li")[1].querySelector("a"), null, "withdrawn bookmark is not a link");

    const removeButton = (label: string) => container.querySelector(`button[aria-label="${label} 북마크 해제"]`);
    await click(removeButton("최근 글"));
    assert.equal(titles().length, 2, "optimistic removal");
    assert.deepEqual(pending[0].body, { articleId: 3, bookmarked: false });
    await act(async () => { pending.shift()!.resolve(Response.json({ error: "x" }, { status: 503 })); });
    assert.equal(titles().length, 3, "rollback on failure");
    assert.match(titles()[0], /최근 글/, "restored in place");
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /해제하지 못했어요/);
    await click(removeButton("오래된 글"));
    await act(async () => { pending.shift()!.resolve(Response.json({ ok: true, articleId: 1, bookmarked: false })); });
    assert.equal(titles().length, 2);
    assert.doesNotMatch(container.textContent!, /오래된 글/);
    await click(removeButton("최근 글"));
    await click(removeButton("현재 열람 불가"));
    await act(async () => { for (const request of pending.splice(0)) request.resolve(Response.json({ ok: true, bookmarked: false })); });
    assert.match(container.textContent!, /아직 북마크한 글이 없어요/);
    console.log("Bookmark UI: aria-pressed toggle, optimistic update with rollback, account-bound list and redacted items passed.");
  } finally {
    await act(async () => { root.unmount(); });
    createClient().auth.stopAutoRefresh();
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
