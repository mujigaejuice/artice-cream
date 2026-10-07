"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

import { TermCheck } from "@/components/TermCheck";
import { coreColor } from "@/lib/color";
import { authRedirectUrl, openExternal } from "@/lib/native";
import { createClient } from "@/lib/supabase/client";
import type { DomainRow } from "@/lib/supabase/types";
import { levelFromTermCheck, type DomainTerms } from "@/lib/terms";

type Props = {
  domains: DomainRow[];
  initialLevels: Record<string, number>;
  /** 정책.md §15 — 분야별 용어 체크 목록. 비어 있으면 그 분야는 체크를 건너뛴다. */
  domainTerms: Record<string, DomainTerms>;
  isSignedIn: boolean;
  /** 딥링크·웹 콜백에서 로그인이 실패해 돌아온 경우. */
  authFailed?: boolean;
};

export function OnboardingFlow({
  domains,
  initialLevels,
  domainTerms,
  isSignedIn,
  authFailed = false,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

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

  function levelFor(domainId: number): number {
    if (initialLevels[String(domainId)] != null) return initialLevels[String(domainId)];
    return levelFromTermCheck(checkedRare[domainId]?.size ?? 0);
  }

  async function saveAndContinue() {
    setBusy(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("세션이 없어요. 새로고침 해 주세요.");
      setBusy(false);
      return;
    }

    const rows = [...selected].map((domainId) => ({
      user_id: user.id,
      domain_id: domainId,
      level: levelFor(domainId),
      recent_scores: [],
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("user_domain_levels")
      .upsert(rows, { onConflict: "user_id,domain_id" });

    if (error) {
      setError("저장하지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
      return;
    }

    router.push("/");
  }

  if (!isSignedIn) return <SignIn authFailed={authFailed} />;

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
function SignIn({ authFailed }: { authFailed?: boolean }) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  // 구글에 다녀왔는데 실패한 채로 돌아온 경우. 아무 말도 없으면 사용자는 화면만
  // 바뀐 것으로 본다.
  const [error, setError] = useState<string | null>(
    authFailed ? "로그인하지 못했어요. 다시 시도해 주세요." : null,
  );
  const [busy, setBusy] = useState(false);

  // 게스트 모드를 없애기 전에 만든 익명 세션이 남아 있을 수 있다. 서버는 이미
  // 로그인 안 한 것으로 보지만(lib/api.ts `signedInUser`), 두면 토큰이 계속
  // 갱신되고 API 요청마다 실려 간다. 이 화면에 온 김에 버린다.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user.is_anonymous) void supabase.auth.signOut({ scope: "local" });
    });
  }, [supabase]);

  async function withGoogle() {
    setBusy(true);
    setError(null);

    // 주소는 lib/native.ts가 정한다 — 앱이면 딥링크, 웹이면 같은 오리진.
    // skipBrowserRedirect가 없으면 supabase-js가 WebView 자체를 구글로 보내서
    // 앱 셸을 잃는다. 웹에서는 openExternal이 같은 탭을 옮기므로 동작이 같다.
    // prompt=select_account가 없으면 구글이 브라우저에 로그인된 계정을 말없이
    // 고른다. 기록이 계정에 쌓이므로 어느 계정으로 들어갈지 사용자가 보고 골라야 한다.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authRedirectUrl(),
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error || !data?.url) {
      setError("구글 로그인에 실패했어요.");
      setBusy(false);
      return;
    }

    // 브라우저가 없는 기기에서는 Browser.open이 거부한다. 잡지 않으면 busy가
    // true로 남아 폼 전체가 잠긴다.
    try {
      await openExternal(data.url);
    } catch {
      setError("브라우저를 열지 못했어요.");
      setBusy(false);
      return;
    }

    // 네이티브에서는 시스템 브라우저가 위에 뜰 뿐 이 화면이 그대로 살아 있다.
    // 로그인을 마치지 않고 돌아왔을 때 버튼이 잠긴 채로 남으면 다시 시도할 수도,
    // 매직링크로 넘어갈 수도 없다. 웹은 여기서 이미 페이지를 떠난 뒤다.
    setBusy(false);
  }

  async function withEmail() {
    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authRedirectUrl() },
    });

    if (error) setError("메일을 보내지 못했어요.");
    else setSent(true);
    setBusy(false);
  }

  return (
    <main>
      <h1 className="text-xl font-bold tracking-tight text-stone-900">
        로그인하고 시작해요
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        읽은 글과 콘이 계정에 저장돼서, 다른 기기에서도 이어서 읽을 수 있어요.
      </p>

      <button
        type="button"
        onClick={withGoogle}
        disabled={busy}
        className="mt-6 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 font-medium text-stone-900 transition hover:bg-stone-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
      >
        구글로 계속하기
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-stone-400">
        <span className="h-px flex-1 bg-stone-200" />또는
        <span className="h-px flex-1 bg-stone-200" />
      </div>

      {sent ? (
        <p className="rounded-xl bg-stone-100 p-4 text-center text-sm text-stone-700">
          {email}로 로그인 링크를 보냈어요.
        </p>
      ) : (
        <div className="flex gap-2">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="이메일 주소"
            aria-label="이메일 주소"
            className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-stone-800"
          />
          <button
            type="button"
            onClick={withEmail}
            disabled={busy || !email.includes("@")}
            className="rounded-xl bg-stone-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
          링크 받기
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <Link href="/account/delete/" className="mt-6 inline-block text-sm text-stone-500 underline underline-offset-4">계정 및 데이터 삭제 안내</Link>
    </main>
  );
}
