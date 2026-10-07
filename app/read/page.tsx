"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Reader, type ReaderProps } from "@/components/Reader";
import { PageError, PageLoading } from "@/components/ScreenState";
import { AdUnlockButton } from "@/components/AdUnlockButton";
import { apiJson } from "@/lib/client-api";
import { useQueryParams } from "@/lib/use-query";
import { useRefreshOnResume } from "@/lib/use-refresh-on-resume";

/**
 * 리더 (plan §5, 정책.md §7).
 *
 * 경로가 `/read/[variantId]`에서 `/read?v=123`으로 바뀌었다 — 정적 내보내기는
 * 빌드 시점에 없는 id로 경로를 만들 수 없고, variant id는 매일 새로 생긴다
 * (앱출시.md §2). 링크 모양은 `lib/routes.ts`에 모여 있다.
 *
 * 쿼터 게이트는 여전히 서버다. `/api/read/open`이 아티클을 처음 여는 것인지
 * 판정하고 쿼터를 깎고, 잠기면 본문을 아예 보내지 않는다. 이 화면은 그 응답을
 * 그릴 뿐이라 URL을 직접 쳐도 우회되지 않는다.
 */

type OpenResult =
  | { opened: true; reader: ReaderProps }
  | { opened: false; quota: { canUnlockWithAd: boolean } };

export default function ReadPage() {
  const router = useRouter();
  const query = useQueryParams();
  const [result, setResult] = useState<OpenResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const variantId = query?.get("v") ?? null;

  const load = useCallback(() => {
    if (!variantId) return;
    setError(null);
    setResult(null);
    apiJson<OpenResult>("/api/read/open", {
      method: "POST",
      body: JSON.stringify({ variantId: Number(variantId) }),
    })
      .then(setResult)
      .catch((e: Error) => setError(e.message));
  }, [variantId]);

  useEffect(load, [load]);
  useRefreshOnResume(load);

  // 세션이 없으면 온보딩으로. API가 401로 답한다.
  useEffect(() => {
    if (error === "unauthenticated") router.replace("/onboarding");
  }, [error, router]);

  if (query && !variantId) return <NotFound />;
  if (error === "not found") return <NotFound />;
  if (error) return <PageError message={error} onRetry={load} />;
  if (!result) return <PageLoading label="아티클을 불러오고 있어요" />;

  if (!result.opened) {
    return <QuotaWall canUnlockWithAd={result.quota.canUnlockWithAd} />;
  }

  return <Reader {...result.reader} />;
}

function NotFound() {
  return (
    <main className="py-16 text-center">
      <h1 className="text-lg font-semibold text-stone-900">
        없는 아티클이에요
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        주소가 잘못됐거나 내려간 글일 수 있어요.
      </p>
      <a
        href="/"
        className="mt-6 inline-block rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white"
      >
        오늘의 아티클로
      </a>
    </main>
  );
}

function QuotaWall({ canUnlockWithAd }: { canUnlockWithAd: boolean }) {
  return (
    <main className="py-16 text-center">
      <h1 className="text-lg font-semibold text-stone-900">
        오늘의 아티클을 다 읽었어요
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        {canUnlockWithAd
          ? "광고를 보면 한 편 더 읽을 수 있어요."
          : "내일 아침에 새 아티클이 올라와요."}
      </p>

      {/* 벽에서 바로 풀 수 있게 — 홈으로 돌아가 다시 누르게 하지 않는다. */}
      {canUnlockWithAd && (
        <div className="mx-auto mt-6 max-w-xs">
          <AdUnlockButton />
        </div>
      )}

      <a
        href="/"
        className="mt-4 inline-block rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white"
      >
        홈으로
      </a>
    </main>
  );
}
