"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EmailCodeForm } from "@/components/EmailCodeForm";
import { OnboardingQuiz } from "@/components/OnboardingQuiz";
import { WelcomeTutorial } from "@/components/WelcomeTutorial";
import { coreColor } from "@/lib/color";
import { apiJson } from "@/lib/client-api";
import { levelLabel, levelShort } from "@/lib/level";
import { authRedirectUrl, openExternal } from "@/lib/native";
import type { PublicQuizQuestion } from "@/lib/onboarding-quiz";
import { createClient } from "@/lib/supabase/client";
import type { DomainRow } from "@/lib/supabase/types";

type Props = {
  domains: DomainRow[];
  initialLevels: Record<string, number>;
  /** 분야 id → 레벨 퀴즈 문항(정답 없음). 없는 분야는 퀴즈 없이 Lv2로 시작한다. */
  quizzes: Record<string, PublicQuizQuestion[]>;
  isSignedIn: boolean;
  /** 딥링크·웹 콜백에서 로그인이 실패해 돌아온 경우. */
  authFailed?: boolean;
  startAtLogin?: boolean;
  onSignedIn?: () => void;
};

type Selection = { domainId: number; answers: (number | null)[]; retake?: true } | { domainId: number; skipped: true };
type Result = { domainId: number; correct: number | null; level: number };
type Phase = "pick" | "quiz" | "save" | "result";

export function OnboardingFlow({
  domains,
  initialLevels,
  quizzes,
  isSignedIn,
  authFailed = false,
  startAtLogin = false,
  onSignedIn,
}: Props) {
  const router = useRouter();
  // 이미 레벨이 있는 분야는 구독이 잠겨 있다. 고르는 건 새 분야이고, 이미 있는 분야는
  // "다시 풀기"를 누른 경우에만 퀴즈를 다시 풀어 레벨을 새로 정한다.
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const [retakes, setRetakes] = useState<Set<number>>(() => new Set());
  const [phase, setPhase] = useState<Phase>("pick");
  const [queue, setQueue] = useState<DomainRow[]>([]);
  const [position, setPosition] = useState(0);
  const [given, setGiven] = useState<Record<number, (number | null)[]>>({});
  const [pending, setPending] = useState<Selection[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hasExisting = Object.keys(initialLevels).length > 0;
  const isExisting = (id: number) => initialLevels[String(id)] !== undefined;
  const targets = domains.filter((d) => isExisting(d.id) ? retakes.has(d.id) : picked.has(d.id));

  function selectionsFor(answers: Record<number, (number | null)[]>): Selection[] {
    return targets.flatMap((d): Selection[] => {
      if (answers[d.id]) return [{ domainId: d.id, answers: answers[d.id], ...(isExisting(d.id) ? { retake: true as const } : {}) }];
      // 다시 풀기를 건너뛰면 지금 레벨을 그대로 둔다 — 보내지 않는다.
      return isExisting(d.id) ? [] : [{ domainId: d.id, skipped: true }];
    });
  }

  async function save(selections: Selection[]) {
    setPending(selections);
    setPhase("save");
    setError(null);
    try {
      const data = await apiJson<{ results?: Result[] }>("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({ selections }),
      });
      if (!data.results || data.results.length === 0) {
        router.push("/");
        return;
      }
      setResults(data.results);
      setPhase("result");
    } catch {
      setError("저장하지 못했어요. 다시 시도해 주세요.");
    }
  }

  function start() {
    const withQuiz = targets.filter((d) => quizzes[String(d.id)]?.length);
    setGiven({});
    if (withQuiz.length === 0) {
      void save(selectionsFor({}));
      return;
    }
    setQueue(withQuiz);
    setPosition(0);
    setPhase("quiz");
  }

  function finishDomain(answers: (number | null)[] | null) {
    const domain = queue[position];
    const all = answers ? { ...given, [domain.id]: answers } : given;
    setGiven(all);
    if (position + 1 < queue.length) setPosition(position + 1);
    else void save(selectionsFor(all));
  }

  if (!isSignedIn) return (
    <WelcomeTutorial startAtLogin={authFailed || startAtLogin}>
      <SignIn authFailed={authFailed} onSignedIn={onSignedIn ?? (() => router.replace("/"))} />
    </WelcomeTutorial>
  );

  if (phase === "quiz") {
    const domain = queue[position];
    return (
      <OnboardingQuiz key={domain.id} domain={domain} questions={quizzes[String(domain.id)]}
        position={{ index: position, total: queue.length }}
        onDone={finishDomain} onSkip={() => finishDomain(null)} />
    );
  }

  if (phase === "save") {
    return (
      <main>
        {error ? (
          <>
            <p role="alert" className="text-sm text-red-700">{error}</p>
            <button type="button" onClick={() => void save(pending)}
              className="mt-4 w-full rounded-xl bg-stone-900 px-4 py-3 font-medium text-white transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">
              다시 시도
            </button>
          </>
        ) : (
          <p role="status" className="text-sm text-stone-600">저장 중…</p>
        )}
      </main>
    );
  }

  if (phase === "result") {
    return (
      <main>
        <h1 className="text-xl font-bold tracking-tight text-stone-900">시작 난이도를 정했어요</h1>
        <p className="mt-2 text-sm text-stone-600">읽고 퀴즈를 풀면 그때부터 알아서 맞춰져요.</p>
        <ul className="mt-6 space-y-3">
          {results.map((result) => {
            const domain = domains.find((d) => d.id === result.domainId);
            if (!domain) return null;
            return (
              <li key={result.domainId} className="flex items-center gap-3 rounded-2xl border border-stone-300 bg-white p-4">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: coreColor(domain.slug) }} aria-hidden="true" />
                <span className="font-medium text-stone-900">{domain.name_ko}</span>
                <span className="ml-auto text-right text-sm text-stone-600">
                  {result.correct === null ? "건너뜀" : `8문제 중 ${result.correct}개`}
                  {" · "}{levelShort(result.level)} {levelLabel(result.level)}
                </span>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => router.push("/")}
          className="mt-6 w-full rounded-xl bg-stone-900 px-4 py-3 font-medium text-white transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">
          시작하기
        </button>
      </main>
    );
  }

  const canContinue = picked.size > 0 || hasExisting;
  return (
    <main>
      <h1 className="text-xl font-bold tracking-tight text-stone-900">
        어떤 뉴스를 읽을까요?
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        받아볼 분야를 고르세요. 고른 분야마다 8문제를 풀면 맞힌 개수로 시작 난이도를
        정해요. 건너뛰어도 되고, 그때는 중간 난이도에서 시작해요.
      </p>
      {hasExisting && (
        <p className="mt-2 text-sm text-stone-600">
          이미 고른 분야도 &lsquo;다시 풀기&rsquo;를 누르면 퀴즈를 다시 풀어 난이도를 새로 정해요.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {domains.map((domain) => {
          const existing = initialLevels[String(domain.id)];
          const on = existing !== undefined || picked.has(domain.id);
          return (
            <li
              key={domain.id}
              className={`rounded-2xl border p-4 transition ${
                on ? "border-stone-300 bg-white" : "border-stone-200 bg-stone-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <label className="flex flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={existing !== undefined}
                    onChange={(event) => {
                      const next = new Set(picked);
                      if (event.target.checked) next.add(domain.id);
                      else next.delete(domain.id);
                      setPicked(next);
                    }}
                    className="h-4 w-4 accent-stone-900"
                  />
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: coreColor(domain.slug) }}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-stone-900">{domain.name_ko}</span>
                  {existing !== undefined && (
                    <span className="ml-auto text-sm text-stone-600">
                      {levelShort(existing)} {levelLabel(existing)}
                    </span>
                  )}
                </label>
                {existing !== undefined && quizzes[String(domain.id)]?.length ? (
                  <button
                    type="button"
                    aria-pressed={retakes.has(domain.id)}
                    aria-label={`${domain.name_ko} 퀴즈 다시 풀기`}
                    onClick={() => {
                      const next = new Set(retakes);
                      if (next.has(domain.id)) next.delete(domain.id);
                      else next.add(domain.id);
                      setRetakes(next);
                    }}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800 ${
                      retakes.has(domain.id) ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    다시 풀기
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={start}
        disabled={!canContinue}
        className="mt-6 w-full rounded-xl bg-stone-900 px-4 py-3 font-medium text-white transition hover:bg-stone-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
      >
        {canContinue ? "다음" : "한 개 이상 골라 주세요"}
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
