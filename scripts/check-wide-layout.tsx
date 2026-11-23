/** Wide-layout hook and route rules; jsdom only, no network. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://wide.invalid/" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const { isWideRoute, isBareHeaderRoute } = await import("../lib/layout-width");
  const { useWideLayout, WIDE_QUERY } = await import("../lib/use-wide-layout");

  assert.equal(isWideRoute("/"), true);
  assert.equal(isWideRoute("/cone/"), true);
  assert.equal(isWideRoute("/read"), true);
  assert.equal(isWideRoute("/preview/today"), true);
  assert.equal(isWideRoute("/preview/read"), true);
  assert.equal(isWideRoute("/read/quiz"), false);
  assert.equal(isWideRoute("/words"), false);
  assert.equal(isWideRoute(null), false);
  assert.equal(isBareHeaderRoute("/onboarding"), true);
  assert.equal(isBareHeaderRoute("/auth/callback"), true);
  assert.equal(isBareHeaderRoute("/"), false);
  assert.equal(isBareHeaderRoute("/onboardingx"), false);
  assert.equal(isBareHeaderRoute(null), false);

  const { createRoot } = await import("react-dom/client");
  const container = document.getElementById("root")!;
  const root = createRoot(container);
  function Probe() { return createElement("p", null, useWideLayout() ? "wide" : "narrow"); }
  try {
    await act(async () => root.render(createElement(Probe)));
    assert.equal(container.textContent, "narrow", "no matchMedia means narrow");
    await act(async () => root.unmount());

    const listeners: Array<(event: { matches: boolean }) => void> = [];
    let wide = true;
    Object.defineProperty(window, "matchMedia", { configurable: true, value: (q: string) => ({
      get matches() { return q === WIDE_QUERY && wide; }, media: q,
      addEventListener(_: string, cb: (event: { matches: boolean }) => void) { listeners.push(cb); },
      removeEventListener() {} }) });
    const root2 = createRoot(container);
    await act(async () => root2.render(createElement(Probe)));
    assert.equal(container.textContent, "wide", "wide query matches");
    wide = false;
    await act(async () => { listeners.forEach(cb => cb({ matches: false })); });
    assert.equal(container.textContent, "narrow", "follows change events");
    await act(async () => root2.unmount());
    console.log("Wide layout: route rules, missing matchMedia, wide match and change tracking passed.");
  } finally {
    dom.window.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
