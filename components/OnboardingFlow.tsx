"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EmailCodeForm } from "@/components/EmailCodeForm";
import { TermCheck } from "@/components/TermCheck";
import { WelcomeTutorial } from "@/components/WelcomeTutorial";
import { coreColor } from "@/lib/color";
import { apiJson } from "@/lib/client-api";
import { authRedirectUrl, openExternal } from "@/lib/native";
import { createClient } from "@/lib/supabase/client";
import type { DomainRow } from "@/lib/supabase/types";
import type { DomainTerms } from "@/lib/terms";

type Props = {
  domains: DomainRow[];
  initialLevels: Record<string, number>;
  /** 정책.md §15 — 분야별 용어 체크 목록. 비어 있으면 그 분야는 체크를 건너뛴다. */
  domainTerms: Record<string, DomainTerms>;
  isSignedIn: boolean;
  /** 딥링크·웹 콜백에서 로그인이 실패해 돌아온 경우. */
  authFailed?: boolean;
  startAtLogin?: boolean;
  onSignedIn?: () => void;
};

export function OnboardingFlow({
  domains,
  initialLevels,
  domainTerms,
  isSignedIn,
  authFailed = false,
  startAtLogin = false,
  onSignedIn,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(
    () =>
      new Set(
        Object.keys(initialLevels).length > 0
          ? Object.keys(initialLevels).map(Number)
          : domains.map((d) => d.id),
      ),
  );
  // 용어 체크 결과. 아무것도 고르지 않으면 Lv2에서 시작한다(정책.md §15).
  const [checkedEasy, setCheckedEasy] = useState<Record<number, Set<string>>>({});
  const [checkedRare, setCheckedRare] = useState<Record<number, Set<string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTerm(domainId: number, term: string, tier: "easy" | "rare") {
    const setState = tier === "easy" ? setCheckedEasy : setCheckedRare;
    setState((prev) => {
      const next = new Set(prev[domainId] ?? []);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      return { ...prev, [domainId]: next };
    });
  }

  async function saveAndContinue() {
    setBusy(true);
    setError(null);

    try {
      await apiJson("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({ selections: [...selected].map((domainId) => ({
          domainId, rareChecked: checkedRare[domainId]?.size ?? 0,
        })) }),
      });
      router.push("/");
    } catch {
      setError("저장하지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  if (!isSignedIn) return (
    <WelcomeTutorial startAtLogin={authFailed || startAtLogin}>
      <SignIn authFailed={authFailed} onSignedIn={onSignedIn ?? (() => router.replace("/"))} />
    </WelcomeTutorial>
  );

  return (
    <main>
      <h1 className="text-xl font-bold tracking-tight text-stone-900">
        어떤 뉴스를 읽을까요?
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        관심 분야를 고르고, 아는 용어를 체크해 주세요. 시작 난이도만 가늠하는
        것이라 안 골라도 되고, 퀴즈를 풀면 그때부터 알아서 맞춰져요.
      </p>

      <ul className="mt-6 space-y-3">
        {domains.map((domain) => {
          const on = selected.has(domain.id);
          return (
            <li
              key={domain.id}
              className={`rounded-2xl border p-4 transition ${
                on ? "border-stone-300 bg-white" : "border-stone-200 bg-stone-50"
              }`}
            >
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(event) => {
                    const next = new Set(selected);
                    if (event.target.checked) next.add(domain.id);
                    else next.delete(domain.id);
                    setSelected(next);
                  }}
                  className="h-4 w-4 accent-stone-900"
                />
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: coreColor(domain.slug) }}
                  aria-hidden="true"
                />
                <span className="font-medium text-stone-900">{domain.name_ko}</span>
              </label>

              {on && domainTerms[String(domain.id)] && (
                <div className="mt-3 pl-7">
                  <TermCheck
                    terms={domainTerms[String(domain.id)]}
                    checkedEasy={checkedEasy[domain.id] ?? new Set()}
                    checkedRare={checkedRare[domain.id] ?? new Set()}
                    onToggle={(term, tier) => toggleTerm(domain.id, term, tier)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={saveAndContinue}
        disabled={busy || selected.size === 0}
        className="mt-6 w-full rounded-xl bg-stone-900 px-4 py-3 font-medium text-white transition hover:bg-stone-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
      >
        {busy ? "저장 중…" : selected.size === 0 ? "한 개 이상 골라 주세요" : "시작하기"}
      </button>
    </main>
  );
}

/**
 * 로그인을 먼저 받는다. 게스트로 읽게 했다가 나중에 계정을 붙이던 방식은
 * 접었다 — 이미 있는 계정으로 돌아온 사람은 붙이기가 거부돼 자기 계정에 들어갈
 * 수 없었고, 게스트 기록을 기존 계정과 합치는 방법도 없었다.
 */
function SignIn({ authFailed, onSignedIn }: { authFailed?: boolean; onSignedIn: () => void }) {
  const supabase = createClient();
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  // 구글에 다녀왔는데 실패한 채로 돌아온 경우. 아무 말도 없으면 사용자는 화면만
  // 바뀐 것으로 본다.
  const [error, setError] = useState<string | null>(
    authFailed ? "로그인하지 못했어요. 다시 시도해 주세요." : null,
  );
  const [busy, setBusy] = useState(false);
  const signingIn = useRef(false);

  // 게스트 모드를 없애기 전에 만든 익명 세션이 남아 있을 수 있다. 서버는 이미
  // 로그인 안 한 것으로 보지만(lib/api.ts `signedInUser`), 두면 토큰이 계속
  // 갱신되고 API 요청마다 실려 간다. 이 화면에 온 김에 버린다.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user.is_anonymous) void supabase.auth.signOut({ scope: "local" });
    });
  }, [supabase]);

  async function withGoogle() {
    if (!ageConfirmed || signingIn.current) return;
    signingIn.current = true;
    setBusy(true);
    setError(null);

    try {
      // 앱은 WebView를 유지한 채 시스템 브라우저를 열고 딥링크로 돌아온다.
      // 계정별 기록을 구분할 수 있도록 Google 계정 선택을 항상 표시한다.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: authRedirectUrl(),
          skipBrowserRedirect: true,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error || !data?.url) {
        setError("구글 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      try {
        await openExternal(data.url);
      } catch {
        setError("브라우저를 열지 못했어요.");
      }
    } catch {
      setError("구글 로그인에 실패했어요. 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      // 앱에서 브라우저를 닫고 돌아오거나 예외가 나도 다시 시도할 수 있어야 한다.
      signingIn.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-label="로그인">
      <label className="mt-6 flex items-center gap-3 rounded-xl border border-stone-200 p-4 text-sm text-stone-800">
        <input type="checkbox" checked={ageConfirmed} disabled={busy}
          onChange={(event) => setAgeConfirmed(event.target.checked)}
          className="h-5 w-5 accent-stone-900" />
        만 14세 이상입니다
      </label>
      <p className="mt-2 text-xs leading-relaxed text-stone-500">회원 가입은 만 14세 이상부터 가능해요. 생년월일은 수집하지 않아요.</p>

      <EmailCodeForm disabled={busy || !ageConfirmed} onVerified={onSignedIn}
        onBusyChange={(next) => { signingIn.current = next; setBusy(next); if (next) setError(null); }} />

      <div className="my-5 flex items-center gap-3 text-xs text-stone-500">
        <span className="h-px flex-1 bg-stone-200" />또는
        <span className="h-px flex-1 bg-stone-200" />
      </div>
      <button type="button" onClick={withGoogle} disabled={busy || !ageConfirmed}
        className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-medium text-stone-900 transition hover:bg-stone-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">
        구글로 계속하기
      </button>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
