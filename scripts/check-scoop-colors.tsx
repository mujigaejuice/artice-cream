/** One palette purchase controls eight domain colors and saves them to the account. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import type { Equipped, ScoopColors } from "../lib/cosmetics";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://shop-colors.invalid/cone/" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const userId = "11111111-1111-4111-8111-111111111111";
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://shop-colors-auth.invalid",
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
  const container = document.getElementById("root")!;
  const root = createRoot(container);
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {},
    replace() {}, prefetch() {}, bfcacheId: "fixture" };
  const item = { id: "berry-palette", slot: "palette", nameKo: "분야별 컬러 팔레트", price: 130,
    assetKey: "berry-palette", catalogVersion: 2, isActive: true, owned: true };
  let equipped: Equipped = {};
  let saved: ScoopColors = {};
  let changed: ScoopColors = {};
  let writes = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === "https://shop-colors-auth.invalid/auth/v1/user") {
      return Response.json({ id: userId, is_anonymous: false });
    }
    if (url === "/api/shop") return Response.json({ userId, balance: 0, spendableBalance: 0,
      spendingEnabled: true, items: [item], ownedItems: [item.id], equipped, scoopColors: saved });
    if (url === "/api/cosmetics/colors") {
      writes++;
      saved = JSON.parse(String(init?.body)).colors;
      equipped = { palette: item.id };
      return Response.json({ userId, equipped, scoopColors: saved });
    }
    throw new Error(`Unexpected ${url}`);
  };
  const click = async (label: string) => {
    const button = [...container.querySelectorAll("button")].find((node) => node.textContent?.includes(label));
    assert.ok(button, `Missing button: ${label}`);
    await act(async () => { button.click(); });
  };
  try {
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router },
      createElement(ShopSheet, { userId, scoops: [], onClose() {}, onApplied(value) { equipped = value; },
        onColorsChanged(value) { changed = value; }, onBalanceChanged() {} }))); });
    await click("분야별 컬러 팔레트");
    assert.equal(container.querySelectorAll('input[type="color"]').length, 8);
    const input = container.querySelector('input[aria-label="클라우드 색 고르기"]') as HTMLInputElement;
    assert.ok(input);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "#3456ab");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    await click("색 저장하고 적용");
    assert.equal(writes, 1);
    assert.deepEqual(saved, { cloud: "#3456AB" });
    assert.deepEqual(changed, saved);
    assert.equal(equipped.palette, item.id);
    await click("원래 색");
    await click("색 저장하고 적용");
    assert.equal(writes, 2);
    assert.deepEqual(saved, {});
    console.log("PASS eight domain colors, account save, automatic apply and default reset");
  } finally {
    globalThis.fetch = originalFetch;
    await act(async () => { root.unmount(); });
    createClient().auth.stopAutoRefresh();
    dom.window.close();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
