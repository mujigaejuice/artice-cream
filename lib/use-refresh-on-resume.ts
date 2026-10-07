"use client";

import { useEffect } from "react";

/** Revalidate restored browser pages and resumed tabs instead of serving old in-memory content. */
export function useRefreshOnResume(reload: () => void): void {
  useEffect(() => {
    const visible = () => { if (document.visibilityState === "visible") reload(); };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) reload(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("pageshow", restored);
    return () => {
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("pageshow", restored);
    };
  }, [reload]);
}
