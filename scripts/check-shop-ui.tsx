/** Check catalog coverage and the shared scoop silhouette used by every topping. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScoopCone } from "../components/ScoopCone";
import { ConeScene } from "../components/ConeScene";
import { COSMETIC_ASSETS, safeEquipped, safeScoopColors } from "../lib/cosmetics";
import { gelatoScoopPath, scoopPath } from "../lib/cone";
import { DEFAULT_MUSIC_SOURCE, MUSIC_TRACKS, musicSource } from "../lib/shop-music";
import type { Scoop } from "../lib/feed";

for (const file of ["20261025160738_cosmetic_shop.sql", "20261026184211_music_shop.sql",
  "20261026192933_expanded_cone_cosmetics.sql"]) {
  const migration = readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8");
  for (const [, id, slot, asset] of migration.matchAll(
    /\('([a-z-]+)','(palette|cone|topping|background|texture|music)','[^']+',\d+,'([a-z-]+)',\d+\)/g
  )) {
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
  date: "2026-10-27", title: "Fixture", summaryFirstLine: null, score: 1 };
const markup = (equipped?: Record<string, string>, scoopColors?: Record<string, string>) =>
  renderToStaticMarkup(createElement(ScoopCone, { scoops: [scoop], equipped, scoopColors,
    interactive: false }));
const plain = markup();
assert.match(plain, /아이스크림 콘, 스쿱 1개/);
assert.doesNotMatch(plain, /설탕 별 토핑/);
assert.match(markup({ topping: "sugar-stars" }), /설탕 별 토핑/);
assert.match(markup({ cone: "cocoa-cone" }), /hsl\(25, 43%, 43%\)/);
assert.notEqual(markup({ palette: "berry-palette" }, { cloud: "#8A6CCF" }), plain);
assert.equal(markup({ palette: "berry-palette" }), plain);

const original = scoopPath();
const gelato = gelatoScoopPath();
const firstArc = (path: string) => path.match(/^(M .*? A .*?)(?: A | C )/)?.[1];
assert.equal(firstArc(gelato), firstArc(original), "gelato keeps the original upper dome");
assert.notEqual(gelato, original, "gelato has a different lower silhouette");
assert.equal(gelato.split(" A ").length - 1, 2, "gelato is a complete circle of two arcs");
assert.doesNotMatch(gelato, / C /);
const gelatoMarkup = markup({ texture: "gelato-folds" });
assert.match(gelatoMarkup, /ac-gelato-shade/);
const conePath = (svg: string) => svg.match(/class="ac-cone"[^>]*><path d="([^"]+)"/)?.[1];
assert.equal(conePath(gelatoMarkup), conePath(plain), "gelato keeps the original cone dimensions");
assert.ok(gelatoMarkup.indexOf('class="ac-cone"') > gelatoMarkup.indexOf('class="ac-slot"'),
  "the cone covers the lower gelato scoop");
assert.ok(plain.indexOf('class="ac-cone"') < plain.indexOf('class="ac-slot"'),
  "ordinary scoops remain in front of the cone");
assert.match(markup({ texture: "cloud-swirl" }), /ac-scoop-clip/);
for (const [key, label] of Object.entries({
  "rainbow-sprinkles": "무지개 스프링클", "chocolate-drizzle": "초코 드리즐",
})) {
  assert.match(markup({ topping: key }), new RegExp(`aria-label="${label}" clip-path=`),
    `${key} stays on the scoop`);
}
assert.match(markup({ topping: "sugar-stars" }), /M-27 -45/);
assert.match(markup({ topping: "sugar-stars" }), /M0 -57/);
assert.match(markup({ topping: "cheese-cubes" }), /translate\(-18 -20\) rotate\(-15\)/);
assert.match(markup({ topping: "fresh-strawberry" }), /translate\(0 -34\) rotate\(-14\) scale\(\.8\)/);
assert.match(markup({ topping: "fresh-strawberry" }), /fill="#FFD4BB"/);
for (const scene of ["night-sky", "pink-parlor", "turkish-stand", "evening-street"]) {
  assert.match(renderToStaticMarkup(createElement(ConeScene, { scene })), /<svg/);
}
assert.deepEqual(safeScoopColors({ cloud: "#8a6ccf", bad: "#FFFFFF", infra: "red" }),
  { cloud: "#8A6CCF" });
assert.deepEqual(safeEquipped({ topping: "unknown" }), {});
assert.equal(markup({ topping: "unknown" }), plain);
console.log("PASS catalog assets, spherical gelato, topping positions and account colors");
