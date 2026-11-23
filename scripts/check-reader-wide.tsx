/** Laptop reader: glossary rail, CTA placement and term highlight; jsdom, no network. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import type { ReaderProps } from "../components/Reader";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://reader-wide.invalid/read?v=7" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const { glossaryInOrder } = await import("../lib/glossary-order");
  assert.deepEqual(glossaryInOrder('<p><mark data-w="w2">B</mark> <mark data-w="w1">A</mark> <mark data-w="w2">B</mark> <mark data-w="w9">X</mark></p>',
    { w1: { term: "A", definition: "a" }, w2: { term: "B", definition: "b" }, w3: { term: "C", definition: "c" } }).map(i => i.id),
    ["w2", "w1", "w3"], "body order first, unmarked entries after, unknown marks ignored");
  assert.deepEqual(glossaryInOrder("<p>없음</p>", {}), []);
  assert.deepEqual(glossaryInOrder("<p data-w='w1'>x</p>", { w1: { term: "A", definition: "a" } }).map(i => i.term), ["A"]);

  const { WIDE_QUERY } = await import("../lib/use-wide-layout");
  const listeners: Array<() => void> = [];
  let wide = true;
  const media = (q: string) => ({ get matches() { return q === WIDE_QUERY && wide; }, media: q,
    addEventListener(_: string, cb: () => void) { if (q === WIDE_QUERY) listeners.push(cb); }, removeEventListener() {} });
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: media });

  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { Reader } = await import("../components/Reader");
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {}, bfcacheId: "test" };
  const container = document.getElementById("root")!;
  const root = createRoot(container);
  const base: ReaderProps = { variantId: 7, articleId: 3, level: 2, title: "에이전트가 툴을 고르는 법",
    contentHtml: '<p>앞 <mark data-w="w1">에이전트</mark> 중간 <mark data-w="w2">설명문</mark> 끝</p>',
    glossary: { w1: { term: "에이전트", definition: "스스로 도구를 고르는 프로그램" }, w2: { term: "설명문", definition: "툴 설명" },
      w3: { term: "툴 호출", definition: "도구 실행" } },
    readingMinutes: 4, domainSlug: "llm", domainLabel: "LLM", sourceName: "Example", sourceUrl: "https://example.com/a",
    progressStatus: "started", quizScore: null };
  const render = (props: Partial<ReaderProps> = {}) => act(async () => {
    root.render(createElement(AppRouterContext.Provider, { value: router }, createElement(Reader, { ...base, ...props })));
  });
  const mark = (id: string) => container.querySelector(`mark[data-w="${id}"]`) as HTMLElement;
  const click = (id: string) => act(async () => { mark(id).dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  const current = () => [...container.querySelectorAll('aside [aria-current="true"]')].map(n => n.id);
  try {
    await render();
    const aside = container.querySelector('aside[aria-label="읽기 도구"]')!;
    assert.ok(aside, "wide reader shows the tool rail");
    assert.match(aside.textContent!, /이 글의 용어 3/);
    assert.deepEqual([...aside.querySelectorAll("li")].map(li => li.id), ["gloss-w1", "gloss-w2", "gloss-w3"]);
    assert.ok(aside.textContent!.includes("스스로 도구를 고르는 프로그램"), "rail shows definitions");
    assert.equal([...container.querySelectorAll("a")].filter(a => a.textContent === "다 읽었어요 · 퀴즈 풀기").length, 1);
    assert.ok(aside.textContent!.includes("다 읽었어요 · 퀴즈 풀기"));
    assert.ok(aside.textContent!.includes("원문 읽기 ↗"));
    assert.ok(!container.querySelector("header")!.textContent!.includes("원문 읽기"));
    assert.ok(container.querySelector("footer")!.textContent!.includes("원문 보기 ↗"), "attribution footer keeps the source link");
    assert.equal(mark("w1").getAttribute("aria-controls"), "gloss-w1");

    await click("w1");
    assert.deepEqual(current(), ["gloss-w1"]);
    assert.equal(container.querySelectorAll(".ac-def").length, 0, "wide mode never inserts inline definitions");
    assert.equal(mark("w1").getAttribute("aria-expanded"), "true");
    await click("w1");
    assert.deepEqual(current(), [], "same term toggles the highlight off");
    assert.equal(mark("w1").getAttribute("aria-expanded"), "false");
    await click("w1");
    await click("w2");
    assert.deepEqual(current(), ["gloss-w2"], "highlight moves to the new term");
    assert.equal(mark("w1").getAttribute("aria-expanded"), "false");
    await act(async () => { mark("w1").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    assert.deepEqual(current(), ["gloss-w1"], "keyboard activates terms too");

    await render({ progressStatus: "completed" });
    assert.ok(container.querySelector("aside")!.textContent!.includes("결과 보고 콘에 올리기"));
    await render({ progressStatus: "saved", quizScore: 0.8 });
    assert.ok(container.querySelector("aside")!.textContent!.includes("퀴즈 80점 · 문항 다시 보기"));

    // Width drops below the breakpoint: rail goes away, highlight state clears.
    await render();
    await click("w1");
    wide = false;
    await act(async () => { listeners.forEach(cb => cb()); });
    assert.equal(container.querySelector("aside"), null);
    assert.equal(mark("w1").getAttribute("aria-expanded"), "false");
    assert.equal(mark("w1").hasAttribute("aria-controls"), false);
    assert.ok(container.querySelector("header")!.textContent!.includes("원문 읽기"));
    await click("w1");
    assert.equal(container.querySelectorAll(".ac-def").length, 1, "narrow mode expands inline");
    wide = true;
    await act(async () => { listeners.forEach(cb => cb()); });
    assert.equal(container.querySelectorAll(".ac-def").length, 0, "switching to wide removes inline definitions");
    assert.equal(mark("w1").getAttribute("aria-expanded"), "false");

    await act(async () => root.unmount());
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: undefined });
    const root2 = createRoot(container);
    await act(async () => {
      root2.render(createElement(AppRouterContext.Provider, { value: router }, createElement(Reader, base)));
    });
    assert.equal(container.querySelector("aside"), null, "no matchMedia means narrow");
    await act(async () => { mark("w1").dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
    assert.equal(container.querySelectorAll(".ac-def").length, 1);
    await act(async () => root2.unmount());
    console.log("Reader wide: glossary order, rail contents, single CTA, term highlight toggle and width switching passed.");
  } finally {
    dom.window.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
