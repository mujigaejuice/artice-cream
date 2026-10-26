"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { OPEN_SHOP_EVENT } from "@/lib/cosmetics";
import { isNative } from "@/lib/native";
import { readMusicPreference, writeMusicPreference } from "@/lib/music-preferences";
import { apiJson } from "@/lib/client-api";
import type { CreditSnapshot } from "@/lib/credits";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_MUSIC_SOURCE, MUSIC_EQUIPPED_EVENT, MUSIC_PREVIEW_EVENT, musicSource } from "@/lib/shop-music";

type Playback = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";
type MusicState = { ready: boolean; enabled: boolean; playback: Playback };

/** One player in the root layout; route changes never recreate the audio element. */
export function BackgroundMusic() {
  const pathname = usePathname();
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
    let source = DEFAULT_MUSIC_SOURCE;
    let selectedUser: string | null = null;
    let musicRequest = 0;
    let previewing = false;
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribeAuth: (() => void) | undefined;
    const nativeRemovers: Array<() => Promise<void>> = [];

    function update(next: Playback) {
      playback = next;
      if (!disposed) setState({ ready: true, enabled, playback });
    }
    function canPlay() { return !disposed && enabled && !previewing && !document.hidden && !pageHidden && nativeActive; }
    function pause() {
      request++;
      audio.pause();
      update(enabled ? "paused" : "idle");
    }
    function play() {
      if (!canPlay() || playback === "loading" || playback === "playing") return;
      const attempt = ++request;
      // Leave src unset until music is enabled to avoid downloading on a silent visit.
      if (!audio.getAttribute("src")) audio.src = source;
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
    function selectSource(next: string) {
      if (source === next) return;
      source = next;
      request++;
      const loaded = !!audio.getAttribute("src");
      audio.pause();
      if (loaded) { audio.src = next; audio.load(); }
      update("idle");
      reconcile();
    }
    async function refreshMusic() {
      const id = ++musicRequest;
      try {
        const { data: { session } } = await createClient().auth.getSession();
        if (disposed || id !== musicRequest) return;
        const userId = session?.user && session.user.is_anonymous !== true ? session.user.id : null;
        if (userId !== selectedUser) {
          selectedUser = userId;
          selectSource(DEFAULT_MUSIC_SOURCE);
        }
        if (!userId) return;
        const snapshot = await apiJson<CreditSnapshot>("/api/credits");
        if (disposed || id !== musicRequest || snapshot.userId !== userId) return;
        selectSource(musicSource(snapshot.equipped?.music));
      } catch {
        // Music stays optional when auth or credit lookup is unavailable.
      }
    }
    const equippedChanged = () => { void refreshMusic(); };
    const previewChanged = (event: Event) => {
      previewing = (event as CustomEvent<boolean>).detail === true;
      reconcile();
    };
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
    window.addEventListener(MUSIC_EQUIPPED_EVENT, equippedChanged);
    window.addEventListener(MUSIC_PREVIEW_EVENT, previewChanged);

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
    try {
      const { data: { subscription } } = createClient().auth.onAuthStateChange((event) => {
        if (event === "INITIAL_SESSION") return;
        if (authTimer) clearTimeout(authTimer);
        authTimer = setTimeout(() => { void refreshMusic(); }, 0);
      });
      unsubscribeAuth = () => subscription.unsubscribe();
      void refreshMusic();
    } catch { /* A missing auth configuration must not break the music toggle. */ }

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
      musicRequest++;
      if (authTimer) clearTimeout(authTimer);
      unsubscribeAuth?.();
      actions.current = null;
      audio.removeEventListener("playing", playing);
      audio.removeEventListener("waiting", waiting);
      audio.removeEventListener("pause", paused);
      audio.removeEventListener("error", failed);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      window.removeEventListener(MUSIC_EQUIPPED_EVENT, equippedChanged);
      window.removeEventListener(MUSIC_PREVIEW_EVENT, previewChanged);
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
    <div className="mb-3 flex min-h-11 items-center justify-end gap-1" aria-label="상단 도구">
      {pathname?.replace(/\/$/, "") === "/cone" && <button type="button"
        aria-label="꾸미기 상점 열기" title="꾸미기 상점 열기"
        onClick={() => window.dispatchEvent(new window.Event(OPEN_SHOP_EVENT))}
        className="inline-flex size-11 items-center justify-center rounded-full text-stone-800 transition hover:bg-stone-200/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 10.5v9h16v-9M3 9l2-5h14l2 5" />
          <path d="M3 9c0 1.7 2.5 2.6 3.6.8.8 1.9 3.3 1.9 4.2 0 .8 1.9 3.3 1.9 4.2 0 1.1 1.8 3.6.9 3.6-.8" />
          <path d="M9 19.5v-5h6v5" />
        </svg>
      </button>}
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
