import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement, StrictMode, type ReactNode } from "react";
import type { ReaderProps } from "../components/Reader";
import type { TodayPick } from "../lib/feed";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://reading-exit.invalid/" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://reading-auth.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture", NEXT_PUBLIC_API_BASE: "" });
  dom.window.localStorage.setItem("artice-auth", JSON.stringify({ access_token: "fixture", refresh_token: "refresh",
    token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "fixture-user", is_anonymous: false } }));
  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { PathnameContext } = await import("next/dist/shared/lib/hooks-client-context.shared-runtime");
  const { ReadingExitNotice } = await import("../components/ReadingExitNotice");
  const { Reader } = await import("../components/Reader");
  const { Quiz } = await import("../components/Quiz");
  const { Result } = await import("../components/Result");
  const { ArticleCard } = await import("../components/ArticleCard");
  const { createClient } = await import("../lib/supabase/client");
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {}, bfcacheId: "test" };
  const originalFetch = globalThis.fetch;
  let failGrade = false;
  const grade = { score: 1, correct: 1, total: 1, review: [], prevLevel: 1, newLevel: 2, dir: "상승" as const,
    rollingAccuracy: 1, domain: "cloud", domainLabel: "클라우드", articleId: 1, variantId: 2, isReview: false, sourceUrl: null };
  globalThis.fetch = async input => {
    assert.equal(String(input), "/api/quiz/grade");
    return failGrade ? Response.json({ error: "채점 실패" }, { status: 503 }) : Response.json(grade);
  };
  let expire: (() => void) | undefined;
  const setTimeout = dom.window.setTimeout.bind(dom.window);
  dom.window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (delay === 6000 && typeof handler === "function") expire = handler as () => void;
    return setTimeout(handler, delay, ...args);
  }) as typeof dom.window.setTimeout;
  const reader: ReaderProps = { variantId: 2, articleId: 1, level: 1, title: "읽던 기사", contentHtml: "<p>본문</p>",
    glossary: {}, readingMinutes: 1, domainSlug: "cloud", domainLabel: "클라우드", sourceName: null, sourceUrl: null,
    progressStatus: "started", quizScore: null };
  const pick: TodayPick = { variantId: 2, articleId: 1, level: 1, title: "읽던 기사", summary: "설명",
    readingMinutes: 1, sourceName: null, imageUrl: null, publishedAt: null, completedNotSaved: false, progressStatus: "started",
    domain: { id: 1, slug: "cloud", name_ko: "클라우드", name_en: null, rss_topic: null, active: true } };
  const home = () => createElement(ArticleCard, { pick, unlocked: false });
  const quiz = (practice = false) => createElement(Quiz, { variantId: 2, articleTitle: reader.title,
    questions: [{ id: 1, position: 1, prompt: "문제", options: ["답", "오답"] }], isOriginal: practice, isPractice: practice });
  const render = async (path: string, child: ReactNode) => {
    dom.window.history.replaceState({}, "", path);
    await act(async () => root.render(createElement(StrictMode, null,
      createElement(AppRouterContext.Provider, { value: router },
        createElement(PathnameContext.Provider, { value: path },
          createElement(ReadingExitNotice, { children: child }))))));
  };
  const notice = () => container.querySelector('[role="status"]')?.textContent ?? "";
  const click = async (label: string) => {
    const button = [...container.querySelectorAll("button")].find(b => b.textContent === label);
    assert.ok(button, label);
    await act(async () => button.click());
  };
  try {
    await render("/", home());
    assert.equal(notice(), "", "normal home entry has no warning");
    assert.ok(container.querySelector('a[href="/read?v=2"]'), "started external article remains clickable with zero quota");
    assert.match(container.textContent!, /읽는 중 · 이어 읽기/);
    await render("/", createElement(ArticleCard, { pick: { ...pick, progressStatus: null }, unlocked: false }));
    assert.equal(container.querySelector('a[href="/read?v=2"]'), null, "fresh content still respects quota");
    await render("/read", createElement(Reader, reader));
    await render("/", home());
    assert.match(notice(), /퀴즈를 제출해야 스쿱을 쌓을 수 있어요/);
    assert.ok(container.querySelector('a[href="/read?v=2"]'));
    await click("닫기");
    assert.equal(notice(), "");
    await render("/read/", createElement(Reader, reader));
    await render("/read/quiz/", quiz());
    assert.equal(notice(), "", "continuing to the quiz does not warn");
    await render("/", home());
    assert.match(notice(), /퀴즈를 제출해야/, "returning home from unfinished quiz warns too");
    assert.ok(expire);
    await act(async () => expire!());
    assert.equal(notice(), "", "notice dismisses automatically");
    await render("/read/quiz", quiz());
    failGrade = true;
    await click("답"); await click("제출하기");
    assert.match(container.textContent!, /채점 실패/);
    await render("/", home());
    assert.match(notice(), /퀴즈를 제출해야/, "failed submission does not count as completion");
    await render("/read/quiz", quiz());
    failGrade = false;
    await click("답"); await click("제출하기");
    assert.match(container.textContent!, /100점/);
    await render("/", home());
    assert.equal(notice(), "", "successful grading clears unfinished state");
    for (const progressStatus of ["completed", "saved"] as const) {
      await render("/read", createElement(Reader, { ...reader, progressStatus }));
      await render("/", home());
      assert.equal(notice(), "", `${progressStatus} readers do not warn`);
    }
    await render("/read", createElement(Reader, reader));
    await render("/read/quiz", createElement(Result, { result: grade, articleTitle: reader.title }));
    await render("/", home());
    assert.equal(notice(), "", "server-restored result clears stale unfinished state");
    await render("/read/quiz", quiz(true));
    await render("/", home());
    assert.equal(notice(), "", "practice never claims an existing scoop is unavailable");
    await render("/read", createElement(Reader, reader));
    await render("/onboarding", createElement("div", null, "로그인"));
    await render("/", home());
    assert.equal(notice(), "", "leaving the reading session clears state");
    console.log("Reading exit: zero-quota resume, home/back route transitions, unfinished/failed/successful quiz, saved/practice, dismissal and session clearing passed.");
  } finally {
    await act(async () => root.unmount());
    createClient().auth.stopAutoRefresh();
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
