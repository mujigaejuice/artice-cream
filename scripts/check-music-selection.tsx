/** The persistent player follows the account's equipped track and pauses for previews. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://music-shop.invalid/cone/", pretendToBeVisual: true });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  Object.defineProperty(document, "hidden", { get: () => false });
  const userId = "11111111-1111-4111-8111-111111111111";
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://music-shop-auth.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture", NEXT_PUBLIC_API_BASE: "" });
  dom.window.localStorage.setItem("artice-auth", JSON.stringify({
    access_token: "fixture", refresh_token: "refresh", token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, is_anonymous: false },
  }));
  let equipped = "one-scoop-of-joy";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === "/api/credits") return Response.json({ userId, balance: 120, spendableBalance: 120,
      equipped: { music: equipped }, ownedItems: [equipped], earningMode: "active",
      spendingEnabled: true, hasWelcome: true, rules: { article: 10, quizBonusMax: 10, welcome: 100 } });
    if (url === "https://music-shop-auth.invalid/auth/v1/user") {
      return Response.json({ id: userId, is_anonymous: false });
    }
    throw new Error(`Unexpected ${url}`);
  };
  const players: FakeAudio[] = [];
  class FakeAudio extends dom.window.EventTarget {
    src = ""; loop = false; preload = ""; volume = 1; paused = true;
    currentTime = 0; error: object | null = null;
    constructor() { super(); players.push(this); }
    getAttribute() { return this.src || null; }
    removeAttribute() { this.src = ""; }
    load() { this.error = null; }
    play() { this.paused = false; this.dispatchEvent(new dom.window.Event("playing")); return Promise.resolve(); }
    pause() { this.paused = true; this.dispatchEvent(new dom.window.Event("pause")); }
  }
  Object.defineProperty(dom.window, "Audio", { configurable: true, value: FakeAudio });
  const { createRoot } = await import("react-dom/client");
  const { PathnameContext } = await import("next/dist/shared/lib/hooks-client-context.shared-runtime");
  const { BackgroundMusic } = await import("../components/BackgroundMusic");
  const { MUSIC_EQUIPPED_EVENT, MUSIC_PREVIEW_EVENT } = await import("../lib/shop-music");
  const { OPEN_SHOP_EVENT } = await import("../lib/cosmetics");
  const { createClient } = await import("../lib/supabase/client");
  const container = document.getElementById("root")!;
  const root = createRoot(container);
  const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  let shopOpens = 0;
  const onOpen = () => { shopOpens++; };
  window.addEventListener(OPEN_SHOP_EVENT, onOpen);
  try {
    await act(async () => { root.render(createElement(PathnameContext.Provider, { value: "/cone" },
      createElement(BackgroundMusic))); });
    await flush();
    const shop = container.querySelector<HTMLButtonElement>('[aria-label="꾸미기 상점 열기"]');
    assert.ok(shop);
    await act(async () => { shop.click(); });
    assert.equal(shopOpens, 1);
    const music = container.querySelector<HTMLButtonElement>("button[aria-pressed]")!;
    await act(async () => { music.click(); });
    await flush();
    assert.equal(players.length, 1);
    assert.match(players[0].src, /one-scoop-of-joy\.mp3$/);
    assert.equal(players[0].paused, false);
    await act(async () => { window.dispatchEvent(new dom.window.CustomEvent(MUSIC_PREVIEW_EVENT, { detail: true })); });
    assert.equal(players[0].paused, true);
    await act(async () => { window.dispatchEvent(new dom.window.CustomEvent(MUSIC_PREVIEW_EVENT, { detail: false })); });
    assert.equal(players[0].paused, false);
    equipped = "waffle-cone-waltz";
    await act(async () => { window.dispatchEvent(new dom.window.Event(MUSIC_EQUIPPED_EVENT)); });
    await flush();
    assert.match(players[0].src, /waffle-cone-waltz\.mp3$/);
    assert.equal(players[0].paused, false);
    console.log("PASS cone shop shortcut, account music selection and preview interruption");
  } finally {
    window.removeEventListener(OPEN_SHOP_EVENT, onOpen);
    globalThis.fetch = originalFetch;
    await act(async () => { root.unmount(); });
    createClient().auth.stopAutoRefresh();
    dom.window.close();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
