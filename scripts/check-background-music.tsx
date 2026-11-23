/** Real component with controlled media; no network or audio output. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement, StrictMode } from "react";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://music.invalid", pretendToBeVisual: true });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  // CI처럼 env가 있을 때와 같은 경로를 탄다. Node BroadcastChannel은 프로세스 종료를 막으므로 위에서 비운다.
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://music-auth.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture" });
  let hidden = false;
  Object.defineProperty(document, "hidden", { get: () => hidden });
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
  try {
    await mount();
    assert.ok(players.every(p => p.calls === 0 && !p.src), "first visit neither plays nor loads the audio");
    assert.equal(container.querySelectorAll("button").length, 1);
    assert.ok(toggle().querySelector("svg"), "not playing shows the crossed-out note");
    await click();
    const player = current();
    assert.equal(player.loop, true);
    assert.equal(player.volume, .2);
    assert.equal(player.paused, false);
    assert.match(container.textContent!, /배경음악 재생 중/);
    assert.equal(toggle().textContent?.trim(), "♬");
    assert.equal(toggle().querySelector("svg"), null, "playing shows the plain note");
    assert.equal(toggle().getAttribute("aria-pressed"), "true");
    await act(async () => player.dispatchEvent(new dom.window.Event("waiting")));
    assert.ok(toggle().querySelector("svg"), "buffering is not shown as playing");
    await act(async () => player.dispatchEvent(new dom.window.Event("playing")));
    assert.equal(JSON.parse(window.localStorage.getItem(key)!).enabled, true);
    player.currentTime = 12;
    const count = players.length;
    await mount();
    assert.equal(players.length, count, "parent rerenders do not replace the player");
    assert.equal(player.currentTime, 12);
    await visible(false);
    assert.equal(player.paused, true);
    assert.ok(toggle().querySelector("svg"), "paused state shows the crossed-out note");
    await visible(true);
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
    assert.equal(toggle().getAttribute("aria-pressed"), "false");
    assert.ok(toggle().querySelector("svg"), "saved ON must not look like actual playback when blocked");
    mode = "success";
    await click();
    assert.equal(current().paused, false);
    await clear(); await mount();
    assert.equal(current().paused, false, "saved ON resumes when autoplay is allowed");

    current().error = {};
    await act(async () => current().dispatchEvent(new dom.window.Event("error")));
    assert.match(container.textContent!, /음악을 불러오지 못했어요/);
    assert.ok(toggle().querySelector("svg"));
    await click();
    assert.equal(current().error, null);
    assert.match(container.textContent!, /배경음악 재생 중/);
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

    window.localStorage.setItem(key, "invalid JSON");
    await mount();
    assert.equal(current().calls, 0, "malformed preference defaults to silence");
    await clear();
    Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new Error("Storage denied"); } });
    await mount(); await click();
    assert.equal(current().paused, false, "storage failure does not block playback");
    await clear();
    assert.ok(players.every(p => p.paused), "no abandoned player keeps playing");
    console.log("Background music: autoplay, persistence, lifecycle, retry, races and cleanup passed.");
  } finally {
    await act(async () => root.unmount());
    const { createClient } = await import("../lib/supabase/client");
    await createClient().auth.stopAutoRefresh();
    dom.window.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
