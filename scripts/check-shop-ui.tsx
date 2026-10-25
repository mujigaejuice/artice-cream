/** Check every catalog asset has a renderer and previews do not alter the default cone. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScoopCone } from "../components/ScoopCone";
import { COSMETIC_ASSETS, safeEquipped } from "../lib/cosmetics";
import type { Scoop } from "../lib/feed";

const migration = readFileSync(new URL("../supabase/migrations/20261025160738_cosmetic_shop.sql", import.meta.url), "utf8");
for (const [, id, slot, asset] of migration.matchAll(/\('([a-z-]+)','(palette|cone|topping|background)','[^']+',\d+,'([a-z-]+)',\d+\)/g)) {
  assert.equal(COSMETIC_ASSETS[asset as keyof typeof COSMETIC_ASSETS], slot, `${id}: asset and slot`);
}
assert.equal(Object.keys(COSMETIC_ASSETS).length, 4);
const scoop: Scoop = { id: 1, variantId: 1, articleId: 1, domain: "cloud", domainLabel: "클라우드",
  date: "2026-10-26", title: "Fixture", summaryFirstLine: null, score: 1 };
const markup = (equipped?: Record<string,string>) => renderToStaticMarkup(createElement(ScoopCone, {
  scoops: [scoop], equipped, interactive: false,
}));
const plain = markup();
assert.match(plain, /아이스크림 콘, 스쿱 1개/);
assert.doesNotMatch(plain, /설탕 별 토핑/);
assert.match(markup({ topping: "sugar-stars" }), /설탕 별 토핑/);
assert.match(markup({ cone: "cocoa-cone" }), /hsl\(25, 43%, 43%\)/);
assert.match(markup({ palette: "berry-palette" }), /hsl\(332,/);
assert.deepEqual(safeEquipped({ topping: "unknown" }), {});
assert.equal(markup({ topping: "unknown" }), plain);
console.log("PASS catalog asset registry, four SVG variants and unknown-asset fallback");
