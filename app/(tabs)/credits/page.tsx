"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { PageError, PageLoading } from "@/components/ScreenState";
import { apiJson } from "@/lib/client-api";
import type { CreditEvent, CreditHistoryPage, CreditSnapshot } from "@/lib/credits";
import { createClient } from "@/lib/supabase/client";
import { useRefreshOnResume } from "@/lib/use-refresh-on-resume";

const eventLabel: Record<CreditEvent["reason"], string> = {
  article_read: "학습 완료",
  quiz_bonus: "퀴즈 보너스",
  welcome: "첫 학습 축하",
  purchase: "꾸미기 구매",
  adjustment: "크레딧 조정",
};

const dateTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: false,
});

export default function CreditsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authAttempt, setAuthAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<CreditSnapshot | null>(null);
  const [events, setEvents] = useState<CreditEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0);
  const moreBusy = useRef(false);

  const load = useCallback(() => {
    if (!userId) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    setSnapshot(null);
    setEvents([]);
    setCursor(null);
    moreBusy.current = false;
    Promise.all([
      apiJson<CreditSnapshot>("/api/credits"),
      apiJson<CreditHistoryPage>("/api/credits/history"),
    ]).then(([nextSnapshot, page]) => {
      if (id !== requestId.current) return;
      if (nextSnapshot.userId !== userId || page.userId !== userId) {
        setError(true);
        setLoading(false);
        return;
      }
      setSnapshot(nextSnapshot);
      setEvents(page.events);
      setCursor(page.nextCursor);
      setLoading(false);
    }).catch(() => {
      if (id !== requestId.current) return;
      setError(true);
      setLoading(false);
    });
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    const client = createClient();
    void client.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user || data.user.is_anonymous) router.replace("/onboarding/");
      else setUserId(data.user.id);
    }).catch(() => { if (mounted) setError(true); });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session || session.user.is_anonymous) {
        requestId.current++;
        setSnapshot(null);
        setEvents([]);
        setUserId(null);
        router.replace("/onboarding/");
      } else if (session.user.id !== userId) {
        requestId.current++;
        setSnapshot(null);
        setEvents([]);
        setUserId(session.user.id);
      }
    });
    return () => { mounted = false; requestId.current++; subscription.unsubscribe(); };
  }, [authAttempt, router, userId]);

  useEffect(() => { load(); }, [load]);
  useRefreshOnResume(load);

  async function loadMore() {
    if (!cursor || moreBusy.current) return;
    moreBusy.current = true;
    const id = requestId.current;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await apiJson<CreditHistoryPage>(`/api/credits/history?cursor=${encodeURIComponent(cursor)}`);
      if (id !== requestId.current) return;
      setEvents((current) => {
        const seen = new Set(current.map((event) => event.id));
        return [...current, ...page.events.filter((event) => !seen.has(event.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      if (id === requestId.current) setMoreError(true);
    } finally {
      if (id === requestId.current) setLoadingMore(false);
      moreBusy.current = false;
    }
  }

  if (error) return <PageError message="크레딧을 불러오지 못했어요."
    onRetry={userId ? load : () => { setError(false); setAuthAttempt((value) => value + 1); }} />;
  if (loading || !snapshot) return <PageLoading label="크레딧을 불러오고 있어요" />;

  return (
    <main className="pb-10">
      <Link href="/account/" className="text-sm text-stone-600 underline underline-offset-4">계정으로</Link>
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-stone-900">내 크레딧</h1>
      <section aria-label="크레딧 잔액" className="mt-5 rounded-3xl bg-[#241b33] px-6 py-7 text-[#f9f6ef]">
        <p className="text-sm text-[#d8d2e0]">현재 잔액</p>
        <p className="mt-2 text-5xl font-semibold tabular-nums tracking-tight">
          {snapshot.earningMode === "inactive" ? "—" : snapshot.balance.toLocaleString("ko-KR")}
          <span className="ml-2 text-base font-medium tracking-normal">크레딧</span>
        </p>
        <p className="mt-5 text-sm text-[#e4dceb]">
          {snapshot.earningMode === "inactive" ? "크레딧 적립을 준비 중이에요." :
            snapshot.earningMode === "paused" ? "새 적립이 잠시 멈췄어요. 기존 잔액은 유지돼요." :
            "새로운 글을 처음 완료할 때 크레딧이 쌓여요."}
        </p>
        {snapshot.spendingEnabled && <p className="mt-2 text-sm text-[#e4dceb]">
          꾸미기 구매 가능: {snapshot.spendableBalance.toLocaleString("ko-KR")}크레딧
        </p>}
      </section>

      {snapshot.earningMode !== "inactive" && (
        <section className="mt-7" aria-labelledby="credit-rules-heading">
          <h2 id="credit-rules-heading" className="text-base font-semibold text-stone-900">적립 방법</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            글을 처음 완료하면 {snapshot.rules.article}크레딧, 퀴즈 정답에 따라 최대 {snapshot.rules.quizBonusMax}크레딧을 받아요.
            {!snapshot.hasWelcome && ` 첫 학습에는 ${snapshot.rules.welcome}크레딧이 더해져요.`}
          </p>
          {!snapshot.spendingEnabled && <p className="mt-2 text-xs text-stone-500">크레딧 사용처는 준비 중이에요.</p>}
        </section>
      )}

      <section className="mt-8" aria-labelledby="credit-history-heading">
        <h2 id="credit-history-heading" className="text-base font-semibold text-stone-900">적립 내역</h2>
        {events.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
            {snapshot.earningMode === "inactive" ? "적립이 시작되면 여기에 내역이 표시돼요." : "아직 크레딧 내역이 없어요. 첫 학습을 완료해 보세요."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white px-4">
            {events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-medium text-stone-900">{eventLabel[event.reason] ?? "크레딧 변경"}</p>
                  {event.articleTitle && <p className="mt-0.5 text-sm text-stone-600">{event.articleTitle}</p>}
                  <p className="mt-1 text-xs text-stone-500">{dateTime.format(new Date(event.createdAt))}</p>
                </div>
                <strong className={`shrink-0 tabular-nums text-sm ${event.amount >= 0 ? "text-emerald-800" : "text-stone-700"}`}>
                  {event.amount >= 0 ? "+" : ""}{event.amount.toLocaleString("ko-KR")}
                </strong>
              </li>
            ))}
          </ul>
        )}
        {cursor && (
          <div className="mt-4 text-center">
            <button type="button" onClick={loadMore} disabled={loadingMore}
              className="min-h-11 rounded-xl border border-stone-300 bg-white px-5 py-2 text-sm font-medium text-stone-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2">
              {loadingMore ? "불러오는 중…" : "더 보기"}
            </button>
            {moreError && <p role="alert" className="mt-2 text-sm text-red-700">내역을 불러오지 못했어요. 다시 눌러 주세요.</p>}
          </div>
        )}
      </section>
    </main>
  );
}
