"use client";

import { useEffect, useRef, useState } from "react";

import { isNative } from "@/lib/native";
import { readMusicPreference, writeMusicPreference } from "@/lib/music-preferences";

type Playback = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";
type MusicState = { ready: boolean; enabled: boolean; playback: Playback };
const SOURCE = "/audio/ice-cream-basic.mp3";

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
      // Leave src unset until music is enabled to avoid downloading on a silent visit.
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
    const waiting = () => { if (canPlay() && !audio.paused) update("loading"); };
    const paused = () => {
      if (audio.paused && playback === "playing") update(enabled ? "paused" : "idle");
    };
    const failed = () => { request++; update(enabled ? "error" : "idle"); };
    const hide = () => { pageHidden = true; pause(); };
    const show = () => { pageHidden = false; reconcile(); };
    const visibility = () => reconcile();
    audio.addEventListener("playing", playing);
    audio.addEventListener("waiting", waiting);
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
      audio.removeEventListener("waiting", waiting);
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
  const isPlaying = state.playback === "playing";
  const label = isPlaying ? "배경음악 끄기"
    : state.playback === "loading" ? "배경음악 재생 취소"
    : retry ? "배경음악 다시 재생" : "배경음악 켜기";
  const message = state.playback === "blocked" ? "눌러서 음악을 시작해요"
    : state.playback === "error" ? "음악을 불러오지 못했어요"
    : state.playback === "loading" ? "음악 준비 중…"
    : isPlaying ? "배경음악 재생 중"
    : state.enabled ? "음악 일시정지" : "";

  return (
    <div className="mb-3 flex min-h-11 justify-end" aria-label="배경음악">
      <span role="status" className="sr-only">{message}</span>
      <button type="button" disabled={!state.ready} aria-pressed={isPlaying}
        aria-label={label} title={label}
        onClick={() => retry ? actions.current?.retry() : actions.current?.toggle()}
        className="inline-flex size-11 items-center justify-center rounded-full text-stone-700 transition hover:bg-stone-200/60 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">
        <span aria-hidden="true" className="relative flex size-6 items-center justify-center font-serif text-2xl leading-none">
          ♬
          {!isPlaying && (
            <svg viewBox="0 0 24 24" className="absolute inset-0 size-6" fill="none" focusable="false">
              <path d="M4 3 21 22" stroke="#faf7f2" strokeWidth="4" strokeLinecap="round" />
              <path d="M4 3 21 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}
