/** Web shop interaction: adjusted balance cannot buy, quiz balance can buy and equip. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import type { Equipped } from "../lib/cosmetics";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://shop-ui.invalid/cone/" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const userId = "11111111-1111-4111-8111-111111111111";
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://shop-auth.invalid",
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
  let balance = 500;
  let spendableBalance = 0;
  let owned = false;
  let equipped: Equipped = {};
  let purchases = 0;
  let balanceChanges = 0;
  const product = { id: "night-sky", slot: "background", nameKo: "밤하늘 배경", price: 120,
    assetKey: "night-sky", catalogVersion: 1, isActive: true };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === "https://shop-auth.invalid/auth/v1/user") {
      return Response.json({ id: userId, is_anonymous: false });
    }
    if (url === "/api/shop") return Response.json({ userId, balance, spendableBalance,
      spendingEnabled: true, items: [{ ...product, owned }],
      ownedItems: owned ? [product.id] : [], equipped });
    if (url === "/api/credits/spend") {
      purchases++;
      assert.deepEqual(JSON.parse(String(init?.body)), { itemId: product.id, catalogVersion: 1 });
      assert.ok(spendableBalance >= product.price);
      owned = true;
      balance -= product.price;
      spendableBalance -= product.price;
      return Response.json({ status: "purchased", itemId: product.id, balance, spendableBalance });
    }
    if (url === "/api/cosmetics/equip") {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.slot, "background");
      equipped = body.itemId ? { background: body.itemId } : {};
      return Response.json({ userId, status: "equipped", equipped });
    }
    throw new Error(`Unexpected ${url}`);
  };
  const click = async (label: string) => {
    const button = [...container.querySelectorAll("button")].find((node) => node.textContent?.includes(label));
    assert.ok(button, `Missing button: ${label}`);
    await act(async () => { button.click(); });
  };
  const render = async (key: string) => {
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router },
      createElement(ShopSheet, { key, userId, scoops: [], onClose() {}, onApplied(value) { equipped = value; },
        onBalanceChanged() { balanceChanges++; } }))); });
  };
  try {
    await render("adjustment-only");
    assert.match(container.textContent!, /구매 가능 0크레딧/);
    assert.match(container.textContent!, /전체 잔액 500크레딧/);
    assert.match(container.textContent!, /퀴즈를 풀어 받은 크레딧만/);
    await click("밤하늘 배경");
    assert.match(container.textContent!, /구매 가능 크레딧 120개가 더 필요해요/);
    assert.equal(purchases, 0);

    balance = 620;
    spendableBalance = 120;
    await render("quiz-earned");
    await click("밤하늘 배경");
    await click("120크레딧으로 구매");
    assert.match(container.textContent!, /구매 후 사용 가능한 크레딧은 0개/);
    await click("구매 확인");
    assert.equal(purchases, 1);
    assert.equal(balanceChanges, 1);
    assert.match(container.textContent!, /구매 가능 0크레딧/);
    await click("적용하기");
    assert.equal(equipped.background, "night-sky");
    await click("기본으로 되돌리기");
    assert.deepEqual(equipped, {});
    console.log("PASS web shop quiz-only affordance, purchase confirmation, equip and reset");
  } finally {
    globalThis.fetch = originalFetch;
    await act(async () => { root.unmount(); });
    createClient().auth.stopAutoRefresh();
    dom.window.close();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
