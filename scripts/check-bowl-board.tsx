/** Laptop bowl scene: drawing, selection to the side stage, closing and arrival; jsdom, no network. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement, type ReactNode } from "react";
import type { Scoop } from "../lib/feed";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://bowl.invalid/cone", pretendToBeVisual: true });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const { WIDE_QUERY } = await import("../lib/use-wide-layout");
  Object.defineProperty(window, "matchMedia", { configurable: true, value: (q: string) => ({
    matches: q === WIDE_QUERY, media: q, addEventListener() {}, removeEventListener() {} }) });
  dom.window.SVGElement.prototype.scrollIntoView = () => {};
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  Object.defineProperty(window, "AudioContext", { value: undefined });

  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { BowlBoard } = await import("../components/BowlBoard");
  const { layoutBowl, STAGE, BOWL_SHIFT_X } = await import("../lib/bowl");
  const { COCOA_FILL, hslStr } = await import("../lib/color");
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {}, bfcacheId: "test" };
  const container = document.getElementById("root")!;
  const root = createRoot(container);
  const scoops: Scoop[] = [1, 2, 3, 4, 5].map(id => ({ id, articleId: 100 + id, variantId: 200 + id, domain: "cloud",
    domainLabel: "클라우드", date: `2026-11-0${id}`, title: `Article ${id}`, summaryFirstLine: null, score: 0.8,
    savedAt: `2026-11-0${id}T09:00:00Z` }));
  // history.back() delivers popstate on a later task; give it a few.
  const tick = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0)); });
  const render = async (node: ReactNode) => {
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router }, node)); });
  };
  const board = (props: Record<string, unknown> = {}, key = "board") =>
    render(createElement(BowlBoard, { key, scoops, initialScoopId: null, ...props }));
  const slotOf = (id: number) => container.querySelector(`[data-scoop-id="${id}"]`)!.parentElement!;
  const button = (id: number) => [...container.querySelectorAll("ul.sr-only button")]
    .find(b => b.textContent!.includes(`Article ${id}`)) as HTMLButtonElement;
  // Booleans only: inspecting a jsdom node in a failed assertion exhausts memory.
  const panel = () => container.querySelector('[aria-label="선택한 스쿱"]') != null;
  const bowl = () => container.querySelector(".ac-bowl")!.getAttribute("transform");
  try {
    await board();
    assert.equal(container.querySelector("svg.ac-svg")!.getAttribute("viewBox"), "0 0 600 400");
    assert.equal(container.querySelectorAll("[data-scoop-id]").length, 5);
    assert.equal(container.querySelector("ul.sr-only")!.getAttribute("aria-label"), "보울, 스쿱 5개");
    assert.deepEqual([...container.querySelectorAll("ul.sr-only button")].map(b => b.textContent!.match(/Article (\d)/)![1]),
      ["5", "4", "3", "2", "1"], "screen reader list reads newest first");
    const layout = layoutBowl(scoops);
    for (const p of layout.placements)
      assert.equal(slotOf(p.id).getAttribute("transform"), `translate(${p.x} ${p.y}) scale(${layout.scale})`);
    assert.equal(bowl(), "translate(0 0)");
    assert.equal(panel(), false);

    await board({ equipped: { topping: "sugar-stars" } }, "topping");
    const stars = container.querySelectorAll('[aria-label="설탕 별 토핑"]');
    assert.equal(stars.length, 1);
    assert.equal(stars[0].closest("[data-scoop-id]")!.getAttribute("data-scoop-id"), String(layout.topId), "topping crowns the highest scoop");

    await board({ equipped: { cone: "cocoa-cone" } }, "cocoa");
    assert.equal(container.querySelector('[data-bowl="front"]')!.getAttribute("fill"), hslStr(COCOA_FILL));

    await board({}, "select");
    await act(async () => { button(3).click(); });
    assert.equal(new URL(window.location.href).searchParams.get("scoop"), "3");
    assert.match(bowl()!, /translate\(-100 /);
    assert.match(slotOf(3).getAttribute("transform")!, new RegExp(`translate\\(${STAGE.x - BOWL_SHIFT_X} ${STAGE.y}\\)`));
    assert.ok(panel(), "panel shows the chosen scoop");
    assert.equal(slotOf(1).getAttribute("opacity"), ".45", "other scoops fade back");

    await act(async () => { button(4).click(); });
    await tick();
    assert.equal(new URL(window.location.href).searchParams.get("scoop"), "4", "switching scoops keeps the selection open");
    assert.match(slotOf(4).getAttribute("transform")!, new RegExp(`translate\\(${STAGE.x - BOWL_SHIFT_X} ${STAGE.y}\\)`));
    const p3 = layout.placements.find(p => p.id === 3)!;
    assert.equal(slotOf(3).getAttribute("transform"), `translate(${p3.x} ${p3.y}) scale(${layout.scale})`, "previous scoop returns to its spot");

    await act(async () => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" })); });
    await tick();
    assert.equal(panel(), false, "Escape closes");
    assert.equal(bowl(), "translate(0 0)");

    await act(async () => { button(2).click(); });
    assert.ok(panel());
    const scene = container.querySelector(".aspect-3\\/2") as HTMLElement;
    await act(async () => { scene.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
    await tick();
    assert.equal(panel(), false, "background click closes");

    await act(async () => { button(2).click(); });
    assert.ok(panel());
    await act(async () => { button(2).click(); });
    await tick();
    assert.equal(panel(), false, "same scoop again closes");

    window.history.replaceState(null, "", "/cone");
    await board({ initialScoopId: 999 }, "unknown");
    assert.equal(panel(), false, "unknown scoop id selects nothing");
    assert.equal(bowl(), "translate(0 0)");

    await board({ initialScoopId: 3 }, "deep-link");
    assert.ok(panel(), "?scoop= opens selected");

    window.history.replaceState(null, "", "/cone?new=5");
    await board({ justAddedId: 5 }, "arrival");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
    const arriving = container.querySelector('[data-scoop-id="5"]') as SVGElement;
    assert.match(arriving.getAttribute("class")!, /ac-bowl-drop/);
    assert.match(arriving.getAttribute("style") ?? "", /--ac-drop-from/);

    await render(createElement(BowlBoard, { key: "empty", scoops: [], initialScoopId: null }));
    assert.match(container.textContent!, /아직 스쿱이 없어요/);
    assert.equal(container.querySelector('a[href="/"]')!.textContent, "오늘의 아티클 읽으러 가기 →");
    console.log("Bowl board: drawing, sr list, topping on top scoop, cocoa bowl, stage selection, Escape/background/same-scoop close, unknown id, deep link, arrival and empty state passed.");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
