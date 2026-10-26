/** Music catalog interaction with one paid track and a controlled audio player. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://shop-music.invalid/cone/" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const userId = "11111111-1111-4111-8111-111111111111";
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://shop-music-auth.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture", NEXT_PUBLIC_API_BASE: "" });
  dom.window.localStorage.setItem("artice-auth", JSON.stringify({
    access_token: "fixture", refresh_token: "refresh", token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, is_anonymous: false },
  }));
  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { ShopSheet } = await import("../components/ShopSheet");
  const { createClient } = await import("../lib/supabase/client");
  const { MUSIC_EQUIPPED_EVENT, MUSIC_PREVIEW_EVENT } = await import("../lib/shop-music");
  const container = document.getElementById("root")!;
  const root = createRoot(container);
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {},
    replace() {}, prefetch() {}, bfcacheId: "fixture" };
  let balance = 150;
  let owned = false;
  let equipped: Record<string, string> = {};
  let purchases = 0;
  let previewEvents: boolean[] = [];
  let equippedEvents = 0;
  class FakeAudio extends dom.window.EventTarget {
    src: string; volume = 1; preload = ""; paused = true;
    constructor(source: string) { super(); this.src = source; }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute() { this.src = ""; }
    load() {}
  }
  Object.defineProperty(dom.window, "Audio", { configurable: true, value: FakeAudio });
  const originalFetch = globalThis.fetch;
  const product = { id: "one-scoop-of-joy", slot: "music", nameKo: "One Scoop of Joy", price: 150,
    assetKey: "one-scoop-of-joy", catalogVersion: 2, isActive: true };
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === "https://shop-music-auth.invalid/auth/v1/user") {
      return Response.json({ id: userId, is_anonymous: false });
    }
    if (url === "/api/shop") return Response.json({ userId, balance,
      spendableBalance: balance, spendingEnabled: true, items: [{ ...product, owned }],
      ownedItems: owned ? [product.id] : [], equipped });
    if (url === "/api/credits/spend") {
      purchases++;
      assert.equal(JSON.parse(String(init?.body)).itemId, product.id);
      owned = true; balance -= product.price;
      return Response.json({ status: "purchased", itemId: product.id, balance,
        spendableBalance: balance });
    }
    if (url === "/api/cosmetics/equip") {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.slot, "music");
      equipped = body.itemId ? { music: body.itemId } : {};
      return Response.json({ userId, status: "equipped", equipped });
    }
    throw new Error(`Unexpected ${url}`);
  };
  const click = async (label: string) => {
    const button = [...container.querySelectorAll("button")].find((node) => node.textContent?.includes(label));
    assert.ok(button, `Missing button: ${label}`);
    await act(async () => { button.click(); });
  };
  const onPreview = (event: Event) => { previewEvents.push((event as CustomEvent<boolean>).detail); };
  const onEquipped = () => { equippedEvents++; };
  window.addEventListener(MUSIC_PREVIEW_EVENT, onPreview);
  window.addEventListener(MUSIC_EQUIPPED_EVENT, onEquipped);
  try {
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router },
      createElement(ShopSheet, { userId, scoops: [], onClose() {}, onApplied() {}, onBalanceChanged() {} }))); });
    assert.match(container.textContent!, /One Scoop of Joy/);
    await click("15초 미리듣기");
    assert.ok(previewEvents.includes(true));
    await click("중지");
    assert.equal(previewEvents.at(-1), false);
    await click("One Scoop of Joy");
    await click("150크레딧으로 구매");
    await click("구매 확인");
    assert.equal(purchases, 1);
    assert.match(container.textContent!, /구매 가능 0크레딧/);
    await click("적용하기");
    assert.equal(equipped.music, product.id);
    assert.equal(equippedEvents, 1);
    await click("기본으로 되돌리기");
    assert.deepEqual(equipped, {});
    assert.equal(equippedEvents, 2);
    console.log("PASS music track preview, quiz-credit purchase, equip and reset");
  } finally {
    window.removeEventListener(MUSIC_PREVIEW_EVENT, onPreview);
    window.removeEventListener(MUSIC_EQUIPPED_EVENT, onEquipped);
    globalThis.fetch = originalFetch;
    await act(async () => { root.unmount(); });
    createClient().auth.stopAutoRefresh();
    dom.window.close();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
