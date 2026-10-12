"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AdUnlockButton } from "@/components/AdUnlockButton";
import { ArticleCard } from "@/components/ArticleCard";
import { PageError, PageLoading } from "@/components/ScreenState";
import { apiJson } from "@/lib/client-api";
import type { TodayPick } from "@/lib/feed";
import { createClient } from "@/lib/supabase/client";
import { useRefreshOnResume } from "@/lib/use-refresh-on-resume";

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
    };

export default function TodayPage() {
  const router = useRouter();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const load = useCallback(() => {
    const current = ++request.current;
    setError(null);
    setFeed(null);
    void (async () => {
      try {
        const { data: { session }, error: sessionError } = await createClient().auth.getSession();
        if (current !== request.current) return;
        if (sessionError) throw sessionError;
        // 앱 시작 주소에서도 공개 소개까지 가는 데 기사 API가 필요하지 않다.
        // 로그인 상태는 화면 분기용이며, 실제 데이터 접근은 API가 다시 검증한다.
        if (!session || session.user.is_anonymous) {
          setFeed({ status: "onboarding" });
          return;
        }
        const next = await apiJson<Feed>("/api/feed");
        if (current === request.current) setFeed(next);
      } catch {
        if (current === request.current) setError("잠시 후 다시 시도해 주세요.");
      }
    })();
  }, []);

  useEffect(() => {
    load();
    return () => { request.current++; };
  }, [load]);
  useRefreshOnResume(load);

  // 세션이 없거나 수준 행이 없으면 온보딩을 끝내지 않은 것이다. 서버 컴포넌트가
  // redirect()로 하던 판정이 여기로 왔다.
  useEffect(() => {
    if (feed?.status === "onboarding") router.replace("/onboarding");
  }, [feed, router]);

  if (error) return (
    <>
      <PageError message={error} onRetry={load} />
      <nav aria-label="공개 안내" className="flex flex-wrap justify-center gap-x-5 text-stone-600">
        <Link href="/onboarding/" className="ac-intro-link">서비스 소개·로그인</Link>
        <Link href="/privacy/" className="ac-intro-link">개인정보처리방침</Link>
        <Link href="/account/delete/" className="ac-intro-link">계정 및 데이터 삭제</Link>
      </nav>
    </>
  );
  if (!feed || feed.status === "onboarding") {
    return <PageLoading label="오늘의 아티클을 불러오고 있어요" />;
  }

  const { picks, quota } = feed;

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

      {picks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-6 text-center">
          <p className="text-sm text-stone-600">
            읽을 아티클이 아직 준비되지 않았어요.
          </p>
          <p className="mt-1 text-xs text-stone-500">
            준비를 마친 아티클부터 보여 드릴게요.
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
