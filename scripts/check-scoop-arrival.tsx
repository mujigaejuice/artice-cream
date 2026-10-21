/** Arrival timing and sound regression checks; no external requests or audio devices. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement, StrictMode } from "react";
import type { Scoop } from "../lib/feed";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://arrival.invalid/cone?new=2", pretendToBeVisual: true });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  let hidden = false;
  Object.defineProperty(document, "hidden", { get: () => hidden });
  let reduced = false;
  Object.defineProperty(window, "matchMedia", { value: () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }) });
  let fontsReady!: () => void;
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: new Promise<void>(resolve => { fontsReady = resolve; }) } });
  const frames = new Map<number, FrameRequestCallback>();
  const timers = new Map<number, () => void>();
  let sequence = 0;
  window.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence; };
  window.cancelAnimationFrame = id => { frames.delete(id); };
  window.setTimeout = ((callback: () => void) => { timers.set(++sequence, callback); return sequence; }) as typeof window.setTimeout;
  window.clearTimeout = id => { if (typeof id === "number") timers.delete(id); };
  let intersection: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;
  Object.defineProperty(globalThis, "IntersectionObserver", { value: class {
    constructor(callback: typeof intersection) { intersection = callback; }
    observe() {}
    disconnect() { intersection = null; }
  } });
  let scrolls = 0;
  dom.window.SVGElement.prototype.scrollIntoView = () => { scrolls++; };
  let resumes = 0;
  let sounds = 0;
  let audioFails = false;
  const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  Object.defineProperty(window, "AudioContext", { value: class {
    state = "suspended";
    currentTime = 0;
    destination = {};
    resume() { resumes++; this.state = "running"; return Promise.resolve(); }
    createOscillator() {
      if (audioFails) throw new Error("Audio device unavailable");
      return { frequency: param(), connect() {}, disconnect() {}, start() { sounds++; }, stop() {}, onended: null };
    }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
  } });
  const { createRoot } = await import("react-dom/client");
  const { ConeBoard } = await import("../components/ConeBoard");
  const { Result } = await import("../components/Result");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const container = document.getElementById("root")!;
  const root = createRoot(container);
  const scoops: Scoop[] = [1, 2].map(id => ({ id, articleId: id, variantId: id, domain: "cloud", domainLabel: "클라우드",
    date: `2026-10-0${id}`, title: `Article ${id}`, summaryFirstLine: null, score: 1 }));
  async function renderCone(key: string, justAddedId: number | null = 2) {
    await act(async () => { root.render(createElement(StrictMode, null, createElement(ConeBoard,
      { key, scoops, domains: [], initialScoopId: null, justAddedId }))); });
  }
  async function visible() { await act(async () => { intersection?.([{ isIntersecting: true }]); }); }
  async function frame() {
    await act(async () => { const batch = [...frames.values()]; frames.clear(); batch.forEach(callback => callback(0)); });
  }
  async function delay() {
    await act(async () => { const batch = [...timers.values()]; timers.clear(); batch.forEach(callback => callback()); });
  }
  async function animation(name: string) {
    await act(async () => {
      const event = new dom.window.Event("animationend", { bubbles: true });
      Object.defineProperty(event, "animationName", { value: name });
      container.querySelectorAll(".ac-scoop")[1].dispatchEvent(event);
    });
  }
  const originalFetch = globalThis.fetch;
  try {
    // The actual save button must unlock sound before awaiting the save request.
    Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://auth.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key", NEXT_PUBLIC_API_BASE: "" });
    let resolveSave!: (response: Response) => void;
    globalThis.fetch = async input => {
      assert.equal(String(input), "/api/progress/save");
      assert.equal(resumes, 1, "audio is unlocked before the network request");
      return new Promise<Response>(resolve => { resolveSave = resolve; });
    };
    let destination = "";
    const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push(href: string) { destination = href; }, replace() {}, prefetch() {}, bfcacheId: "test" };
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router }, createElement(Result, {
      articleTitle: "Test", result: { score: 1, correct: 1, total: 1, review: [], prevLevel: null, newLevel: null,
        dir: "유지", rollingAccuracy: null, domain: "cloud", domainLabel: "클라우드", articleId: 2, isReview: false, sourceUrl: "https://source.invalid" },
    }))); });
    await act(async () => { container.querySelector("button")!.click(); });
    assert.equal(resumes, 1);
    assert.equal(sounds, 0, "save/loading must be silent");
    await act(async () => { resolveSave(Response.json({ scoopId: 2 })); });
    assert.equal(destination, "/cone?new=2");

    await renderCone("arrival");
    assert.ok(container.querySelector(".ac-cone"), "cone is rendered while the new scoop waits");
    assert.equal(container.querySelectorAll(".ac-scoop-waiting").length, 1);
    assert.equal(container.querySelector(".ac-plop"), null);
    assert.equal(new URL(locationHref()).searchParams.get("new"), "2");
    await visible();
    await frame();
    assert.equal(timers.size, 0, "wait for fonts/layout first");
    await act(async () => { fontsReady(); });
    await frame();
    assert.equal(timers.size, 0, "the first frame must paint the cone");
    await frame();
    assert.equal(container.querySelector(".ac-plop"), null, "leave a short visible pause after painting");
    await delay();
    assert.ok(container.querySelector(".ac-plop"));
    assert.equal(sounds, 0, "no sound until actual CSS landing");
    await act(async () => { hidden = true; document.dispatchEvent(new dom.window.Event("visibilitychange")); });
    assert.equal((container.querySelector(".ac-plop") as SVGElement).style.animationPlayState, "paused");
    await act(async () => { hidden = false; document.dispatchEvent(new dom.window.Event("visibilitychange")); });
    await animation("ac-plop");
    await animation("ac-plop");
    assert.equal(sounds, 1, "exactly one sound at landing, even if an event is duplicated");
    await animation("ac-settle");
    assert.equal(container.querySelector(".ac-plop"), null);
    assert.equal(new URL(locationHref()).searchParams.has("new"), false);
    await renderCone("arrival");
    assert.equal(container.querySelector(".ac-scoop-waiting"), null, "rerenders must not replay a completed arrival");

    window.history.replaceState(null, "", "/cone?new=2");
    await renderCone("cancelled");
    await visible();
    await frame();
    await renderCone("ordinary", null);
    await frame();
    await delay();
    assert.equal(sounds, 1, "leaving before the animation cancels pending work");
    assert.equal(container.querySelector(".ac-plop"), null);

    reduced = true;
    await renderCone("reduced");
    await visible();
    await frame();
    await frame();
    await delay();
    assert.equal(container.querySelector(".ac-scoop-waiting, .ac-plop"), null, "reduced motion reveals the scoop without waiting for CSS events");
    assert.equal(sounds, 2);
    assert.equal(new URL(locationHref()).searchParams.has("new"), false);

    audioFails = true;
    window.history.replaceState(null, "", "/cone?new=2");
    await renderCone("no-audio");
    await visible();
    await frame();
    await frame();
    await delay();
    assert.equal(container.querySelector(".ac-scoop-waiting, .ac-plop"), null, "audio failure cannot block completion");
    assert.ok(scrolls > 0);
    console.log("Scoop arrival: save gesture audio unlock, font/paint/visibility gating, landing sound, single playback, cancellation and reduced motion passed.");
  } finally {
    await act(async () => { root.unmount(); });
    const { createClient } = await import("../lib/supabase/client");
    await createClient().auth.stopAutoRefresh();
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
  function locationHref() { return window.location.href; }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
