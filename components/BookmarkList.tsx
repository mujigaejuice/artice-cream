"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Bookmark } from "@/lib/bookmarks";
import { apiJson } from "@/lib/client-api";
import { coreColor } from "@/lib/color";
import { levelShort } from "@/lib/level";
import { readHref } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";
import { useRefreshOnResume } from "@/lib/use-refresh-on-resume";

type BookmarksResponse = { userId: string; bookmarks: Bookmark[] };

/**
 * 나 탭의 "북마크한 글" (확장.md §4). 스스로 불러오고, 다른 계정의 응답은 버린다.
 * 해제는 목록에서 바로 빼고(낙관적) 서버가 거절하면 제자리에 되돌린다.
 */
export function BookmarkList({ userId }: { userId: string }) {
  const [items, setItems] = useState<Bookmark[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Set<number>>(() => new Set());
  const requestId = useRef(0);

  const load = useCallback(() => {
    const id = ++requestId.current;
    apiJson<BookmarksResponse>("/api/bookmarks")
      .then((next) => {
        if (id !== requestId.current) return;
        if (next.userId !== userId || !Array.isArray(next.bookmarks)) { setLoadError(true); return; }
        setLoadError(false);
        setItems(next.bookmarks);
      })
      .catch(() => { if (id === requestId.current) setLoadError(true); });
  }, [userId]);

  useEffect(() => {
    const requests = requestId;
    load();
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) {
        requests.current++;
        setItems(null);
      }
    });
    return () => { requests.current++; subscription.unsubscribe(); };
  }, [load, userId]);
  useRefreshOnResume(load);

  async function remove(bookmark: Bookmark) {
    if (removing.has(bookmark.articleId)) return;
    // 진행 중인 목록 요청이 해제 전 상태로 덮어쓰지 않게 무효로 만든다.
    requestId.current++;
    setActionError(null);
    setMessage(null);
    setRemoving((prev) => new Set(prev).add(bookmark.articleId));
    const index = (items ?? []).findIndex((item) => item.articleId === bookmark.articleId);
    setItems((current) => current?.filter((item) => item.articleId !== bookmark.articleId) ?? current);
    try {
      await apiJson("/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ articleId: bookmark.articleId, bookmarked: false }),
      });
      setMessage("북마크를 해제했어요.");
    } catch {
      setItems((current) => {
        const list = current ?? [];
        if (list.some((item) => item.articleId === bookmark.articleId)) return list;
        const next = [...list];
        next.splice(Math.min(Math.max(index, 0), next.length), 0, bookmark);
        return next;
      });
      setActionError("북마크를 해제하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setRemoving((prev) => { const next = new Set(prev); next.delete(bookmark.articleId); return next; });
    }
  }

  return (
    <section aria-labelledby="bookmarks-heading" className="mt-8">
      <h2 id="bookmarks-heading" className="text-sm font-semibold text-stone-900">북마크한 글</h2>
      {loadError && !items ? (
        <button type="button" onClick={() => { setLoadError(false); load(); }} className="mt-3 text-sm text-stone-700 underline underline-offset-4 focus-visible:outline-2">
          북마크를 불러오지 못했어요 · 재시도
        </button>
      ) : !items ? (
        <p role="status" className="mt-3 text-sm text-stone-500">북마크 불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          아직 북마크한 글이 없어요. 리더에서 북마크를 누르면 여기에 모여요.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
          {items.map((item) => (
            <li key={item.articleId} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                {item.available && item.variantId != null ? (
                  <Link href={readHref(item.variantId)} className="block rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">
                    <span className="block truncate text-base font-medium text-stone-900">{item.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                      {item.domain && (
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: coreColor(item.domain) }} aria-hidden="true" />
                      )}
                      {item.domainLabel && <span>{item.domainLabel}</span>}
                      <span>{item.isOriginal ? "Original" : item.level != null ? levelShort(item.level) : ""}</span>
                      {item.sourceName && <span>· {item.sourceName}</span>}
                    </span>
                  </Link>
                ) : (
                  <>
                    <span className="block text-base font-medium text-stone-500">{item.title}</span>
                    <span className="mt-1 block text-xs text-stone-500">내려간 글이라 지금은 열 수 없어요.</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => void remove(item)}
                disabled={removing.has(item.articleId)}
                aria-label={`${item.title} 북마크 해제`}
                className="min-h-10 shrink-0 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-700 transition hover:bg-stone-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
              >
                해제
              </button>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="sr-only">{message}</p>
      {actionError && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}
    </section>
  );
}
