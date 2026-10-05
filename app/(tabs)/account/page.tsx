"use client";

import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PageError, PageLoading } from "@/components/ScreenState";
import { createClient, signOutCurrentDevice } from "@/lib/supabase/client";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signingOut = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    setUser(null);

    void (async () => {
      try {
        const supabase = createClient();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (cancelled) return;
        if (sessionError) throw sessionError;
        if (!session || session.user.is_anonymous) {
          router.replace("/onboarding");
          return;
        }

        const { data, error: userError } = await supabase.auth.getUser();
        if (cancelled) return;
        if (userError) throw userError;
        if (!data.user || data.user.is_anonymous) {
          router.replace("/onboarding");
          return;
        }
        setUser(data.user);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [attempt, router]);

  async function signOut() {
    if (signingOut.current) return;
    signingOut.current = true;
    setBusy(true);
    setError(null);

    try {
      await signOutCurrentDevice();
      // 새 문서로 이동해 이전 계정의 React 상태와 라우터 캐시도 비운다.
      // 끝의 /는 Capacitor 정적 번들의 onboarding/index.html과도 맞는다.
      window.location.replace("/onboarding/");
    } catch {
      setError("로그아웃하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
      signingOut.current = false;
      setBusy(false);
    }
  }

  if (loadError) return <PageError onRetry={() => setAttempt((value) => value + 1)} />;
  if (!user) return <PageLoading label="계정을 확인하고 있어요" />;

  const providers = [...new Set(user.identities?.map((identity) => identity.provider) ?? [])];
  const providerLabel = providers
    .map((provider) => provider === "google" ? "구글" : provider === "email" ? "이메일" : provider)
    .join(", ");

  return (
    <main>
      <h1 className="text-xl font-bold tracking-tight text-stone-900">
        <span className="ac-mark">나</span>
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        읽은 글과 쌓은 스쿱이 이 계정에 저장돼요.
      </p>

      <section aria-labelledby="account-heading" className="mt-8">
        <h2 id="account-heading" className="text-sm font-semibold text-stone-900">로그인한 계정</h2>
        <dl className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
          <div className="py-4">
            <dt className="text-xs text-stone-500">이메일</dt>
            <dd className="mt-1 break-all text-base font-medium text-stone-900">
              {user.email || "등록된 이메일이 없어요"}
            </dd>
          </div>
          {providerLabel && (
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="text-sm text-stone-500">로그인 방식</dt>
              <dd className="text-sm text-stone-900">{providerLabel}</dd>
            </div>
          )}
        </dl>
      </section>

      <div className="mt-8">
        <p id="signout-description" className="text-sm leading-relaxed text-stone-600">
          다른 계정을 쓰려면 로그아웃한 뒤 다시 로그인해 주세요.
          읽기 기록과 내 콘은 그대로 보관돼요.
        </p>
        <button
          type="button"
          onClick={signOut}
          disabled={busy}
          aria-describedby="signout-description"
          className="mt-4 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
        >
          {busy ? "로그아웃 중…" : "로그아웃"}
        </button>
        <p className="mt-2 text-xs text-stone-500">이 기기에서만 로그아웃돼요.</p>
        {busy && <p role="status" className="sr-only">로그아웃 중이에요.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      </div>
    </main>
  );
}
