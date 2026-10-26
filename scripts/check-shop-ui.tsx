/** Check every catalog asset has a renderer and previews do not alter the default cone. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScoopCone } from "../components/ScoopCone";
import { ConeScene } from "../components/ConeScene";
import { COSMETIC_ASSETS, safeEquipped, safeScoopColors } from "../lib/cosmetics";
import { DEFAULT_MUSIC_SOURCE, MUSIC_TRACKS, musicSource } from "../lib/shop-music";
import type { Scoop } from "../lib/feed";

for (const file of ["20261025160738_cosmetic_shop.sql", "20261026184211_music_shop.sql",
  "20261026191921_expanded_cone_cosmetics.sql"]) {
  const migration = readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8");
  for (const [, id, slot, asset] of migration.matchAll(/\('([a-z-]+)','(palette|cone|topping|background|texture|music)','[^']+',\d+,'([a-z-]+)',\d+\)/g)) {
    assert.equal(COSMETIC_ASSETS[asset as keyof typeof COSMETIC_ASSETS], slot, `${id}: asset and slot`);
  }
}
assert.equal(Object.keys(COSMETIC_ASSETS).length, 17);
for (const key of Object.keys(MUSIC_TRACKS) as Array<keyof typeof MUSIC_TRACKS>) {
  assert.equal(COSMETIC_ASSETS[key], "music");
  assert.ok(readFileSync(new URL(`../public${MUSIC_TRACKS[key].source}`, import.meta.url)).length > 100_000);
  assert.equal(musicSource(key), MUSIC_TRACKS[key].source);
}
assert.equal(musicSource("unknown"), DEFAULT_MUSIC_SOURCE);
const scoop: Scoop = { id: 1, variantId: 1, articleId: 1, domain: "cloud", domainLabel: "클라우드",
  date: "2026-10-26", title: "Fixture", summaryFirstLine: null, score: 1 };
const markup = (equipped?: Record<string,string>, scoopColors?: Record<string,string>) => renderToStaticMarkup(createElement(ScoopCone, {
  scoops: [scoop], equipped, scoopColors, interactive: false,
}));
const plain = markup();
assert.match(plain, /아이스크림 콘, 스쿱 1개/);
assert.doesNotMatch(plain, /설탕 별 토핑/);
assert.match(markup({ topping: "sugar-stars" }), /설탕 별 토핑/);
assert.match(markup({ cone: "cocoa-cone" }), /hsl\(25, 43%, 43%\)/);
assert.notEqual(markup({ palette: "berry-palette" }, { cloud: "#8A6CCF" }), plain);
assert.equal(markup({ palette: "berry-palette" }), plain);
assert.match(markup({ topping: "rainbow-sprinkles" }), /무지개 스프링클/);
assert.match(markup({ topping: "chocolate-drizzle" }), /초코 드리즐/);
assert.match(markup({ topping: "cheese-cubes" }), /치즈 큐브/);
assert.match(markup({ topping: "fresh-strawberry" }), /딸기 토핑/);
assert.match(markup({ texture: "cloud-swirl" }), /ac-scoop-clip/);
assert.match(markup({ texture: "gelato-folds" }), /stroke="hsl/);
for (const scene of ["night-sky", "pink-parlor", "turkish-stand", "evening-street"]) {
  assert.match(renderToStaticMarkup(createElement(ConeScene, { scene })), /<svg/);
}
assert.deepEqual(safeScoopColors({ cloud: "#8a6ccf", bad: "#FFFFFF", infra: "red" }),
  { cloud: "#8A6CCF" });
assert.deepEqual(safeEquipped({ topping: "unknown" }), {});
assert.equal(markup({ topping: "unknown" }), plain);
console.log("PASS expanded catalog, illustrated scenes, toppings, textures and per-domain color fallback");
