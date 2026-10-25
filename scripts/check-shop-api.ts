/** Real route handlers with isolated Supabase HTTP responses. */
import assert from "node:assert/strict";

async function main() {
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://shop-test.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test", SUPABASE_SERVICE_ROLE_KEY: "private-test" });
  const originalFetch = globalThis.fetch;
  const user = "11111111-1111-4111-8111-111111111111";
  let signedIn = true;
  let balance = 160;
  let owned = false;
  let equipped: Record<string,string> = {};
  const product = { id: "sugar-stars", slot: "topping", nameKo: "설탕 별 토핑", price: 150,
    assetKey: "sugar-stars", catalogVersion: 1, isActive: true };
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://shop-test.invalid");
    if (url.pathname === "/auth/v1/user") return signedIn
      ? Response.json({ id: user, is_anonymous: false }) : Response.json({}, { status: 401 });
    const body = JSON.parse(String(init?.body));
    assert.equal(body.p_user_id, user, "RPC must use verified account");
    const rpc = url.pathname.split("/").pop();
    if (rpc === "get_shop_snapshot") return Response.json({ balance: String(balance),
      spendingEnabled: true, items: [{ ...product, owned }],
      ownedItems: owned ? [product.id] : [], equipped });
    if (rpc === "spend_credits") {
      assert.equal(body.p_item_id, product.id);
      if (owned) return Response.json({ status: "already_owned", itemId: product.id, balance });
      if (body.p_catalog_version !== 1) return Response.json({ error: "price_changed", price: 150, catalogVersion: 1 });
      if (balance < product.price) return Response.json({ error: "insufficient_credits", balance, shortfall: 150-balance });
      owned = true; balance -= product.price;
      return Response.json({ status: "purchased", itemId: product.id, balance });
    }
    assert.equal(rpc, "equip_cosmetic");
    if (body.p_item_id && !owned) return Response.json({ error: "item_not_owned" });
    if (body.p_item_id && body.p_slot !== "topping") return Response.json({ error: "wrong_slot" });
    equipped = body.p_item_id ? { [body.p_slot]: body.p_item_id } : {};
    return Response.json({ status: "equipped", equipped });
  };
  const request = (path: string, body?: unknown) => new Request(`https://app.invalid${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: "Bearer fixture", Origin: "https://localhost" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  try {
    const { GET: shop } = await import("../app/api/shop/route.api");
    const { POST: spend } = await import("../app/api/credits/spend/route.api");
    const { POST: equip } = await import("../app/api/cosmetics/equip/route.api");
    let response = await shop(request("/api/shop"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).balance, 160);
    assert.equal((await spend(request("/api/credits/spend", { itemId: "x", catalogVersion: 0 }))).status, 400);
    assert.equal((await equip(request("/api/cosmetics/equip", { slot: "wrong", itemId: null }))).status, 400);
    assert.equal((await (await equip(request("/api/cosmetics/equip", { slot: "topping", itemId: product.id }))).json()).error, "item_not_owned");
    assert.equal((await spend(request("/api/credits/spend", { itemId: product.id, catalogVersion: 2 }))).status, 409);
    response = await spend(request("/api/credits/spend", { itemId: product.id, catalogVersion: 1 }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).balance, 10);
    assert.equal((await (await spend(request("/api/credits/spend", { itemId: product.id, catalogVersion: 1 }))).json()).status, "already_owned");
    assert.equal((await equip(request("/api/cosmetics/equip", { slot: "cone", itemId: product.id }))).status, 409);
    assert.equal((await (await equip(request("/api/cosmetics/equip", { slot: "topping", itemId: product.id }))).json()).equipped.topping, product.id);
    assert.deepEqual((await (await equip(request("/api/cosmetics/equip", { slot: "topping", itemId: null }))).json()).equipped, {});
    assert.equal((await (await shop(request("/api/shop"))).json()).ownedItems[0], product.id);
    signedIn = false;
    assert.equal((await shop(request("/api/shop"))).status, 401);
    assert.equal((await spend(request("/api/credits/spend", { itemId: product.id, catalogVersion: 1 }))).status, 401);
    assert.equal((await equip(request("/api/cosmetics/equip", { slot: "topping", itemId: null }))).status, 401);
    console.log("PASS shop API identity binding, purchase recovery, equip and errors");
  } finally { globalThis.fetch = originalFetch; }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
