"use client";

/**
 * 로딩·에러 껍데기 (plan §7 — 빈 상태/에러 상태 카피).
 *
 * 정적 내보내기로 옮기면서 모든 화면이 "먼저 뜨고 나서 데이터를 기다리는" 모양이
 * 됐다(앱출시.md §2). 그 사이를 빈 화면으로 두면 앱이 멈춘 것처럼 보이므로,
 * 다섯 화면이 같은 껍데기를 쓴다.
 *
 * 에러 카피는 사용자가 할 수 있는 행동을 적는다 — 원인을 적어도 할 수 있는 일이
 * 없으면 쓸모가 없다. 다시 시도가 유일한 행동이라 버튼이 하나다.
 */

export function PageLoading({ label }: { label: string }) {
  return (
    // 화면을 끝까지 채운다. 고정 높이 박스 몇 개만 그리면 위쪽에만 내용이 있고
    // 아래가 통째로 비어서, 로딩이 아니라 화면이 잘린 것처럼 보인다.
    //
    // 빼는 9rem은 루트 레이아웃의 pt-6 + pb-16(5.5rem)에 탭 레이아웃이 탭 바
    // 자리로 비우는 3.5rem을 더한 값이다. 탭이 없는 화면(리더·퀴즈·온보딩)에서는
    // 그만큼 덜 차지만, 넘치면 로딩 화면이 스크롤되면서 상태바 밑으로 말려
    // 들어간다. 모자란 쪽이 낫다.
    <main className="flex min-h-[calc(100dvh-9rem-env(safe-area-inset-bottom,0px))] flex-col">
      {/* 스크린리더에는 상태를 말로 준다. 스켈레톤은 aria-hidden으로 감춘다. */}
      <p role="status" aria-live="polite" className="sr-only">
        {label}
      </p>

      <div aria-hidden className="flex flex-1 animate-pulse flex-col gap-4">
        <div className="h-7 w-40 shrink-0 rounded-lg bg-stone-200" />
        {/* flex-1이라 기기 높이가 달라도 남는 자리가 생기지 않는다. */}
        <div className="min-h-28 flex-1 rounded-2xl bg-stone-200" />
        <div className="min-h-28 flex-1 rounded-2xl bg-stone-200" />
        <div className="min-h-28 flex-1 rounded-2xl bg-stone-200" />
      </div>
    </main>
  );
}

export function PageError({
  message,
  onRetry,
}: {
  message?: string | null;
  onRetry: () => void;
}) {
  return (
    <main className="py-16 text-center">
      <h1 className="text-lg font-semibold text-stone-900">
        불러오지 못했어요
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        연결을 확인하고 다시 시도해 주세요.
      </p>
      {message && (
        <p className="mt-1 text-xs text-stone-400">{message}</p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white"
      >
        다시 시도
      </button>
    </main>
  );
}
