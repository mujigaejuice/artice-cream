/** Reader → quiz → result keyboard flow in jsdom; fake grade/save APIs, no network. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement, type ReactNode } from "react";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://keyboard.invalid/read/quiz?v=7", pretendToBeVisual: true });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://keyboard-auth.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture", NEXT_PUBLIC_API_BASE: "" });
  dom.window.localStorage.setItem("artice-auth", JSON.stringify({ access_token: "fixture", refresh_token: "refresh",
    token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "fixture-user", is_anonymous: false } }));
  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { Quiz } = await import("../components/Quiz");
  const { OnboardingQuiz } = await import("../components/OnboardingQuiz");
  const { Result } = await import("../components/Result");
  const { createClient } = await import("../lib/supabase/client");
  const container = document.getElementById("root")!;
  const root = createRoot(container);
  const pushes: string[] = [];
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, prefetch() {}, bfcacheId: "test",
    push(href: string) { pushes.push(href); }, replace() {} };
  const render = async (node: ReactNode) => {
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router }, node)); });
  };
  const press = async (target: Element, key: string, init: KeyboardEventInit = {}) => {
    await act(async () => {
      target.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
    });
  };
  // Compare elements with === inside assert.ok: a failed assert.equal on jsdom nodes exhausts memory while printing them.
  const focused = () => document.activeElement!;
  const originalFetch = globalThis.fetch;
  let gradeCalls = 0;
  let saveCalls = 0;
  let releaseGrade: (() => void) | null = null;
  globalThis.fetch = async (input) => {
    const path = new URL(String(input), "https://keyboard.invalid").pathname;
    if (path === "/api/progress/save") { saveCalls++; return Response.json({ scoopId: 9 }); }
    assert.equal(path, "/api/quiz/grade");
    gradeCalls++;
    await new Promise<void>(resolve => { releaseGrade = resolve; });
    return Response.json({ score: 1, correct: 3, total: 3, review: [], prevLevel: null, newLevel: null, dir: "유지",
      rollingAccuracy: null, domain: "cloud", domainLabel: "클라우드", articleId: 1, variantId: 7, isReview: true,
      sourceUrl: null, canSave: false });
  };
  try {
    // Article quiz: radio group, digits, arrows, Enter.
    const questions = [
      { id: 1, position: 1, prompt: "문제 1", options: ["가", "나", "다", "라"] },
      { id: 2, position: 2, prompt: "문제 2", options: ["가", "나", "다", "라"] },
      { id: 3, position: 3, prompt: "문제 3", options: ["예", "아니오"] },
    ];
    await render(createElement(Quiz, { variantId: 7, articleTitle: "글", questions, isOriginal: true, isPractice: true }));
    const group = () => container.querySelector('[role="radiogroup"]')!;
    const radios = () => [...container.querySelectorAll('[role="radio"]')] as HTMLElement[];
    assert.ok(group(), "options form a radio group");
    assert.equal(group().getAttribute("aria-labelledby"), container.querySelector("h1")!.id);
    assert.ok(container.querySelector("h1")!.id, "question heading has an id");
    assert.ok(focused() === radios()[0], "first option focused on mount");
    assert.deepEqual(radios().map(r => r.tabIndex), [0, -1, -1, -1], "roving tabindex");
    await press(focused(), "3");
    assert.equal(radios()[2].getAttribute("aria-checked"), "true");
    assert.ok(focused() === radios()[2], "focus");
    assert.deepEqual(radios().map(r => r.tabIndex), [-1, -1, 0, -1]);
    await press(focused(), "ArrowDown");
    assert.equal(radios()[3].getAttribute("aria-checked"), "true");
    await press(focused(), "ArrowDown");
    assert.equal(radios()[0].getAttribute("aria-checked"), "true", "wraps to first");
    await press(focused(), "ArrowUp");
    assert.equal(radios()[3].getAttribute("aria-checked"), "true", "wraps to last");
    await press(focused(), "Enter", { isComposing: true });
    assert.match(container.textContent!, /1\/3/, "composing Enter ignored");
    await press(focused(), "Enter");
    assert.match(container.textContent!, /2\/3/);
    assert.ok(focused() === radios()[0], "focus moves to the new question");
    await press(focused(), "Enter");
    assert.match(container.textContent!, /2\/3/, "Enter without a choice does nothing");
    const previous = [...container.querySelectorAll("button")].find(b => b.textContent === "이전")!;
    (previous as HTMLElement).focus();
    await press(previous, "2");
    assert.equal(radios().some(r => r.getAttribute("aria-checked") === "true"), false, "digits only work inside the group");
    radios()[0].focus();
    await press(focused(), "2"); await press(focused(), "Enter");
    assert.match(container.textContent!, /3\/3/);
    await press(focused(), "3");
    assert.equal(radios().some(r => r.getAttribute("aria-checked") === "true"), false, "digits beyond option count are ignored");
    assert.match(container.textContent!, /숫자 키\(1–2\)로 고르고 Enter로 넘어가요/);
    const hint = [...container.querySelectorAll("p")].find(p => p.textContent!.startsWith("숫자 키"))!;
    assert.match(hint.className, /\bhidden\b/);
    assert.match(hint.className, /lg:block/);
    await press(focused(), "1");
    await press(focused(), "Enter"); await press(focused(), "Enter");
    assert.equal(gradeCalls, 1, "repeated Enter while grading submits once");
    await act(async () => { releaseGrade?.(); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.match(container.textContent!, /100점/);

    // Onboarding level quiz: native radios, 1–5 including 모르겠어요, Enter = 다음.
    const done: Array<Array<number | null>> = [];
    await render(createElement(OnboardingQuiz, { key: "onboarding",
      domain: { id: 1, slug: "cloud", name_ko: "클라우드", name_en: null, rss_topic: null, active: true },
      questions: [{ prompt: "온보딩 1", options: ["가", "나", "다", "라"] }, { prompt: "온보딩 2", options: ["가", "나", "다", "라"] }],
      position: { index: 0, total: 1 }, onDone: (answers: Array<number | null>) => { done.push(answers); }, onSkip() {} }));
    const inputs = () => [...container.querySelectorAll('fieldset input[type="radio"]')] as HTMLInputElement[];
    assert.equal(inputs().length, 5);
    assert.ok(focused() === inputs()[0], "first option focused on mount");
    await press(focused(), "Enter");
    assert.match(container.textContent!, /온보딩 1/, "Enter without a choice does nothing");
    await press(focused(), "6");
    assert.equal(inputs().some(input => input.checked), false, "digits beyond the options are ignored");
    await press(focused(), "5");
    assert.equal(inputs()[4].checked, true, "5 picks 모르겠어요");
    assert.ok(focused() === inputs()[4], "focus");
    await press(focused(), "Enter", { isComposing: true });
    assert.match(container.textContent!, /온보딩 1/, "composing Enter ignored");
    await press(focused(), "Enter");
    assert.match(container.textContent!, /온보딩 2/);
    assert.ok(focused() === inputs()[0], "next step focuses the first option");
    await press(focused(), "2"); await press(focused(), "Enter");
    assert.deepEqual(done, [[null, 1]]);
    const onboardingHint = [...container.querySelectorAll("p")].find(p => p.textContent!.startsWith("숫자 키"));
    assert.equal(onboardingHint?.textContent, "숫자 키(1–5)로 고르고 Enter로 넘어가요");
    assert.match(onboardingHint!.className, /\bhidden\b/);
    assert.match(onboardingHint!.className, /lg:block/);

    // Result: score focused first, plain Enter = the main black button.
    const graded = { score: 0.75, correct: 3, total: 4, review: [], prevLevel: null, newLevel: null, dir: "유지" as const,
      rollingAccuracy: null, domain: "cloud", domainLabel: "클라우드", articleId: 1, variantId: 7, isReview: false,
      sourceUrl: "https://source.invalid/a", canSave: true };
    const settle = () => act(async () => { for (let i = 0; i < 3; i++) await new Promise(resolve => setTimeout(resolve, 0)); });
    await render(createElement(Result, { key: "save", result: graded, articleTitle: "글" }));
    const score = container.querySelector("h1")!;
    assert.match(score.textContent!, /75점/);
    assert.ok(focused() === score, "score is focused first");
    assert.equal(score.tabIndex, -1);
    await press(score, "Enter", { isComposing: true });
    await press(score, "Enter", { repeat: true });
    await press(score, "Enter", { ctrlKey: true });
    await settle();
    assert.equal(saveCalls, 0, "composing, repeated and modified Enter do not save");
    const sourceLink = [...container.querySelectorAll("a")].find(a => a.textContent === "원문 보기 ↗")!;
    sourceLink.focus();
    await press(sourceLink, "Enter");
    const outside = document.createElement("button");
    outside.textContent = "계속 읽기";
    document.body.append(outside);
    outside.focus();
    await press(outside, "Enter");
    outside.remove();
    await settle();
    assert.equal(saveCalls, 0, "Enter on a link or a dialog button keeps its own behavior");
    const primary = container.querySelector('[aria-keyshortcuts="Enter"]')!;
    assert.equal(primary.textContent, "콘에 올리기 🍦");
    const kbd = [...container.querySelectorAll("span")].find(span => span.textContent === "Enter")!;
    assert.match(kbd.className, /\bhidden\b/);
    assert.match(kbd.className, /lg:block/);
    score.focus();
    await press(score, "Enter"); await press(score, "Enter");
    await settle();
    assert.equal(saveCalls, 1, "Enter saves once");
    assert.deepEqual(pushes, ["/cone?new=9"]);
    await press(document.body, "Enter");
    await settle();
    assert.equal(saveCalls, 1, "no second save after saving");

    await render(createElement(Result, { key: "review", result: { ...graded, isReview: true, canSave: false }, articleTitle: "글" }));
    await press(document.body, "Enter");
    await settle();
    assert.equal(saveCalls, 1, "review results never call save");
    assert.equal(pushes.at(-1), "/", "Enter goes home when saving is not possible");
    assert.equal(container.querySelector('[aria-keyshortcuts="Enter"]')!.textContent, "홈으로");

    console.log("Keyboard flow: quiz radio group, digits, arrows, Enter next/submit, composing and grading guards; onboarding 1–5 and Enter passed.");
  } finally {
    await act(async () => root.unmount());
    createClient().auth.stopAutoRefresh();
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
