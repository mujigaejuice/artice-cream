"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { playScoopSound } from "@/lib/scoop-sound";

/** Wait for a visible, painted cone before starting its new scoop's entrance. */
export function useScoopArrival(id: number | null, onComplete?: (id: number) => void) {
  const slotRef = useRef<SVGGElement>(null);
  const [startedId, setStartedId] = useState<number | null>(null);
  const [completedId, setCompletedId] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const landedId = useRef<number | null>(null);
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);

  const land = useCallback(() => {
    if (id == null || landedId.current === id) return;
    landedId.current = id;
    playScoopSound();
  }, [id]);

  const complete = useCallback(() => {
    if (id == null) return;
    setCompletedId(id);
    completeRef.current?.(id);
  }, [id]);

  useEffect(() => {
    const slot = slotRef.current;
    if (id == null || !slot || completedId === id) return;
    let cancelled = false;
    let frame = 0;
    let timer = 0;
    let queued = false;
    let started = false;
    let generation = 0;
    let inView = typeof IntersectionObserver === "undefined";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    function cancelStart() {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      queued = false;
      generation++;
    }

    function queueStart() {
      if (cancelled || queued || started || !inView || document.hidden) return;
      queued = true;
      const attempt = generation;
      // Font/layout readiness alone does not imply that a browser paint occurred.
      void Promise.resolve(document.fonts?.ready).then(() => {
        if (cancelled || !queued || attempt !== generation) return;
        frame = window.requestAnimationFrame(() => {
          frame = window.requestAnimationFrame(() => {
            timer = window.setTimeout(() => {
              if (cancelled || !inView || document.hidden) return;
              started = true;
              setStartedId(id);
              if (reduced.matches) { land(); complete(); }
            }, 180);
          });
        });
      });
    }

    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      setPaused(!inView || document.hidden);
      if (inView) queueStart();
      else cancelStart();
    });
    observer?.observe(slot);
    // The result page may have been scrolled down; bring the arrival into view.
    slot.scrollIntoView?.({ block: "nearest", behavior: "instant" });
    function visibilityChanged() {
      setPaused(document.hidden || !inView);
      if (document.hidden) cancelStart();
      else queueStart();
    }
    function motionChanged() {
      if (started && reduced.matches) { land(); complete(); }
    }
    document.addEventListener("visibilitychange", visibilityChanged);
    reduced.addEventListener("change", motionChanged);
    queueStart();
    return () => {
      cancelled = true;
      cancelStart();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibilityChanged);
      reduced.removeEventListener("change", motionChanged);
    };
  }, [id, completedId, land, complete]);

  return {
    slotRef,
    waiting: id != null && startedId !== id && completedId !== id,
    falling: id != null && startedId === id && completedId !== id,
    paused,
    land,
    complete,
  };
}
