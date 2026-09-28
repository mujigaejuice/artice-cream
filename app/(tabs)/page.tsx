"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AdUnlockButton } from "@/components/AdUnlockButton";
import { ArticleCard } from "@/components/ArticleCard";
import { PageError, PageLoading } from "@/components/ScreenState";
import { apiJson } from "@/lib/client-api";
import type { TodayPick } from "@/lib/feed";

/**
 * 오늘 탭 — 오늘 읽을 것만. 콘은 /cone으로 갈라져 나갔다.
 *
 * 데이터는 `/api/feed`에서 온다(앱출시.md §2). 여기 보이는 `quota.canRead`는
 * 표시용이고, 실제 게이트는 리더 진입에서 `/api/read/open`이 잰다 — 이 값을
 * 위조해도 본문은 오지 않는다(정책.md §7).
 */

type Feed =
  | { status: "onboarding" }
  | {
      status: "ok";
      picks: TodayPick[];
      quota: { remaining: number; canRead: boolean; canUnlockWithAd: boolean };
      isGuest: boolean;
    };

export default function TodayPage() {
  const router = useRouter();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setFeed(null);
    apiJson<Feed>("/api/feed")
      .then(setFeed)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  // 세션이 없거나 수준 행이 없으면 온보딩을 끝내지 않은 것이다. 서버 컴포넌트가
  // redirect()로 하던 판정이 여기로 왔다.
  useEffect(() => {
    if (feed?.status === "onboarding") router.replace("/onboarding");
  }, [feed, router]);

  if (error) return <PageError message={error} onRetry={load} />;
  if (!feed || feed.status === "onboarding") {
    return <PageLoading label="오늘의 아티클을 불러오고 있어요" />;
  }

  const { picks, quota, isGuest } = feed;

  return (
    <main>
      <header className="mb-5 flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight text-stone-900">
          <span className="ac-mark">오늘의 아티클</span>
        </h1>
        <p className="text-xs text-stone-500">
          {quota.canRead ? `오늘 ${quota.remaining}편 남음` : "오늘 분량을 다 읽었어요"}
        </p>
      </header>

      {/* 계정 화면이 따로 없어서, 지금은 이 배너가 유일한 연결 경로다. */}
      {isGuest && (
        <p className="mb-5 rounded-xl bg-amber-50 p-3 text-center text-sm text-amber-900">
          게스트로 읽고 있어요.{" "}
          <Link href="/onboarding?link=1" className="font-semibold underline">
            로그인하면 콘이 저장돼요
          </Link>
        </p>
      )}

      {picks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-6 text-center">
          <p className="text-sm text-stone-600">
            읽을 아티클이 아직 준비되지 않았어요.
          </p>
          <p className="mt-1 text-xs text-stone-500">
            매일 아침 새 아티클이 올라와요.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {picks.map((pick) => (
            <li key={pick.variantId}>
              <ArticleCard pick={pick} unlocked={quota.canRead} />
            </li>
          ))}
        </ul>
      )}

      {!quota.canRead && (
        <div className="mt-4 space-y-3">
          {quota.canUnlockWithAd && <AdUnlockButton onUnlocked={load} />}
          <p className="text-center">
            <Link href="/cone" className="text-sm font-medium text-stone-600 underline">
              오늘 읽은 걸 콘에서 볼 수 있어요 →
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}
