"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ConeBoard } from "@/components/ConeBoard";
import { CreditSummary } from "@/components/CreditSummary";
import { ShopSheet } from "@/components/ShopSheet";
import { PageError, PageLoading } from "@/components/ScreenState";
import { apiJson } from "@/lib/client-api";
import { dayKey, isMonthKey } from "@/lib/day";
import type { Scoop } from "@/lib/feed";
import { safeEquipped, type Equipped } from "@/lib/cosmetics";
import type { CreditSnapshot } from "@/lib/credits";
import type { DomainRow } from "@/lib/supabase/types";
import { useQueryParams } from "@/lib/use-query";
import { useRefreshOnResume } from "@/lib/use-refresh-on-resume";

/**
 * 콘 탭 — 쌓인 스쿱과, 스쿱을 눌렀을 때 뜨는 아티클 타이틀.
 *
 * 스쿱에 필요한 건 전부 `/api/cone`이 조인해 온다(variantId·title·score).
 * 선택 상태 때문에 다시 부를 일은 없다 — ConeBoard가 History API로 처리한다.
 */

type ConeData =
  | { status: "onboarding" }
  | { status: "ok"; userId: string; domains: DomainRow[]; scoops: Scoop[]; months: string[] };

export default function ConePage() {
  const router = useRouter();
  const query = useQueryParams();
  const [data, setData] = useState<ConeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [equipped, setEquipped] = useState<Equipped>({});
  const [shopRevision, setShopRevision] = useState(0);
  const requestId = useRef(0);
  const appearanceRequestId = useRef(0);
  const currentMonth = dayKey().slice(0, 7);

  useEffect(() => {
    if (!query) return;
    const requested = query.get("month");
    setMonth(requested && isMonthKey(requested) ? requested : currentMonth);
    setShopOpen(query.get("shop") === "1");
  }, [query, currentMonth]);

  useEffect(() => {
    function onPop() {
      setShopOpen(new URLSearchParams(window.location.search).get("shop") === "1");
      const requested = new URLSearchParams(window.location.search).get("month");
      const next = requested && isMonthKey(requested) ? requested : currentMonth;
      if (next === month) return;
      requestId.current++;
      setData(null);
      setError(null);
      setMonth(next);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [month, currentMonth]);

  const load = useCallback(() => {
    if (!month) return;
    const id = ++requestId.current;
    setError(null);
    setData(null);
    apiJson<ConeData>(`/api/cone?month=${month}`)
      .then((next) => { if (id === requestId.current) setData(next); })
      .catch(() => { if (id === requestId.current) setError("저장한 학습 기록을 불러오지 못했어요."); });
  }, [month]);

  useEffect(() => {
    load();
    return () => { requestId.current++; };
  }, [load]);
  useRefreshOnResume(load);

  const userId = data?.status === "ok" ? data.userId : null;
  useEffect(() => {
    const id = ++appearanceRequestId.current;
    setEquipped({});
    if (!userId) return;
    apiJson<CreditSnapshot>("/api/credits")
      .then((snapshot) => { if (id === appearanceRequestId.current && snapshot.userId === userId) {
        setEquipped(safeEquipped(snapshot.equipped));
      } })
      .catch(() => {});
    return () => { appearanceRequestId.current++; };
  }, [userId]);

  const applyAppearance = useCallback((next: Equipped) => setEquipped(safeEquipped(next)), []);

  const openShop = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("shop", "1");
    window.history.pushState(null, "", url.pathname + url.search);
    setShopOpen(true);
  }, []);

  const closeShop = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("shop");
    window.history.replaceState(null, "", url.pathname + url.search);
    setShopOpen(false);
  }, []);

  useEffect(() => {
    if (data?.status === "onboarding") router.replace("/onboarding");
  }, [data, router]);

  if (error) return <PageError message={error} onRetry={load} />;
  if (!data || data.status === "onboarding" || !query || !month) {
    return <PageLoading label="콘을 불러오고 있어요" />;
  }

  const { domains, scoops } = data;
  const months = [...new Set([currentMonth, month, ...data.months])].sort().reverse();

  function selectMonth(next: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("month", next);
    url.searchParams.delete("scoop");
    url.searchParams.delete("new");
    window.history.replaceState(null, "", url.pathname + url.search);
    // 이전 월 응답과 선택 상태가 새 월에 남지 않도록 즉시 비운다.
    requestId.current++;
    setData(null);
    setMonth(next);
  }

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

      <div className="mb-4">
        <CreditSummary key={`${data.userId}:${shopRevision}`} userId={data.userId} compact />
      </div>

      <button type="button" onClick={openShop}
        className="mb-5 min-h-11 rounded-xl border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2">
        내 콘 꾸미기
      </button>

      <label className="mb-3 flex items-center gap-2 text-sm text-stone-600">
        월 선택
        <select
          value={month}
          onChange={(event) => selectMonth(event.target.value)}
          className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
        >
          {months.map((value) => (
            <option key={value} value={value}>
              {value.slice(0, 4)}년 {Number(value.slice(5))}월{value === currentMonth ? " (이번 달)" : ""}
            </option>
          ))}
        </select>
      </label>

      <ConeBoard
        key={month}
        scoops={scoops}
        domains={domains}
        initialScoopId={asScoopId(new URLSearchParams(window.location.search).get("scoop"))}
        // 저장 직후 결과 화면이 ?new=<progress id>로 보낸다.
        justAddedId={asScoopId(new URLSearchParams(window.location.search).get("new"))}
        equipped={equipped}
      />
      {shopOpen && <ShopSheet userId={data.userId} scoops={scoops} onClose={closeShop}
        onApplied={applyAppearance} onBalanceChanged={() => setShopRevision((value) => value + 1)} />}
    </main>
  );
}
