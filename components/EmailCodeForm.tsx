"use client";

import { useId, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Props = {
  initialEmail?: string;
  disabled?: boolean;
  shouldCreateUser?: boolean;
  onBusyChange: (busy: boolean) => void;
  onVerified: () => void | Promise<void>;
};

const inputStyle = "min-h-12 min-w-0 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-stone-800";
const buttonStyle = "min-h-12 w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800";

/** The session is created here, even when the email is read on another device. */
export function EmailCodeForm({ initialEmail = "", disabled = false, shouldCreateUser = true, onBusyChange, onVerified }: Props) {
  const id = useId();
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  // Supabase projects can configure the code length. Keep leading zeroes.
  const validCode = /^[0-9]{6,10}$/.test(code);
  const unavailable = disabled || busy !== null;

  function begin(action: "send" | "verify") {
    locked.current = true;
    setBusy(action);
    setError(null);
    onBusyChange(true);
  }

  function finish() {
    locked.current = false;
    setBusy(null);
    onBusyChange(false);
  }

  async function sendCode() {
    if (disabled || locked.current) return;
    begin("send");
    setCode("");
    try {
      const address = email.trim();
      const { error: authError } = await createClient().auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser },
      });
      if (authError) {
        setError(authError.status === 429
          ? "메일 요청이 많아요. 잠시 기다린 뒤 다시 받아 주세요."
          : "메일을 보내지 못했어요. 주소와 연결을 확인하고 다시 시도해 주세요.");
        return;
      }
      setEmail(address);
      setSentTo(address);
    } catch {
      setError("메일을 보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      finish();
    }
  }

  async function verifyCode() {
    if (disabled || locked.current || !sentTo || !validCode) return;
    begin("verify");
    try {
      const { data, error: authError } = await createClient().auth.verifyOtp({
        email: sentTo,
        token: code,
        type: "email",
      });
      if (authError || !data.session || !data.user || data.user.is_anonymous === true) {
        setError(authError?.status === 429
          ? "확인 요청이 많아요. 잠시 기다린 뒤 다시 시도해 주세요."
          : "인증번호가 올바르지 않거나 만료됐어요. 가장 최근에 받은 번호를 확인하거나 다시 받아 주세요.");
        return;
      }
    } catch {
      setError("인증번호를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
      return;
    } finally {
      finish();
    }
    await onVerified();
  }

  return (
    <div className="mt-6" aria-busy={busy !== null}>
      {sentTo ? (
        <div className="rounded-xl bg-stone-100 p-4 text-sm text-stone-700">
          <p role="status" className="break-all">
            {shouldCreateUser ? `${sentTo}로 인증번호를 보냈어요.` : `${sentTo}로 가입한 계정이 있다면 인증번호가 도착해요.`}
          </p>
          <p id={`${id}-help`} className="mt-3 leading-6">메일의 인증번호를 이 화면에 입력해 주세요. 메일이 보이지 않으면 스팸함도 확인해 주세요.</p>
          <form className="mt-3 grid gap-3" onSubmit={(event) => { event.preventDefault(); void verifyCode(); }}>
            <label htmlFor={`${id}-code`} className="font-semibold text-stone-800">인증번호</label>
            <input id={`${id}-code`} type="text" inputMode="numeric" autoComplete="one-time-code"
              required pattern="[0-9]{6,10}" maxLength={10} value={code} disabled={unavailable}
              aria-describedby={`${id}-help`} aria-invalid={error ? true : undefined}
              onChange={(event) => { setCode(event.target.value.replace(/\s/g, "")); setError(null); }}
              className={`${inputStyle} tracking-widest`} />
            <button type="submit" disabled={unavailable || !validCode} className={buttonStyle}>
              {busy === "verify" ? "확인 중…" : shouldCreateUser ? "인증번호 확인하고 로그인" : "인증번호 확인"}
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-x-5">
            <button type="button" disabled={unavailable} onClick={() => void sendCode()} className="ac-intro-link disabled:opacity-50">
              {busy === "send" ? "전송 중…" : "인증번호 다시 받기"}
            </button>
            <button type="button" disabled={unavailable} onClick={() => { setSentTo(null); setCode(""); setError(null); }} className="ac-intro-link disabled:opacity-50">이메일 주소 수정</button>
          </div>
        </div>
      ) : (
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void sendCode(); }}>
          <label htmlFor={`${id}-email`} className="text-sm font-semibold text-stone-800">{shouldCreateUser ? "이메일로 시작하기" : "가입한 이메일"}</label>
          <input id={`${id}-email`} type="email" required inputMode="email" autoComplete="email"
            value={email} disabled={unavailable} onChange={(event) => setEmail(event.target.value)}
            placeholder="이메일 주소" aria-label="이메일 주소" className={inputStyle} />
          <button type="submit" disabled={unavailable || !email.includes("@")} className={buttonStyle}>
            {busy === "send" ? "전송 중…" : "인증번호 받기"}
          </button>
          {shouldCreateUser && <p className="text-xs leading-5 text-stone-500">비밀번호 없이 이메일 인증번호로 로그인해요. 처음이라면 계정이 만들어져요.</p>}
        </form>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </div>
  );
}
