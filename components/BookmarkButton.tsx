"use client";

import { useRef, useState } from "react";

import { apiJson } from "@/lib/client-api";

/**
 * 리더 헤더의 북마크 토글. 누르는 즉시 바뀌고(낙관적), 서버가 거절하면 되돌린다.
 * 응답을 기다리는 동안의 추가 입력은 무시한다 — 순서가 뒤바뀐 응답이 화면을
 * 덮어쓰지 않게.
 */
export function BookmarkButton({ articleId, initialBookmarked }: { articleId: number; initialBookmarked: boolean }) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  async function toggle() {
    if (busy.current) return;
    busy.current = true;
    const previous = bookmarked;
    const next = !previous;
    setBookmarked(next);
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiJson<{ bookmarked: boolean }>("/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ articleId, bookmarked: next }),
      });
      setBookmarked(result.bookmarked);
      setMessage(result.bookmarked ? "북마크했어요." : "북마크를 해제했어요.");
    } catch {
      setBookmarked(previous);
      setError(next ? "북마크하지 못했어요. 다시 시도해 주세요." : "북마크를 해제하지 못했어요. 다시 시도해 주세요.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={bookmarked}
        aria-busy={pending || undefined}
        aria-label="이 글 북마크"
        className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800 ${
          bookmarked
            ? "border-stone-900 bg-stone-900 text-white hover:bg-stone-800"
            : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill={bookmarked ? "currentColor" : "none"}
          stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
          <path d="M6 3h12v18l-6-4-6 4z" />
        </svg>
        {/* 상태는 aria-pressed와 채운 아이콘이 말한다. 이름은 바꾸지 않는다. */}
        북마크
      </button>
      <span role="status" className="sr-only">{message}</span>
      {error && (
        <span role="alert" className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg bg-white p-2 text-xs text-red-700 shadow">
          {error}
        </span>
      )}
    </span>
  );
}
