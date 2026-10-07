"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiJson, ApiError } from "@/lib/client-api";
import { clearDeletionReturn, rememberDeletionReturn } from "@/lib/deletion-return";
import { authRedirectUrl } from "@/lib/native";
import { createClient, signOutCurrentDevice } from "@/lib/supabase/client";

type Account = { userId: string; email: string | null; canDelete: boolean };
const buttonStyle = "min-h-12 rounded-xl px-4 py-3 text-sm font-medium transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800";

export function DeleteAccountForm() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [cleanupFailed, setCleanupFailed] = useState(false);
  const locked = useRef(false);
  const finished = useRef(false);
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadFailed(false);
    setConfirmation("");
    try {
      const next = await apiJson<Account>("/api/account/delete");
      if (version !== loadVersion.current) return;
      setAccount(next);
      setEmail(next.email ?? "");
    } catch (cause) {
      if (version !== loadVersion.current) return;
      setAccount(null);
      if (!(cause instanceof ApiError && cause.status === 401)) setLoadFailed(true);
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "auth") {
      setError("본인 확인을 마치지 못했어요. 확인 링크를 다시 받아 주세요.");
    }
    void load();
    // Native deep links may return to this same mounted page. Refresh after the
    // auth callback releases its lock; never await SDK calls inside its listener.
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event) => {
      if (!["SIGNED_IN", "SIGNED_OUT"].includes(event)) return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (!finished.current && !locked.current) void load();
      }, 0);
    });
    return () => { loadVersion.current++; clearTimeout(refreshTimer); subscription.unsubscribe(); };
  }, [load]);

  async function sendLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      rememberDeletionReturn();
      const { error: authError } = await createClient().auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: authRedirectUrl() },
      });
      if (authError) throw authError;
      setSent(true);
    } catch {
      clearDeletionReturn();
      setError("확인 메일을 보내지 못했어요. 가입한 이메일인지 확인하고 잠시 후 다시 시도해 주세요.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function clearSession() {
    try {
      await signOutCurrentDevice();
      setCleanupFailed(false);
    } catch { setCleanupFailed(true); }
  }

  async function removeAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account || confirmation !== "계정 삭제" || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await apiJson<{ deleted: boolean }>("/api/account/delete", {
        method: "POST",
        body: JSON.stringify({ expectedUserId: account.userId, confirmation }),
      });
      if (result.deleted !== true) throw new Error("Deletion was not confirmed");
      ++loadVersion.current;
      finished.current = true;
      setDeleted(true);
      setAccount(null);
      setEmail("");
      setConfirmation("");
      clearDeletionReturn();
      await clearSession();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        setAccount((current) => current ? { ...current, canDelete: false } : null);
        setConfirmation("");
        setError("본인 확인 시간이 지났어요. 이메일로 다시 확인해 주세요.");
      } else if (cause instanceof ApiError && [401, 409].includes(cause.status)) {
        await load();
        setError("로그인 상태가 바뀌었어요. 아래 계정을 다시 확인해 주세요. 응답을 받지 못한 이전 요청이 있었다면 이미 삭제됐을 수도 있어요.");
      } else {
        setError("삭제 완료를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요. 응답이 끊긴 경우 이미 처리됐을 수도 있어요.");
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  if (deleted) return (
    <section className="mt-8" aria-live="polite">
      <h2 className="text-lg font-semibold text-stone-900">계정 삭제가 완료됐어요</h2>
      <p className="mt-2 text-sm text-stone-600">artice cream 계정과 연결된 학습·이용 기록을 삭제했어요.</p>
      {cleanupFailed && <div className="mt-4 text-sm text-red-800">
        <p>이 기기의 로그인 정보 정리를 마치지 못했어요. 계정 삭제는 완료됐어요.</p>
        <button type="button" className={`${buttonStyle} mt-2 border border-stone-300`} onClick={() => void clearSession()}>기기 로그인 정보 정리 다시 시도</button>
      </div>}
      <a href="/onboarding/" className="mt-5 inline-block text-sm underline underline-offset-4">시작 화면으로</a>
    </section>
  );

  return (
    <section className="mt-8" aria-labelledby="delete-confirm-heading" aria-busy={busy || loading}>
      <h2 id="delete-confirm-heading" className="text-lg font-semibold text-stone-900">삭제할 계정 확인</h2>
      {loading ? <p role="status" className="mt-3 text-sm text-stone-600">로그인 상태를 확인하고 있어요…</p> : loadFailed ? (
        <div className="mt-3">
          <p role="alert" className="text-sm text-red-800">계정 상태를 확인하지 못했어요.</p>
          <button type="button" onClick={() => void load()} className={`${buttonStyle} mt-3 border border-stone-300`}>다시 확인</button>
        </div>
      ) : <>
        {account && <p className="mt-3 break-all text-sm text-stone-700">삭제할 계정: <strong>{account.email ?? "이메일 미등록 계정"}</strong></p>}
        {account?.canDelete ? (
          <form className="mt-5" onSubmit={removeAccount}>
            <label htmlFor="delete-confirmation" className="block text-sm leading-relaxed text-stone-700">
              되돌릴 수 없는 작업이에요. 계속하려면 <strong>계정 삭제</strong>를 입력해 주세요.
            </label>
            <input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off" disabled={busy} className="mt-3 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-stone-800" />
            <button type="submit" disabled={busy || confirmation !== "계정 삭제"}
              className={`${buttonStyle} mt-4 w-full bg-red-800 text-white hover:bg-red-900`}>
              {busy ? "계정 삭제 중…" : "계정과 데이터 영구 삭제"}
            </button>
          </form>
        ) : (
          <form className="mt-4" onSubmit={sendLink}>
            <p className="text-sm leading-relaxed text-stone-600">
              가입한 이메일로 본인 확인 링크를 받아 주세요. Google로 가입했다면 해당 Google 계정의 이메일을 사용해 주세요.
            </p>
            <label htmlFor="deletion-email" className="mt-4 block text-sm font-medium text-stone-700">가입한 이메일</label>
            <input id="deletion-email" type="email" required autoComplete="email" inputMode="email" value={email}
              onChange={(event) => { setEmail(event.target.value); setSent(false); }} disabled={busy}
              className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-stone-800" />
            <button type="submit" disabled={busy || !email.trim()} className={`${buttonStyle} mt-3 w-full bg-stone-900 text-white hover:bg-stone-800`}>
              {busy ? "보내는 중…" : "본인 확인 링크 받기"}
            </button>
            {sent && <p role="status" className="mt-3 text-sm leading-relaxed text-stone-600">
              해당 이메일로 가입한 계정이 있다면 확인 링크가 도착해요. 요청한 브라우저나 앱에서 링크를 열어 주세요.
              돌아온 뒤 삭제할 계정을 확인하고 최종 버튼을 눌러야 삭제돼요.
            </p>}
          </form>
        )}
        {account && <button type="button" disabled={busy} onClick={async () => {
          if (locked.current) return;
          locked.current = true; setBusy(true); setError(null);
          try { await signOutCurrentDevice(); setSent(false); setEmail(""); await load(); }
          catch { setError("로그아웃하지 못했어요. 다시 시도해 주세요."); }
          finally { locked.current = false; setBusy(false); }
        }} className={`${buttonStyle} mt-3 w-full border border-stone-300 text-stone-700`}>다른 계정으로 확인</button>}
      </>}
      {error && <p role="alert" className="mt-4 text-sm leading-relaxed text-red-800">{error}</p>}
      <Link href="/account" className="mt-5 inline-block text-sm text-stone-600 underline underline-offset-4">취소하고 돌아가기</Link>
    </section>
  );
}
