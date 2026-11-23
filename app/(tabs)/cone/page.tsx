"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { BowlBoard } from "@/components/BowlBoard";
import { ConeBoard } from "@/components/ConeBoard";
import { CreditSummary } from "@/components/CreditSummary";
import { FlavorLegend } from "@/components/FlavorLegend";
import { ShopSheet } from "@/components/ShopSheet";
import { PageError, PageLoading } from "@/components/ScreenState";
import { apiJson } from "@/lib/client-api";
import { dayKey, isMonthKey } from "@/lib/day";
import type { Scoop } from "@/lib/feed";
import { CREDITS_CHANGED_EVENT, OPEN_SHOP_EVENT, safeEquipped, safeScoopColors, type Equipped, type ScoopColors } from "@/lib/cosmetics";
import type { CreditSnapshot } from "@/lib/credits";
import type { DomainRow } from "@/lib/supabase/types";
import { useQueryParams } from "@/lib/use-query";
import { useRefreshOnResume } from "@/lib/use-refresh-on-resume";
import { useWideLayout } from "@/lib/use-wide-layout";

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
  // 노트북에서는 콘 대신 보울 장면과 오른쪽 도구 칸을 그린다.
  const wide = useWideLayout();
  const [data, setData] = useState<ConeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [equipped, setEquipped] = useState<Equipped>({});
  const [scoopColors, setScoopColors] = useState<ScoopColors>({});
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
    setScoopColors({});
    if (!userId) return;
    apiJson<CreditSnapshot>("/api/credits")
      .then((snapshot) => { if (id === appearanceRequestId.current && snapshot.userId === userId) {
        setEquipped(safeEquipped(snapshot.equipped));
        setScoopColors(safeScoopColors(snapshot.scoopColors));
      } })
      .catch(() => {});
    return () => { appearanceRequestId.current++; };
  }, [userId]);

  const applyAppearance = useCallback((next: Equipped) => setEquipped(safeEquipped(next)), []);
  const applyScoopColors = useCallback((next: ScoopColors) => setScoopColors(safeScoopColors(next)), []);

  const openShop = useCallback(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("shop") === "1") return;
    url.searchParams.set("shop", "1");
    window.history.pushState(null, "", url.pathname + url.search);
    setShopOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(OPEN_SHOP_EVENT, openShop);
    return () => window.removeEventListener(OPEN_SHOP_EVENT, openShop);
  }, [openShop]);

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

  const initialScoopId = asScoopId(new URLSearchParams(window.location.search).get("scoop"));
  // 저장 직후 결과 화면이 ?new=<progress id>로 보낸다.
  const justAddedId = asScoopId(new URLSearchParams(window.location.search).get("new"));
  const monthSelect = (
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
  );
  const shop = shopOpen && <ShopSheet userId={data.userId} scoops={scoops} onClose={closeShop}
    onApplied={applyAppearance} onColorsChanged={applyScoopColors}
    onBalanceChanged={() => {
      setShopRevision((value) => value + 1);
      // 상단 메뉴 바의 잔액도 다시 읽는다.
      window.dispatchEvent(new window.Event(CREDITS_CHANGED_EVENT));
    }} />;

  if (wide) {
    return (
      <main className="grid grid-cols-[minmax(0,1fr)_220px] gap-8">
        <div className="min-w-0">
          <header className="mb-4">
            <h1 className="text-xl font-bold tracking-tight text-stone-900">
              <span className="ac-mark">내 콘</span>
            </h1>
          </header>
          {/* 폭이 바뀌어 보드가 갈아 끼워져도 ?scoop=로 같은 스쿱이 다시 선택된다. */}
          <BowlBoard
            key={month}
            scoops={scoops}
            initialScoopId={initialScoopId}
            justAddedId={justAddedId}
            equipped={equipped}
            scoopColors={scoopColors}
          />
        </div>
        <aside aria-label="콘 도구" className="sticky top-20 space-y-3 self-start">
          <section className="rounded-2xl border border-stone-200 bg-white/70 p-4">
            <p className="flex items-baseline justify-between text-sm">
              <span className="font-semibold text-stone-800">{Number(month.slice(5))}월</span>
              <span className="text-xs text-stone-500">스쿱 {scoops.length}개</span>
            </p>
            <label className="mt-3 block text-xs text-stone-600">
              <span className="sr-only">월 선택</span>
              {monthSelect}
            </label>
          </section>
          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white/70 p-4">
            <CreditSummary key={`${data.userId}:${shopRevision}`} userId={data.userId} compact />
            <button type="button" onClick={() => window.dispatchEvent(new window.Event(OPEN_SHOP_EVENT))}
              className="w-full rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">
              🏪 꾸미기 상점
            </button>
          </section>
          <div className="rounded-2xl border border-stone-200 bg-white/70 p-4">
            <FlavorLegend domains={domains} equipped={equipped} scoopColors={scoopColors} className="" />
          </div>
        </aside>
        {shop}
      </main>
    );
  }

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

      <label className="mb-3 flex items-center gap-2 text-sm text-stone-600">
        월 선택
        {monthSelect}
      </label>

      <ConeBoard
        key={month}
        scoops={scoops}
        domains={domains}
        initialScoopId={initialScoopId}
        justAddedId={justAddedId}
        equipped={equipped}
        scoopColors={scoopColors}
      />
      {shop}
    </main>
  );
}
