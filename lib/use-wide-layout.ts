"use client";

import { useSyncExternalStore } from "react";

/** The one place the laptop breakpoint lives; matches Tailwind `lg`. */
export const WIDE_QUERY = "(min-width: 1024px)";

function query(): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(WIDE_QUERY) : null;
}

function subscribe(onChange: () => void): () => void {
  const list = query();
  if (!list) return () => {};
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

const getSnapshot = () => query()?.matches ?? false;
const getServerSnapshot = () => false;

/** True at laptop width. Server and hydration render as narrow, then follow the real width. */
export function useWideLayout(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
