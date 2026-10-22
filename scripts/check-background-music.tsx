/** Real component with controlled media / native bridges; no network or audio output. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement, StrictMode } from "react";

async function main() {
  const native = process.argv.includes("--native");
  const dom = new JSDOM('<div id="root"></div>', { url: "https://music.invalid", pretendToBeVisual: true });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  let hidden = false;
  Object.defineProperty(document, "hidden", { get: () => hidden });
  const nativeHandlers = new Map<string, Set<(state?: { isActive: boolean }) => void>>();
  const nativeStorage = new Map<string, string>();
  let deferNativeRead = false;
  let finishRead: (() => void) | undefined;
  let deferListeners = false;
  const finishListeners: Array<() => void> = [];
  if (native) {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    registerPlugin("Preferences", { web: () => ({
      get: async ({ key }: { key: string }) => {
        const value = nativeStorage.get(key) ?? null;
        if (deferNativeRead) await new Promise<void>(resolve => { finishRead = resolve; });
        return { value };
      },
      set: async ({ key, value }: { key: string; value: string }) => { nativeStorage.set(key, value); },
    }) });
    registerPlugin("App", { web: () => ({
      getState: async () => ({ isActive: true }),
      addListener: async (event: string, callback: (state?: { isActive: boolean }) => void) => {
        if (deferListeners) await new Promise<void>(resolve => { finishListeners.push(resolve); });
        const set = nativeHandlers.get(event) ?? new Set();
        set.add(callback); nativeHandlers.set(event, set);
        return { remove: async () => { set.delete(callback); } };
      },
    }) });
    Capacitor.isNativePlatform = () => true;
  }
  type Mode = "success" | "blocked" | "deferred";
  let mode: Mode = "success";
  const players: FakeAudio[] = [];
  const pending: Array<() => void> = [];
  class FakeAudio extends dom.window.EventTarget {
    src = ""; loop = false; preload = ""; volume = 1; paused = true;
    currentTime = 0; error: object | null = null; calls = 0;
    constructor() { super(); players.push(this); }
    getAttribute() { return this.src || null; }
    removeAttribute() { this.src = ""; }
    load() { this.error = null; }
    play() {
      this.calls++;
      if (mode === "blocked") return Promise.reject(new dom.window.DOMException("Blocked", "NotAllowedError"));
      const start = () => { this.paused = false; this.dispatchEvent(new dom.window.Event("playing")); };
      if (mode === "deferred") return new Promise<void>(resolve => { pending.push(() => { start(); resolve(); }); });
      start(); return Promise.resolve();
    }
    pause() { this.paused = true; this.dispatchEvent(new dom.window.Event("pause")); }
  }
  Object.defineProperty(window, "Audio", { configurable: true, value: FakeAudio });
  const { BackgroundMusic } = await import("../components/BackgroundMusic");
  const { MUSIC_PREFERENCE_KEY: key } = await import("../lib/music-preferences");
  const { createRoot } = await import("react-dom/client");
  const container = document.getElementById("root")!;
  const root = createRoot(container);
  const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  const toggle = () => container.querySelector<HTMLButtonElement>("button[aria-pressed]")!;
  const current = () => players.at(-1)!;
  const click = async (button = toggle()) => { await act(async () => button.click()); await flush(); };
  const mount = async () => { await act(async () => root.render(createElement(StrictMode, null, createElement(BackgroundMusic)))); await flush(); };
  const clear = async () => { await act(async () => root.render(null)); await flush(); };
  const visible = async (value: boolean) => {
    await act(async () => { hidden = !value; document.dispatchEvent(new dom.window.Event("visibilitychange")); });
  };
  const nativeEvent = async (event: string, state?: { isActive: boolean }) => {
    await act(async () => nativeHandlers.get(event)?.forEach(callback => callback(state)));
  };
  try {
    await mount();
    assert.ok(players.every(p => p.calls === 0 && !p.src), "first visit neither plays nor loads the WAV");
    await click();
    const player = current();
    assert.equal(player.loop, true);
    assert.equal(player.volume, .2);
    assert.equal(player.paused, false);
    assert.match(container.textContent!, /아이스크림 산책/);
    assert.equal(JSON.parse(window.localStorage.getItem(key)!).enabled, true);
    if (native) assert.equal(JSON.parse(nativeStorage.get(key)!).enabled, true);
    player.currentTime = 12;
    const count = players.length;
    await mount();
    assert.equal(players.length, count, "parent rerenders do not replace the player");
    assert.equal(player.currentTime, 12);
    await visible(false);
    assert.equal(player.paused, true);
    if (native) {
      await nativeEvent("pause");
      await visible(true);
      assert.equal(player.paused, true, "document visibility cannot override native pause");
      await nativeEvent("resume");
      assert.equal(player.paused, false);
      await nativeEvent("appStateChange", { isActive: false });
      assert.equal(player.paused, true);
      await nativeEvent("appStateChange", { isActive: true });
    } else await visible(true);
    assert.equal(player.paused, false);
    assert.equal(player.currentTime, 12, "resume preserves position");
    await act(async () => window.dispatchEvent(new dom.window.Event("pagehide")));
    assert.equal(player.paused, true);
    await act(async () => window.dispatchEvent(new dom.window.Event("pageshow")));
    assert.equal(player.paused, false);
    await click();
    await visible(false); await visible(true);
    assert.equal(player.paused, true, "OFF stays OFF after resume");
    await clear(); await mount();
    assert.equal(current().calls, 0, "OFF survives remount");

    mode = "blocked";
    await click();
    assert.match(container.textContent!, /눌러서 음악을 시작해요/);
    assert.equal(toggle().getAttribute("aria-pressed"), "true");
    mode = "success";
    await click([...container.querySelectorAll("button")].find(b => b.textContent === "음악 재생")!);
    assert.equal(current().paused, false);
    await clear(); await mount();
    assert.equal(current().paused, false, "saved ON resumes when autoplay is allowed");

    current().error = {};
    await act(async () => current().dispatchEvent(new dom.window.Event("error")));
    assert.match(container.textContent!, /음악을 불러오지 못했어요/);
    await click([...container.querySelectorAll("button")].find(b => b.textContent === "다시 시도")!);
    assert.equal(current().error, null);
    assert.match(container.textContent!, /아이스크림 산책/);
    await click();
    mode = "deferred";
    await click(); // ON with pending play
    await click(); // OFF before it resolves
    await act(async () => { pending.splice(0).forEach(resolve => resolve()); });
    assert.equal(current().paused, true, "late play resolution cannot resurrect OFF music");
    assert.equal(toggle().getAttribute("aria-pressed"), "false");
    await click();
    const disposedPlayer = current();
    await clear();
    await act(async () => { pending.splice(0).forEach(resolve => resolve()); });
    assert.equal(disposedPlayer.paused, true, "unmount cancels pending playback");
    mode = "success";

    if (native) {
      nativeStorage.set(key, JSON.stringify({ enabled: true }));
      deferNativeRead = true;
      await mount();
      await click(); await click(); // explicit OFF overrides the saved ON still in flight
      await act(async () => finishRead?.());
      assert.equal(current().paused, true);
      assert.equal(toggle().getAttribute("aria-pressed"), "false");
      deferNativeRead = false;
      await clear();
      deferListeners = true;
      await mount(); await clear();
      await act(async () => { finishListeners.splice(0).forEach(resolve => resolve()); });
      assert.ok([...nativeHandlers.values()].every(set => set.size === 0), "late native listener registration is cleaned up");
    } else {
      window.localStorage.setItem(key, "invalid JSON");
      await mount();
      assert.equal(current().calls, 0, "malformed preference defaults to silence");
      await clear();
      Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new Error("Storage denied"); } });
      await mount(); await click();
      assert.equal(current().paused, false, "storage failure does not block playback");
      await clear();
    }
    assert.ok(players.every(p => p.paused), "no abandoned player keeps playing");
    console.log(`Background music ${native ? "native" : "web"}: autoplay, persistence, lifecycle, retry, races and cleanup passed.`);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
