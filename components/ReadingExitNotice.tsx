"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const ReadingProgressContext = createContext<(needsQuiz: boolean) => void>(() => {});

/** Only UI guidance; never changes progress, quota or the server's save rules. */
export function useReadingProgress(needsQuiz: boolean) {
  const report = useContext(ReadingProgressContext);
  useEffect(() => { report(needsQuiz); }, [report, needsQuiz]);
}

/** Lives across route changes so the notice survives both Home and browser Back. */
export function ReadingExitNotice({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const needsQuiz = useRef(false);
  const [visible, setVisible] = useState(false);
  const report = useCallback((value: boolean) => { needsQuiz.current = value; }, []);

  useEffect(() => {
    if (!pathname) return;
    const reading = /^\/read(?:\/quiz)?\/?$/.test(pathname);
    if (reading) {
      setVisible(false);
      return;
    }
    setVisible(pathname === "/" && needsQuiz.current);
    needsQuiz.current = false;
  }, [pathname]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(timer);
  }, [visible]);

  return (
    <ReadingProgressContext.Provider value={report}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 z-50 px-4" style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}>
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
