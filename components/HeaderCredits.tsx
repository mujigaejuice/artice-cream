"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { CreditSummary } from "@/components/CreditSummary";
import { CREDITS_CHANGED_EVENT } from "@/lib/cosmetics";
import { createClient } from "@/lib/supabase/client";

/**
 * 노트북 상단 바의 크레딧 잔액. 로그인한 사용자에게만 보인다.
 * 화면을 옮기거나 다른 화면이 크레딧을 바꿨다고 알리면 다시 읽어서 낡은 잔액이 남지 않게 한다.
 */
export function HeaderCredits() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    try {
      const supabase = createClient();
      const pick = (user: { id: string; is_anonymous?: boolean } | null | undefined) =>
        user && user.is_anonymous !== true ? user.id : null;
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!disposed) setUserId(pick(session?.user));
      }, () => {});
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!disposed) setUserId(pick(session?.user));
      });
      unsubscribe = () => subscription.unsubscribe();
    } catch { /* A missing auth configuration only hides the balance. */ }
    return () => { disposed = true; unsubscribe?.(); };
  }, []);

  useEffect(() => {
    const changed = () => setRevision(value => value + 1);
    window.addEventListener(CREDITS_CHANGED_EVENT, changed);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, changed);
  }, []);

  if (!userId) return null;
  return <CreditSummary key={`${pathname}:${revision}`} userId={userId} compact />;
}
