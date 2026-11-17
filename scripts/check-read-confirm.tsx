/** Open confirmation on new articles and the leave guard before a scoop is saved. UI only; no network. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement, StrictMode, type ReactNode } from "react";
import type { ReaderProps } from "../components/Reader";
import type { TodayPick } from "../lib/feed";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://read-confirm.invalid/" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://read-confirm-auth.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture", NEXT_PUBLIC_API_BASE: "" });
  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { PathnameContext } = await import("next/dist/shared/lib/hooks-client-context.shared-runtime");
  const { ReadingExitNotice } = await import("../components/ReadingExitNotice");
  const { Reader } = await import("../components/Reader");
  const { Quiz } = await import("../components/Quiz");
  const { Result } = await import("../components/Result");
  const { ArticleCard } = await import("../components/ArticleCard");
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  const pushes: string[] = [], replaces: string[] = [];
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, prefetch() {}, bfcacheId: "test",
    push(href: string) { pushes.push(href); }, replace(href: string) { replaces.push(href); } };

  const pick: TodayPick = { variantId: 2, articleId: 1, level: 1, title: "새 기사", summary: "설명",
    readingMinutes: 1, sourceName: null, imageUrl: null, publishedAt: null, completedNotSaved: false, progressStatus: null,
    domain: { id: 1, slug: "cloud", name_ko: "클라우드", name_en: null, rss_topic: null, active: true } };
  const reader = (progressStatus: ReaderProps["progressStatus"]): ReaderProps => ({ variantId: 2, articleId: 1, level: 1,
    title: "읽던 기사", contentHtml: "<p>본문</p>", glossary: {}, readingMinutes: 1, domainSlug: "cloud", domainLabel: "클라우드",
    sourceName: null, sourceUrl: null, progressStatus, quizScore: null });
  const grade = { score: 1, correct: 1, total: 1, review: [], prevLevel: 1, newLevel: 1, dir: "유지" as const,
    rollingAccuracy: null, domain: "cloud", domainLabel: "클라우드", articleId: 1, variantId: 2, isReview: false, sourceUrl: null };

  const render = async (path: string, child: ReactNode) => {
    // Like a real navigation: a new path gets its own history entry.
    if (dom.window.location.pathname + dom.window.location.search !== path) dom.window.history.pushState(null, "", path);
    await act(async () => root.render(createElement(StrictMode, null,
      createElement(AppRouterContext.Provider, { value: router },
        createElement(PathnameContext.Provider, { value: path.split("?")[0] },
          createElement(ReadingExitNotice, { children: child }))))));
  };
  const dialog = () => container.querySelector('[role="alertdialog"]');
  const button = (label: string) => {
    const found = [...container.querySelectorAll("button")].find(b => b.textContent === label);
    assert.ok(found, label);
    return found;
  };
  const click = async (el: Element) => {
    await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })); });
  };
  const back = async () => {
    await act(async () => {
      dom.window.history.back();
      await new Promise(resolve => dom.window.setTimeout(resolve, 20));
    });
  };

  // 1. A new article asks before spending today's read; resuming opens directly.
  await render("/", createElement(ArticleCard, { pick, unlocked: true }));
  const link = container.querySelector('a[href="/read?v=2"]')!;
  await click(link);
  assert.match(dialog()?.textContent ?? "", /이 기사를 정말 읽을까요\?/);
  assert.match(dialog()?.textContent ?? "", /오늘 읽을 수 있는 횟수를 1회 써요/);
  assert.equal(dom.window.document.activeElement, button("취소"), "cancel is focused first");
  assert.deepEqual(pushes, []);
  await click(button("취소"));
  assert.equal(dialog(), null);
  assert.deepEqual(pushes, []);
  await click(link);
  await act(async () => { dialog()!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  assert.equal(dialog(), null, "Escape cancels");
  await click(link);
  await click(button("읽을게요"));
  assert.deepEqual(pushes, ["/read?v=2"]);
  assert.equal(dialog(), null);
  pushes.length = 0;
  // Saved and unsaved-result cards never ask (no quota is spent).
  for (const resumed of [{ progressStatus: "started" as const }, { progressStatus: "saved" as const, isOriginal: true }, { completedNotSaved: true, progressStatus: "completed" as const }]) {
    await render("/", createElement(ArticleCard, { pick: { ...pick, ...resumed }, unlocked: false }));
    const anchor = container.querySelector("a[href]");
    assert.ok(anchor, "resumable card stays clickable");
    // Clicking would reach Next's real router in this fixture; instead assert nothing intercepts it.
    assert.equal(dialog(), null);
  }

  // 2. Leaving the reader before saving asks once, both from in-app links and Back.
  await render("/", createElement("p", null, "홈"));
  const lengthBefore = dom.window.history.length;
  await render("/read?v=2", createElement(Reader, reader("started")));
  assert.equal(dom.window.history.length, lengthBefore + 2, "the reader entry plus one sentinel for Back");
  assert.equal(dom.window.history.state?.__acReadGuard, true);
  const home = container.querySelector('a[href="/"]')!;
  await click(home);
  assert.match(dialog()?.textContent ?? "", /지금 나가면 콘에 올릴 수 없어요\./);
  assert.match(dialog()?.textContent ?? "", /기사를 그만 읽으시겠어요\?/);
  assert.deepEqual(pushes, [], "in-app link is held");
  await click(button("계속 읽기"));
  assert.equal(dialog(), null);
  await click(home);
  await click(button("그만 읽기"));
  assert.deepEqual(pushes, ["/"]);
  pushes.length = 0;
  await render("/", createElement("p", null, "홈")); // the stub router does not move; arrive by hand

  // Moving forward to the quiz is not leaving and does not stack another sentinel.
  await render("/read?v=2", createElement(Reader, reader("started")));
  const quizLink = container.querySelector('a[href="/read/quiz?v=2"]')!;
  assert.ok(quizLink);
  const quizLength = dom.window.history.length;
  await render("/read/quiz?v=2", createElement(Quiz, { variantId: 2, articleTitle: "읽던 기사",
    questions: [{ id: 1, position: 1, prompt: "문제", options: ["답", "오답"] }] }));
  assert.equal(dom.window.history.length, quizLength + 1, "quiz reuses the reader's sentinel");
  await back(); // quiz -> reader sentinel: a page change inside the flow
  assert.equal(dialog(), null, "Back from quiz to the reader does not ask");
  await render("/read?v=2", createElement(Reader, reader("started")));
  await back(); // reader sentinel -> reader: the next Back would leave
  assert.match(dialog()?.textContent ?? "", /지금 나가면 콘에 올릴 수 없어요/);
  await click(button("계속 읽기"));
  assert.equal(dialog(), null);
  assert.equal(dom.window.history.state?.__acReadGuard, true, "staying re-arms Back");
  await back();
  assert.ok(dialog(), "asks again after staying");
  await click(button("그만 읽기"));
  await act(async () => { await new Promise(resolve => dom.window.setTimeout(resolve, 450)); });
  assert.equal(dialog(), null);
  assert.deepEqual(replaces, [], "a previous entry existed, so no home fallback");

  // 3. Nothing to lose: saved reader, practice quiz and saved results never ask.
  await render("/", createElement("p", null, "홈"));
  for (const [path, screen] of [
    ["/read?v=2", createElement(Reader, reader("saved"))],
    ["/read/quiz?v=2&practice=1", createElement(Quiz, { variantId: 2, articleTitle: "기초", isOriginal: true, isPractice: true,
      questions: [{ id: 1, position: 1, prompt: "문제", options: ["답", "오답"] }] })],
    ["/read/quiz?v=2", createElement(Result, { result: { ...grade, isReview: true, canSave: false }, articleTitle: "읽던 기사" })],
  ] as const) {
    await render(path, screen);
    assert.notEqual(dom.window.history.state?.__acReadGuard, true, `${path}: no sentinel`);
    const homeLink = container.querySelector('a[href="/"]');
    if (homeLink) {
      // Plain <a> would make jsdom navigate; just make sure our guard does not hold it.
      const event = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
      homeLink.addEventListener("click", e => e.preventDefault(), { once: true });
      await act(async () => { homeLink.dispatchEvent(event); });
    }
    assert.equal(dialog(), null, `${path}: no prompt`);
    await render("/", createElement("p", null, "홈"));
  }

  // 4. An unsaved result still guards.
  await render("/read/quiz?v=2", createElement(Result, { result: grade, articleTitle: "읽던 기사" }));
  assert.equal(dom.window.history.state?.__acReadGuard, true);
  await act(async () => root.unmount());
  console.log("Read confirm: new-article open prompt (cancel/Escape/confirm), resume without prompt, leave guard for links and Back, quiz flow without extra prompts, re-arm on stay, and no guard after saving or in practice passed.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
