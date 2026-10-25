"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiJson } from "@/lib/client-api";
import type { CreditSnapshot } from "@/lib/credits";
import { createClient } from "@/lib/supabase/client";
import { useRefreshOnResume } from "@/lib/use-refresh-on-resume";

/** A small, independently refreshed account balance. Never substitutes zero for a failed read. */
export function CreditSummary({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const [snapshot, setSnapshot] = useState<CreditSnapshot | null>(null);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(() => {
    const id = ++requestId.current;
    setError(false);
    setSnapshot(null);
    apiJson<CreditSnapshot>("/api/credits")
      .then((next) => {
        if (id !== requestId.current) return;
        if (next.userId !== userId) { setError(true); return; }
        setSnapshot(next);
      })
      .catch(() => { if (id === requestId.current) setError(true); });
  }, [userId]);

  useEffect(() => {
    load();
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) {
        requestId.current++;
        setSnapshot(null);
        setError(false);
      }
    });
    return () => { requestId.current++; subscription.unsubscribe(); };
  }, [load, userId]);
  useRefreshOnResume(load);

  const frame = compact
    ? "text-right text-xs text-stone-600"
    : "rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5";

  return (
    <section aria-label="크레딧" className={frame}>
      {error ? (
        <button type="button" onClick={load} className="text-emerald-900 underline underline-offset-4 focus-visible:outline-2">
          크레딧을 불러오지 못했어요 · 재시도
        </button>
      ) : !snapshot ? (
        <span role="status" className="text-stone-500">크레딧 불러오는 중…</span>
      ) : snapshot.earningMode === "inactive" ? (
        <span className="text-stone-600">크레딧 적립 준비 중</span>
      ) : (
        <>
          <Link href="/credits/" className="inline-flex items-baseline gap-1 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-900">
            <span className={compact ? "font-semibold text-emerald-900" : "text-sm font-medium text-emerald-900"}>크레딧</span>
            <strong className={compact ? "tabular-nums text-base text-emerald-950" : "tabular-nums text-3xl text-emerald-950"}>
              {snapshot.balance.toLocaleString("ko-KR")}
            </strong>
          </Link>
          {!compact && (
            <>
              <p className="mt-2 text-sm text-emerald-950/80">
                {snapshot.earningMode === "paused" ? "새 적립이 잠시 멈췄어요. 기존 크레딧은 유지돼요." :
                  snapshot.hasWelcome ? "학습을 이어가며 크레딧을 모아 보세요." :
                  `첫 학습을 완료하면 ${snapshot.rules.welcome}크레딧을 더 받아요.`}
              </p>
              <Link href="/credits/" className="mt-3 inline-block text-sm font-medium text-emerald-900 underline underline-offset-4 focus-visible:outline-2">적립 내역 보기</Link>
            </>
          )}
        </>
      )}
    </section>
  );
}
