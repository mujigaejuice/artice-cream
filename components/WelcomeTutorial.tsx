"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

import { ScoopCone } from "@/components/ScoopCone";
import type { Scoop } from "@/lib/feed";

const steps = ["내 수준으로 읽기", "용어와 퀴즈", "내 콘에 쌓기", "로그인"];
// 직접 작성한 설명용 예시. 기사 API와 학습·저장 요청을 사용하지 않는다.
const examples: Scoop[] = [
  { id: 1, variantId: 0, articleId: 0, domain: "cloud", domainLabel: "클라우드", date: "2026-10-01", title: "클라우드는 어디에 있을까요?", summaryFirstLine: null, score: 100 },
  { id: 2, variantId: 0, articleId: 0, domain: "llm", domainLabel: "LLM", date: "2026-10-02", title: "AI가 문장을 이어 쓰는 방법", summaryFirstLine: null, score: 100 },
  { id: 3, variantId: 0, articleId: 0, domain: "infra", domainLabel: "인프라", date: "2026-10-03", title: "자주 쓰는 정보를 가까이에", summaryFirstLine: null, score: 100 },
];

export function WelcomeTutorial({ children, startAtLogin = false }: { children: ReactNode; startAtLogin?: boolean }) {
  const [step, setStep] = useState(startAtLogin ? 3 : 0);
  const [termOpen, setTermOpen] = useState(false);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<Scoop | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  function go(next: number) {
    setStep(Math.max(0, Math.min(3, next)));
    // 패널 밖의 제목은 유지하므로 버튼·스와이프 이동 뒤 포커스가 사라지지 않는다.
    heading.current?.focus({ preventScroll: true });
  }

  return (
    <main className="ac-welcome">
      <header className="flex min-h-12 items-center justify-between gap-4">
        <span className="text-lg font-extrabold tracking-tight">artice cream</span>
        {step < 3 ? (
          <button type="button" onClick={() => go(3)} className="ac-intro-link">바로 로그인</button>
        ) : (
          <button type="button" onClick={() => go(0)} className="ac-intro-link">사용법 보기</button>
        )}
      </header>

      <section
        aria-label="서비스 소개" aria-roledescription="슬라이드" tabIndex={0}
        className="mt-5 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-700"
        style={{ touchAction: "pan-y" }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget && event.target !== heading.current) return;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            go(step + (event.key === "ArrowRight" ? 1 : -1));
          }
        }}
        onTouchStart={(event) => {
          const target = event.target as Element;
          if (event.touches.length !== 1 || target.closest("button, input, label, a, [role=button]")) {
            touch.current = null;
            return;
          }
          touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }}
        onTouchCancel={() => { touch.current = null; }}
        onTouchEnd={(event) => {
          const start = touch.current;
          touch.current = null;
          if (!start || !event.changedTouches.length) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(step + (dx < 0 ? 1 : -1));
        }}
      >
        <p className="text-sm font-medium text-stone-600" aria-live="polite" aria-atomic="true">{step + 1} / 4 · {steps[step]}</p>
        <h1 ref={heading} tabIndex={-1} className="mt-3 text-[2rem] font-extrabold leading-tight tracking-tight focus:outline-none">
          {step === 0 ? <>어려운 기술 이야기,<br />내 속도로 한 스쿱.</> : step === 1 ? <>모르는 말은 펼치고,<br />이해한 만큼 확인해요.</> : step === 2 ? <>읽고 배운 이야기가<br />나만의 콘이 돼요.</> : <>이제, 나의 첫 스쿱을<br />시작해 볼까요?</>}
        </h1>
        <p className="mt-4 text-sm leading-7 text-stone-600">
          {step === 0 ? "관심 있는 개발·AI 분야를 고르면 내 읽기 수준에 맞춘 글을 만날 수 있어요." : step === 1 ? "밑줄 친 용어를 눌러 뜻을 보고, 짧은 퀴즈로 읽은 내용을 돌아봐요." : step === 2 ? "퀴즈를 마친 글을 저장하면 스쿱이 쌓여요. 콘에서 읽은 글을 다시 꺼내 볼 수 있어요." : "읽은 글과 콘을 계정에 보관해요. 같은 글은 중복으로 쌓이지 않고, 다른 기기에서도 이어 볼 수 있어요."}
        </p>

        {step === 0 && (
          <figure className="ac-intro-example">
            <figcaption className="ac-intro-caption">이렇게 읽어요 · 설명용 예시</figcaption>
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-600"><span className="h-3 w-3 rounded-full bg-[#a6ddc0]" />인프라</div>
            <h2 className="mt-4 text-xl font-bold leading-snug">자주 쓰는 정보를<br />가까이에 두는 방법</h2>
            <p className="mt-4 text-sm leading-7 text-stone-600">매번 멀리 있는 책장에서 책을 꺼내는 대신, 자주 보는 책은 책상 위에 두면 편하겠죠. 컴퓨터도 비슷한 방법을 써요.</p>
            <div className="mt-6 border-t border-stone-200 pt-4 text-sm text-stone-600">관심 분야 선택 → 내 수준에 맞춰 읽기</div>
          </figure>
        )}
        {step === 1 && (
          <div className="ac-intro-example">
            <p className="ac-intro-caption">직접 눌러 보세요 · 설명용 예시</p>
            <p className="text-base leading-8">자주 쓰는 정보를 가까이 보관하는 것을 <button type="button" onClick={() => setTermOpen(!termOpen)} aria-expanded={termOpen} aria-controls="intro-term" className="ac-mark px-1 font-bold focus-visible:outline-2">캐시</button>라고 해요.</p>
            {termOpen && <p id="intro-term" className="mt-3 rounded-lg bg-[#fff8e6] p-3 text-sm leading-6 text-stone-700">캐시: 자주 쓰는 정보를 잠시 저장해 더 빠르게 꺼내 쓰는 공간이에요.</p>}
            <fieldset className="mt-6 border-t border-stone-200 pt-5">
              <legend className="sr-only">예시 퀴즈</legend>
              <p className="text-sm font-semibold">캐시를 쓰면 어떤 점이 좋을까요?</p>
              <div className="mt-3 grid gap-2">
                <button type="button" aria-pressed={answer === true} onClick={() => setAnswer(true)} className="ac-intro-answer">자주 쓰는 정보를 빠르게 꺼내요</button>
                <button type="button" aria-pressed={answer === false} onClick={() => setAnswer(false)} className="ac-intro-answer">모든 정보를 영구히 보관해요</button>
              </div>
              <p role="status" className="mt-3 min-h-6 text-sm text-stone-700">{answer === null ? "예시 퀴즈는 기록에 남지 않아요." : answer ? "맞아요! 필요한 정보를 더 빠르게 꺼낼 수 있어요." : "캐시는 임시 저장 공간이에요. 다시 골라 볼까요?"}</p>
            </fieldset>
          </div>
        )}
        {step === 2 && (
          <figure className="ac-intro-example !pb-4">
            <figcaption className="ac-intro-caption">스쿱을 눌러 보세요 · 설명용 예시</figcaption>
            <div className="mx-auto h-64 w-full max-w-64"><ScoopCone scoops={examples} selectedId={selected?.id} onSelect={setSelected} /></div>
            <p role="status" className="mt-3 min-h-12 text-center text-sm leading-6 text-stone-700">{selected ? selected.title : "스쿱 하나에, 내가 읽은 이야기 하나."}</p>
          </figure>
        )}
        {/* 소개로 돌아갔다 와도 입력한 이메일·발송 상태를 보존한다. */}
        <div hidden={step !== 3} inert={step !== 3}>{children}</div>
      </section>

      <nav aria-label="소개 단계" className="mt-6 flex items-center justify-between gap-2">
        <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="ac-intro-link disabled:invisible">이전</button>
        <div className="flex items-center">
          {steps.map((label, index) => <button key={label} type="button" onClick={() => go(index)} aria-label={`${index + 1}단계: ${label}`} aria-current={step === index ? "step" : undefined} className="flex h-11 w-9 items-center justify-center rounded-lg focus-visible:outline-2"><span className={`h-2 rounded-full ${step === index ? "w-5 bg-[#241b33]" : "w-2 bg-stone-300"}`} /></button>)}
        </div>
        <button type="button" onClick={() => go(step + 1)} disabled={step === 3} className="ac-intro-link disabled:invisible">다음</button>
      </nav>
      <footer className="mt-5 border-t border-stone-200 pt-4">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-600">
          <Link href="/privacy/" className="ac-intro-link">개인정보처리방침</Link>
          <Link href="/account/delete/" className="ac-intro-link">계정 및 데이터 삭제</Link>
        </div>
      </footer>
    </main>
  );
}
