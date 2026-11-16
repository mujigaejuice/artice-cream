"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageError, PageLoading } from "@/components/ScreenState";
import { apiJson } from "@/lib/client-api";
import { defaultScoopHex } from "@/lib/color";
import { dayKey } from "@/lib/day";
import { readHref } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";
import type { DomainRow } from "@/lib/supabase/types";
import { useRefreshOnResume } from "@/lib/use-refresh-on-resume";
import { termKey, type Word, type WordSource } from "@/lib/words";

/**
 * 단어장 탭 (확장.md §3-1) — 읽고 퀴즈까지 마친 글의 용어를 한곳에 모은다.
 *
 * 데이터는 `/api/words`가 만든다(권리 판정 포함 — lib/words.ts). 검색과 분야
 * 필터는 받은 목록 위에서 여기서만 한다. 필터 상태를 URL에 두지 않는 건 정적
 * 내보내기 때문이다(lib/use-query.ts) — 탭을 다시 열면 전체 목록부터 보인다.
 */

type WordsData =
  | { status: "onboarding" }
  | { status: "ok"; userId: string; domains: DomainRow[]; words: Word[] };

const ALL = "all";

function formatDate(date: string, thisYear: string): string {
  const [y, m, d] = date.split("-");
  const day = `${Number(m)}월 ${Number(d)}일`;
  return y === thisYear ? day : `${y}년 ${day}`;
}

export default function WordsPage() {
  const router = useRouter();
  const [data, setData] = useState<WordsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<string>(ALL);
  const request = useRef(0);

  // 첫 로드는 상태를 비우지 않고(처음부터 비어 있다) 요청만 보낸다. 다시 시도·
  // 복귀 때만 load가 화면을 로딩으로 돌린다. 늦게 도착한 응답은 request id로 버린다.
  const fetchWords = useCallback(async (current: number) => {
    try {
      const { data: { session }, error: sessionError } = await createClient().auth.getSession();
      if (current !== request.current) return;
      if (sessionError) throw sessionError;
      // 화면 분기용일 뿐이다. 실제 데이터 접근은 API가 토큰으로 다시 잰다.
      if (!session || session.user.is_anonymous) {
        setData({ status: "onboarding" });
        return;
      }
      const next = await apiJson<WordsData>("/api/words");
      if (current !== request.current) return;
      // 다른 계정의 응답이 늦게 도착해 섞이지 않게 한다.
      if (next.status === "ok" && next.userId !== session.user.id) throw new Error("account mismatch");
      setData(next);
    } catch {
      if (current === request.current) setError("단어장을 불러오지 못했어요.");
    }
  }, []);

  const load = useCallback(() => {
    const current = ++request.current;
    setError(null);
    setData(null);
    void fetchWords(current);
  }, [fetchWords]);

  useEffect(() => {
    void fetchWords(++request.current);
  }, [fetchWords]);
  useRefreshOnResume(load);

  useEffect(() => {
    if (data?.status === "onboarding") router.replace("/onboarding");
  }, [data, router]);

  const words = useMemo(() => (data?.status === "ok" ? data.words : []), [data]);

  // 칩은 실제로 단어가 있는 분야만, domains 표의 순서대로.
  const domainChips = useMemo(() => {
    if (data?.status !== "ok") return [];
    const present = new Set(words.flatMap((word) => word.domains));
    return data.domains.filter((d) => present.has(d.slug));
  }, [data, words]);

  // 새로 불러온 목록에 그 분야가 없어졌으면 전체로 돌아간다.
  const activeDomain = domain !== ALL && domainChips.some((d) => d.slug === domain) ? domain : ALL;
  const needle = termKey(query);

  const visible = useMemo(() => words.filter((word) =>
    (activeDomain === ALL || word.domains.includes(activeDomain)) &&
    (!needle || termKey(word.term).includes(needle) || termKey(word.definition).includes(needle)),
  ), [words, activeDomain, needle]);

  if (error) return <PageError message={error} onRetry={load} />;
  if (!data || data.status === "onboarding") return <PageLoading label="단어장을 불러오고 있어요" />;

  const thisYear = dayKey().slice(0, 4);
  const filtering = Boolean(needle) || activeDomain !== ALL;

  function resetFilters() {
    setQuery("");
    setDomain(ALL);
  }

  return (
    <main>
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight text-stone-900">
          <span className="ac-mark">단어장</span>
        </h1>
        <p className="text-xs text-stone-500">{words.length}개</p>
      </header>

      {words.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-6 text-center">
          <p className="text-sm text-stone-600">아직 모은 단어가 없어요.</p>
          <p className="mt-1 text-xs text-stone-500">
            아티클을 읽고 퀴즈까지 마치면 그 글의 용어가 여기에 모여요.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-stone-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
          >
            오늘의 아티클 보러 가기
          </Link>
        </div>
      ) : (
        <>
          <div role="search" className="mb-3">
            <label htmlFor="words-search" className="sr-only">단어 검색</label>
            <input
              id="words-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="용어나 뜻으로 찾기"
              autoComplete="off"
              enterKeyHint="search"
              className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-stone-800"
            />
          </div>

          {domainChips.length > 1 && (
            <nav aria-label="분야" className="mb-4">
              <ul className="flex flex-wrap gap-2">
                {[{ slug: ALL, name_ko: "전체" }, ...domainChips].map((d) => (
                  <li key={d.slug}>
                    <button
                      type="button"
                      aria-pressed={activeDomain === d.slug}
                      onClick={() => setDomain(d.slug)}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800 ${
                        activeDomain === d.slug ? "bg-stone-900 text-white" : "bg-white text-stone-600 hover:bg-stone-100"
                      }`}
                    >
                      {d.name_ko}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <p role="status" aria-live="polite" className={filtering ? "mb-3 text-xs text-stone-500" : "sr-only"}>
            {filtering ? `찾은 단어 ${visible.length}개` : `단어 ${words.length}개`}
          </p>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 p-6 text-center">
              <p className="text-sm text-stone-600">
                {needle ? `‘${query.trim()}’에 맞는 단어가 없어요.` : "이 분야에는 아직 모은 단어가 없어요."}
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 text-sm font-medium text-stone-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
              >
                전체 단어 보기
              </button>
            </div>
          ) : (
            <ul aria-label="단어 목록" className="space-y-3">
              {visible.map((word) => (
                <li key={termKey(word.term)}>
                  <WordItem word={word} thisYear={thisYear} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function SourceLink({ source, thisYear }: { source: WordSource; thisYear: string }) {
  return (
    <Link
      href={readHref(source.variantId)}
      className="block truncate rounded text-xs text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
    >
      <time dateTime={source.date}>{formatDate(source.date, thisYear)}</time> · {source.title}
    </Link>
  );
}

function WordItem({ word, thisYear }: { word: Word; thisYear: string }) {
  const [latest, ...older] = word.sources;

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-stone-900">{word.term}</h2>
        <p className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[11px] font-medium text-stone-500">
          {word.domainLabel}
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: defaultScoopHex(word.domain) }}
          />
        </p>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-stone-700">{word.definition}</p>

      {latest && (
        <div className="mt-2 border-t border-stone-100 pt-2">
          <SourceLink source={latest} thisYear={thisYear} />
          {older.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer rounded text-xs text-stone-500 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800">
                다른 글 {older.length}편에도 나왔어요
              </summary>
              <ul aria-label={`${word.term}이(가) 나온 다른 글`} className="mt-1 space-y-1 pl-3">
                {older.map((source) => (
                  <li key={source.articleId}>
                    <SourceLink source={source} thisYear={thisYear} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
