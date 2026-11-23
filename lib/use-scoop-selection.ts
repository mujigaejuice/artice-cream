"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Scoop } from "@/lib/feed";

/**
 * 콘·보울 장면의 스쿱 선택 상태. 콘(ConeBoard)과 보울(BowlBoard)이 같이 쓴다.
 *
 * URL 동기화에 Next 라우터 대신 History API를 쓴다. 선택은 순수 클라이언트
 * 상태이고, `router.push`는 화면을 다시 마운트해 `/api/cone`을 새로 부른다.
 */
export function useScoopSelection(scoops: Scoop[], initialScoopId: number | null) {
  const [selectedId, setSelectedId] = useState<number | null>(initialScoopId);
  /** 우리가 history에 항목을 쌓았는지 — 뒤로가기로 닫을지 판단한다. */
  const pushed = useRef(false);

  /**
   * 선택이 "없다가 생길 때만" 쓸어내기 애니메이션을 튼다(화면구성.md §4-2) —
   * 스쿱 사이를 옮겨 다닐 때 매번 다시 쓰이면 금방 피곤해진다.
   */
  const [animatePanel, setAnimatePanel] = useState(initialScoopId != null);
  const prevSelectedId = useRef<number | null>(initialScoopId);
  useEffect(() => {
    setAnimatePanel(prevSelectedId.current == null && selectedId != null);
    prevSelectedId.current = selectedId;
  }, [selectedId]);

  // Consume the arrival only after it was shown, not while the scene is mounting.
  const finishArrival = useCallback((id: number) => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("new") !== String(id)) return;
    url.searchParams.delete("new");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);

  const selected = useMemo(
    () => scoops.find((s) => s.id === selectedId) ?? null,
    [scoops, selectedId],
  );

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back(); // popstate 핸들러가 상태를 비운다
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("scoop");
    url.searchParams.delete("new");
    window.history.replaceState(null, "", url.pathname + url.search);
    setSelectedId(null);
  }, []);

  const select = useCallback(
    (scoop: Scoop) => {
      if (scoop.id === selectedId) {
        close();
        return;
      }
      const location = new URL(window.location.href);
      location.searchParams.set("scoop", String(scoop.id));
      location.searchParams.delete("new");
      const url = location.pathname + location.search;
      if (selectedId == null) {
        window.history.pushState(null, "", url);
        pushed.current = true;
      } else {
        // 스쿱 사이를 옮겨 다닐 때마다 히스토리가 쌓이면 뒤로가기가 못 쓰게 된다.
        window.history.replaceState(null, "", url);
      }
      setSelectedId(scoop.id);
    },
    [selectedId, close],
  );

  // 뒤로가기가 앱을 나가지 않고 패널만 닫게 한다.
  useEffect(() => {
    function onPop() {
      const raw = new URLSearchParams(window.location.search).get("scoop");
      pushed.current = false;
      setSelectedId(raw ? Number(raw) : null);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, close]);

  /** 패널 밖(장면 배경) 탭으로도 닫는다(화면구성.md §4-2 "선택 해제"). */
  const onBackgroundClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (selectedId == null) return;
      const target = event.target as Element;
      // 스크린리더 목록 버튼도 장면 안에 있다 — 그 클릭은 고르기로만 처리하고 닫지 않는다.
      if (target.closest(".ac-scoop, .ac-panel, button, a")) return;
      close();
    },
    [selectedId, close],
  );

  return { selectedId, selected, select, close, animatePanel, finishArrival, onBackgroundClick };
}
