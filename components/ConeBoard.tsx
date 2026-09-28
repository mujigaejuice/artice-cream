"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ScoopCone } from "@/components/ScoopCone";
import { ScoopPanel } from "@/components/ScoopPanel";
import { coreColor } from "@/lib/color";
import { coneHeight, slotRange } from "@/lib/cone";
import type { Scoop } from "@/lib/feed";
import type { DomainRow } from "@/lib/supabase/types";

/**
 * 콘 탭의 본체 — 스쿱 선택 상태를 들고 콘과 타이틀 패널을 배치한다.
 *
 * URL 동기화에 Next 라우터 대신 History API를 쓴다. 선택은 순수 클라이언트
 * 상태이고, `router.push`는 화면을 다시 마운트해 `/api/cone`을 새로 부른다.
 *
 * 경로는 `window.location.pathname`에서 읽는다. 하드코딩하면 앱 빌드
 * (`trailingSlash: true`)에서 정본이 `/cone/`인데 `/cone`으로 갈아 두게 되고,
 * 그 주소로 새로고침하면 정적 호스트가 파일을 찾지 못한다.
 */

type Props = {
  scoops: Scoop[];
  domains: DomainRow[];
  /** `/cone?scoop=<id>`로 바로 들어온 경우의 초기 선택. */
  initialScoopId: number | null;
  /** 저장 직후 떨어뜨릴 스쿱 — ScoopCone이 ac-plop을 건다. */
  justAddedId?: number | null;
  /** 리더 링크 접두사. 목데이터 미리보기가 /preview 아래에서 쓴다. */
  base?: string;
};

export function ConeBoard({
  scoops,
  domains,
  initialScoopId,
  justAddedId = null,
  base = "",
}: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(initialScoopId);
  /** 우리가 history에 항목을 쌓았는지 — 뒤로가기로 닫을지 판단한다. */
  const pushed = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  /**
   * 떨어지는 건 한 번뿐이다. 새로고침이나 뒤로가기로 같은 URL에 돌아왔을 때
   * 다시 떨어지지 않도록, 애니메이션이 걸린 뒤 쿼리에서 ?new= 를 떼어 둔다.
   */
  useEffect(() => {
    if (justAddedId == null) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("new")) return;
    url.searchParams.delete("new");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [justAddedId]);

  const ordered = useMemo(
    () => [...scoops].sort((a, b) => a.date.localeCompare(b.date)),
    [scoops],
  );
  const n = ordered.length;

  const selected = useMemo(
    () => ordered.find((s) => s.id === selectedId) ?? null,
    [ordered, selectedId],
  );

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back(); // popstate 핸들러가 상태를 비운다
      return;
    }
    window.history.replaceState(null, "", window.location.pathname);
    setSelectedId(null);
  }, []);

  const select = useCallback(
    (scoop: Scoop) => {
      if (scoop.id === selectedId) {
        close();
        return;
      }
      const url = `${window.location.pathname}?scoop=${scoop.id}`;
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

  // 화면 밖 스쿱을 골랐을 때(딥링크 포함) 패널이 보이도록 최소한만 스크롤한다.
  useEffect(() => {
    if (selected) panelRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  /**
   * 패널이 놓일 빈 슬롯. 콘 SVG는 viewBox 비율대로 렌더되고 감싼 div의 높이가 곧
   * SVG 높이이므로, 픽셀을 재지 않고 백분율로 잡으면 어떤 폭에서도 슬롯에 정확히
   * 앉는다. **높이까지 슬롯에 맞춰 잘라야** 글이 위아래 스쿱을 덮지 않는다.
   */
  const slot = useMemo(() => {
    if (selected == null) return null;
    const i = ordered.findIndex((s) => s.id === selected.id);
    if (i === -1) return null;
    const H = coneHeight(n);
    const { top, height } = slotRange(i, n);
    return { top: `${(top / H) * 100}%`, height: `${(height / H) * 100}%` };
  }, [selected, ordered, n]);

  /** 패널 밖(콘 영역 배경) 탭으로도 닫는다(화면구성.md §4-2 "선택 해제"). */
  const onBackgroundClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (selectedId == null) return;
      const target = event.target as Element;
      if (target.closest(".ac-scoop") || target.closest(".ac-panel")) return;
      close();
    },
    [selectedId, close],
  );

  if (n === 0) {
    return (
      <div className="py-6">
        <ScoopCone scoops={[]} />
        <div className="mt-6 text-center">
          <p className="text-sm text-stone-600">
            아티클을 읽고 퀴즈를 풀면 스쿱이 하나 올라가요.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white"
          >
            오늘의 아티클 읽으러 가기 →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 높이가 선택 상태에 따라 변하지 않는다 — 콘도 아래 스쿱도 그 자리에 있는다. */}
      <div className="relative" onClick={onBackgroundClick}>
        <ScoopCone
          scoops={ordered}
          selectedId={selectedId}
          justAddedId={justAddedId}
          onSelect={select}
        />

        {selected && slot && (
          <div
            ref={panelRef}
            /* 왼쪽은 빠져나온 스쿱(오른끝 x=88≈34%)을 피해 잡는다. */
            className="ac-panel absolute left-[37%] right-[3%] overflow-hidden"
            style={{ top: slot.top, height: slot.height }}
          >
            <ScoopPanel scoop={selected} base={base} animate={animatePanel} />
          </div>
        )}
      </div>

      {/* 색이 왜 다른지 설명이 없으면 스쿱 색은 그냥 장식으로 읽힌다. */}
      <section aria-labelledby="flavors" className="mt-8">
        <h2 id="flavors" className="text-sm font-semibold text-stone-700">
          분야별 맛
        </h2>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-stone-600">
          {domains.map((d) => (
            <li key={d.id} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: coreColor(d.slug) }}
                aria-hidden="true"
              />
              {d.name_ko}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-stone-500">
          같은 분야도 완료한 날짜에 따라 색이 조금씩 달라져요.
        </p>
      </section>
    </div>
  );
}
