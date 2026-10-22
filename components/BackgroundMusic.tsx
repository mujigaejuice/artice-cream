"use client";

import { useEffect, useRef, useState } from "react";

import { isNative } from "@/lib/native";
import { readMusicPreference, writeMusicPreference } from "@/lib/music-preferences";

type Playback = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";
type MusicState = { ready: boolean; enabled: boolean; playback: Playback };
const SOURCE = "/audio/ice-cream-stroll-30s.wav";

/** One player in the root layout; route changes never recreate the audio element. */
export function BackgroundMusic() {
  const [state, setState] = useState<MusicState>({ ready: false, enabled: false, playback: "idle" });
  const actions = useRef<{ toggle(): void; retry(): void } | null>(null);

  useEffect(() => {
    const audio = new window.Audio();
    audio.loop = true;
    audio.preload = "none";
    audio.volume = 0.2;
    let disposed = false;
    let enabled = false;
    let chosen = false;
    let playback: Playback = "idle";
    let request = 0;
    let pageHidden = false;
    let nativeActive = !isNative();
    let nativeRevision = 0;
    const nativeRemovers: Array<() => Promise<void>> = [];

    function update(next: Playback) {
      playback = next;
      if (!disposed) setState({ ready: true, enabled, playback });
    }
    function canPlay() { return !disposed && enabled && !document.hidden && !pageHidden && nativeActive; }
    function pause() {
      request++;
      audio.pause();
      update(enabled ? "paused" : "idle");
    }
    function play() {
      if (!canPlay() || playback === "loading" || playback === "playing") return;
      const attempt = ++request;
      // Leave src unset until music is enabled: no 5 MB download on a silent visit.
      if (!audio.getAttribute("src")) audio.src = SOURCE;
      if (audio.error) audio.load();
      update("loading");
      const failed = (error: unknown) => {
        if (disposed || attempt !== request) return;
        const name = (error as { name?: string } | null)?.name;
        update(name === "NotAllowedError" ? "blocked" : name === "AbortError" ? "paused" : "error");
      };
      try {
        // Invoke synchronously inside the click, before storage or native awaits.
        void audio.play().then(() => {
          if (!canPlay()) { audio.pause(); return; }
          if (attempt === request) update("playing");
        }, failed);
      } catch (error) { failed(error); }
    }
    function reconcile() {
      if (!canPlay()) pause();
      else if (playback !== "error" && playback !== "blocked") play();
    }
    const playing = () => { if (canPlay()) update("playing"); else pause(); };
    const paused = () => {
      if (audio.paused && playback === "playing") update(enabled ? "paused" : "idle");
    };
    const failed = () => { request++; update(enabled ? "error" : "idle"); };
    const hide = () => { pageHidden = true; pause(); };
    const show = () => { pageHidden = false; reconcile(); };
    const visibility = () => reconcile();
    audio.addEventListener("playing", playing);
    audio.addEventListener("pause", paused);
    audio.addEventListener("error", failed);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);

    actions.current = {
      toggle() {
        chosen = true;
        enabled = !enabled;
        if (enabled) { update("idle"); play(); }
        else pause();
        writeMusicPreference(enabled);
      },
      retry() { if (enabled) { update("idle"); play(); } },
    };
    update("idle");
    void readMusicPreference().then(saved => {
      // A slow native read must not undo a choice already made on this screen.
      if (disposed || chosen) return;
      enabled = saved;
      update("idle");
      reconcile();
    });

    if (isNative()) {
      void (async () => {
        const { App } = await import("@capacitor/app");
        if (disposed) return;
        const changed = (active: boolean) => {
          if (disposed) return;
          nativeRevision++;
          nativeActive = active;
          reconcile();
        };
        const keep = async (pending: Promise<{ remove(): Promise<void> }>) => {
          const handle = await pending;
          if (disposed) { await handle.remove(); return; }
          nativeRemovers.push(() => handle.remove());
        };
        await Promise.all([
          keep(App.addListener("appStateChange", ({ isActive }) => changed(isActive))),
          keep(App.addListener("pause", () => changed(false))),
          keep(App.addListener("resume", () => changed(true))),
        ]);
        if (disposed) return;
        const revision = nativeRevision;
        const current = await App.getState();
        if (!disposed && revision === nativeRevision) changed(current.isActive);
      })().catch(() => {
        if (disposed || nativeRevision > 0) return;
        nativeActive = true;
        reconcile(); // Browser visibility remains the fallback if the bridge fails.
      });
    }

    return () => {
      disposed = true;
      request++;
      actions.current = null;
      audio.removeEventListener("playing", playing);
      audio.removeEventListener("pause", paused);
      audio.removeEventListener("error", failed);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      nativeRemovers.forEach(remove => { void remove().catch(() => {}); });
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, []);

  const retry = state.enabled && ["blocked", "error", "paused"].includes(state.playback);
  const message = state.playback === "blocked" ? "눌러서 음악을 시작해요"
    : state.playback === "error" ? "음악을 불러오지 못했어요"
    : state.playback === "loading" ? "음악 준비 중…"
    : state.playback === "playing" ? "아이스크림 산책"
    : state.enabled ? "음악 일시정지" : "";

  return (
    <div className="mb-3 flex min-h-11 flex-wrap items-center justify-end gap-x-3 gap-y-1" aria-label="배경음악">
      <span role="status" className="text-xs text-stone-600">{message}</span>
      {retry && (
        <button type="button" onClick={() => actions.current?.retry()}
          className="min-h-11 rounded-lg px-2 text-xs text-stone-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">
          {state.playback === "error" ? "다시 시도" : "음악 재생"}
        </button>
      )}
      <button type="button" disabled={!state.ready} aria-pressed={state.enabled}
        aria-label={state.enabled ? "배경음악 끄기" : "배경음악 켜기"}
        onClick={() => actions.current?.toggle()}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-stone-300 bg-white/70 px-3 text-xs font-medium text-stone-700 transition hover:bg-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">
        <span aria-hidden="true">{state.enabled ? "♫" : "♪"}</span>
        {state.enabled ? "음악 끄기" : "음악 켜기"}
      </button>
    </div>
  );
}
