"use client";

import { useState } from "react";

import { apiFetch, apiJson } from "@/lib/client-api";

/**
 * Rewarded-ad unlock, stubbed.
 *
 * The real AdMob / web SSV flow replaces the `await watchAd()` line; everything
 * around it — issue nonce, play, redeem — is the shape the real one uses too.
 *
 * `onUnlocked`이 있는 이유: 정적 내보내기에는 `router.refresh()`가 다시 읽어 올
 * 서버 렌더가 없다(앱출시.md §2). 해제한 뒤 쿼터를 다시 보려면 부른 화면이
 * 자기 데이터를 다시 가져와야 한다. 넘기지 않으면 페이지를 새로 읽는다.
 */
export function AdUnlockButton({ onUnlocked }: { onUnlocked?: () => void }) {
  const [state, setState] = useState<"idle" | "playing" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function unlock() {
    setState("playing");
    setMessage(null);

    try {
      const { nonce } = await apiJson<{ nonce: string }>("/api/ads/reward");

      await watchAd();

      const redeemed = await apiFetch("/api/ads/reward", {
        method: "POST",
        body: JSON.stringify({ nonce }),
      });

      if (!redeemed.ok) {
        const body = await redeemed.json().catch(() => ({}));
        throw new Error(
          redeemed.status === 429
            ? "오늘 광고로 열 수 있는 만큼 다 열었어요"
            : (body.error ?? "적립에 실패했어요"),
        );
      }

      setState("idle");
      if (onUnlocked) onUnlocked();
      else window.location.reload();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "실패했어요");
    }
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={unlock}
        disabled={state === "playing"}
        className="w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
      >
        {state === "playing" ? "광고 재생 중…" : "광고 보고 한 편 더 읽기"}
      </button>
      {message && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {message}
        </p>
      )}
    </div>
  );
}

/** Placeholder for the ad SDK's "reward earned" callback. */
function watchAd(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1200));
}
