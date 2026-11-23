"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";

const ReadingProgressContext = createContext<(needsQuiz: boolean) => void>(() => {});
const LeaveGuardContext = createContext<() => () => void>(() => () => {});

/** 리더·퀴즈·결과 화면. 이 안에서 오가는 건 나가는 게 아니다. */
const READING_PATH = /^\/read(?:\/quiz)?\/?$/;
/** 뒤로 가기를 한 번 받아 낼 히스토리 항목 표시. Next가 자기 상태를 덧붙여 저장한다. */
const SENTINEL = "__acReadGuard";

/** Only UI guidance; never changes progress, quota or the server's save rules. */
export function useReadingProgress(needsQuiz: boolean) {
  const report = useContext(ReadingProgressContext);
  useEffect(() => { report(needsQuiz); }, [report, needsQuiz]);
}

/** 콘에 올리기 전인 화면이 켠다. 켜져 있으면 읽기 화면 밖으로 나갈 때 한 번 묻는다. */
export function useLeaveGuard(active: boolean) {
  const register = useContext(LeaveGuardContext);
  useEffect(() => (active ? register() : undefined), [register, active]);
}

type PendingLeave = { kind: "link"; href: string } | { kind: "back" };

/** Lives across route changes so the notice survives both Home and browser Back. */
export function ReadingExitNotice({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const needsQuiz = useRef(false);
  const [visible, setVisible] = useState(false);
  const report = useCallback((value: boolean) => { needsQuiz.current = value; }, []);

  const [guards, setGuards] = useState(0);
  const guarded = guards > 0;
  const [pending, setPending] = useState<PendingLeave | null>(null);
  /** 이번 읽기에서 뒤로 가기용 항목을 이미 넣었는지. 리더→퀴즈로 넘어가도 하나만 둔다. */
  const armed = useRef(false);
  /** 뒤로 가기용 항목을 넣은 주소. 그 아래 항목으로 내려왔을 때만 나가려는 것으로 본다. */
  const guardHref = useRef<string | null>(null);
  /** 사용자가 나가기로 한 뒤의 이동은 다시 막지 않는다. */
  const leaving = useRef(false);
  const register = useCallback(() => {
    setGuards(n => n + 1);
    return () => setGuards(n => n - 1);
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const reading = READING_PATH.test(pathname);
    if (reading) {
      setVisible(false);
      return;
    }
    armed.current = false;
    guardHref.current = null;
    leaving.current = false;
    setPending(null);
    setVisible(pathname === "/" && needsQuiz.current);
    needsQuiz.current = false;
  }, [pathname]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(timer);
  }, [visible]);

  // 뒤로 가기(브라우저·안드로이드 하드웨어 버튼 모두 history.back)를 받을 항목을 하나 쌓는다.
  useEffect(() => {
    if (!guarded || armed.current) return;
    armed.current = true;
    guardHref.current = window.location.href;
    if (!window.history.state?.[SENTINEL]) window.history.pushState({ [SENTINEL]: true }, "", window.location.href);
  }, [guarded]);

  useEffect(() => {
    if (!guarded) return;
    function onPopState(event: PopStateEvent) {
      // 앞으로 가기나 퀴즈→리더 같은 이동은 주소가 바뀐다. 같은 주소로 내려온 것만 묻는다.
      if (leaving.current || event.state?.[SENTINEL] || window.location.href !== guardHref.current) return;
      setPending({ kind: "back" });
    }
    // 앱 안 링크(← 홈 등)는 Next의 Link 처리보다 먼저 가로챈다.
    function onClick(event: MouseEvent) {
      if (leaving.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || READING_PATH.test(url.pathname)) return;
      event.preventDefault();
      event.stopPropagation();
      setPending({ kind: "link", href: url.pathname + url.search + url.hash });
    }
    window.addEventListener("popstate", onPopState);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("click", onClick, true);
    };
  }, [guarded]);

  function stay() {
    // 뒤로 가기로 항목 하나를 소비했으니 다시 채운다.
    if (pending?.kind === "back") window.history.pushState({ [SENTINEL]: true }, "", window.location.href);
    setPending(null);
  }

  function leave() {
    if (!pending) return;
    leaving.current = true;
    setPending(null);
    if (pending.kind === "link") {
      router.push(pending.href);
      return;
    }
    const from = window.location.href;
    window.history.back();
    // 주소를 직접 열어 이전 항목이 없으면 back이 아무 일도 하지 않는다 — 홈으로 보낸다.
    window.setTimeout(() => { if (window.location.href === from) router.replace("/"); }, 400);
  }

  return (
    <ReadingProgressContext.Provider value={report}>
      <LeaveGuardContext.Provider value={register}>
        {children}
      </LeaveGuardContext.Provider>
      {pending && guarded && <ConfirmDialog
        title="지금 나가면 콘에 올릴 수 없어요."
        description="기사를 그만 읽으시겠어요?"
        cancelLabel="계속 읽기"
        confirmLabel="그만 읽기"
        onCancel={stay}
        onConfirm={leave}
      />}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-50 px-4 lg:bottom-6">
        <div role="status" aria-live="polite" aria-atomic="true">
          {visible && <div className="pointer-events-auto mx-auto flex max-w-lg items-start gap-3 rounded-2xl bg-stone-900 p-4 text-sm text-white shadow-lg">
            <div className="flex-1"><p className="font-medium">퀴즈를 제출해야 스쿱을 쌓을 수 있어요.</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-300">읽던 아티클은 횟수 차감 없이 이어 읽을 수 있어요.</p></div>
            <button type="button" aria-label="알림 닫기" onClick={() => setVisible(false)} className="rounded-lg px-2 py-1 text-stone-300 hover:text-white focus-visible:outline-2 focus-visible:outline-white">닫기</button>
          </div>}
        </div>
      </div>
    </ReadingProgressContext.Provider>
  );
}
