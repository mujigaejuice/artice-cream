"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ConeBoard } from "@/components/ConeBoard";
import { PageError, PageLoading } from "@/components/ScreenState";
import { apiJson } from "@/lib/client-api";
import type { Scoop } from "@/lib/feed";
import type { DomainRow } from "@/lib/supabase/types";
import { useQueryParams } from "@/lib/use-query";

/**
 * 콘 탭 — 쌓인 스쿱과, 스쿱을 눌렀을 때 뜨는 아티클 타이틀.
 *
 * 스쿱에 필요한 건 전부 `/api/cone`이 조인해 온다(variantId·title·score).
 * 선택 상태 때문에 다시 부를 일은 없다 — ConeBoard가 History API로 처리한다.
 */

type ConeData =
  | { status: "onboarding" }
  | { status: "ok"; domains: DomainRow[]; scoops: Scoop[]; months: string[] };

export default function ConePage() {
  const router = useRouter();
  const query = useQueryParams();
  const [data, setData] = useState<ConeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    apiJson<ConeData>("/api/cone")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (data?.status === "onboarding") router.replace("/onboarding");
  }, [data, router]);

  if (error) return <PageError message={error} onRetry={load} />;
  if (!data || data.status === "onboarding" || !query) {
    return <PageLoading label="콘을 불러오고 있어요" />;
  }

  const { domains, scoops } = data;

  // 있는 스쿱일 때만 초기 선택으로 인정한다 — 남의 id나 지난 달 id가 섞여
  // 들어오면 아무것도 안 고른 것으로 둔다.
  const asScoopId = (raw: string | null) => {
    const n = Number(raw);
    return Number.isInteger(n) && scoops.some((s) => s.id === n) ? n : null;
  };

  return (
    <main>
      <header className="mb-2 flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight text-stone-900">
          <span className="ac-mark">내 콘</span>
        </h1>
        <p className="text-xs text-stone-500">스쿱 {scoops.length}개</p>
      </header>

      <ConeBoard
        scoops={scoops}
        domains={domains}
        initialScoopId={asScoopId(query.get("scoop"))}
        // 저장 직후 결과 화면이 ?new=<progress id>로 보낸다.
        justAddedId={asScoopId(query.get("new"))}
      />
    </main>
  );
}
