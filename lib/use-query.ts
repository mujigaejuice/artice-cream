"use client";

import { useEffect, useState } from "react";

/**
 * 쿼리스트링 읽기 (앱출시.md §2).
 *
 * `useSearchParams()`를 쓰지 않는 이유: 정적 내보내기는 페이지를 빌드 시점에
 * 미리 렌더하고, 그때는 쿼리가 없다. 훅을 쓰면 Suspense 경계를 두르라는 요구가
 * 따라붙는데, 어차피 데이터도 마운트 뒤에 가져오므로 얻는 게 없다.
 *
 * 마운트 전에는 `null`이다 — 호출하는 화면이 이미 로딩 상태를 갖고 있으므로
 * "아직 모른다"와 "없다"를 구분할 수 있어야 한다.
 */
export function useQueryParams(): URLSearchParams | null {
  const [params, setParams] = useState<URLSearchParams | null>(null);

  useEffect(() => {
    setParams(new URLSearchParams(window.location.search));
  }, []);

  return params;
}
