/** Credit receipt and compact balance states without network or a browser session. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://credits-ui.invalid/" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const userA = "11111111-1111-4111-8111-111111111111";
  const userB = "22222222-2222-4222-8222-222222222222";
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://credits-auth.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture", NEXT_PUBLIC_API_BASE: "" });
  dom.window.localStorage.setItem("artice-auth", JSON.stringify({
    access_token: "fixture", refresh_token: "refresh", token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userA, is_anonymous: false },
  }));
  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { CreditSummary } = await import("../components/CreditSummary");
  const { Result } = await import("../components/Result");
  const { default: CreditsPage } = await import("../app/(tabs)/credits/page");
  const { createClient } = await import("../lib/supabase/client");
  const container = document.getElementById("root")!;
  const root = createRoot(container);
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {},
    replace() {}, prefetch() {}, bfcacheId: "fixture" };
  const render = async (node: React.ReactNode) => {
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router }, node)); });
  };
  const originalFetch = globalThis.fetch;
  const pending: Array<(response: Response) => void> = [];
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "/api/credits");
    return new Promise<Response>((resolve) => { pending.push(resolve); });
  };
  const snapshot = (userId: string, balance: number) => Response.json({
    userId, balance, spendableBalance: balance, policyVersion: 1, earningMode: "active", spendingEnabled: false,
    hasWelcome: true, rules: { article: 10, quizBonusMax: 10, welcome: 100 },
  });
  try {
    await render(createElement(CreditSummary, { key: userA, userId: userA, compact: true }));
    assert.match(container.textContent!, /크레딧 불러오는 중/);
    assert.equal(pending.length, 1);
    await act(async () => { pending.shift()!(snapshot(userA, 118)); });
    assert.match(container.textContent!, /118/);
    await render(createElement(CreditSummary, { key: userB, userId: userB, compact: true }));
    assert.doesNotMatch(container.textContent!, /118/, "old account balance must clear immediately");
    await act(async () => { pending.shift()!(snapshot(userA, 118)); });
    assert.doesNotMatch(container.textContent!, /118/, "wrong account response must be rejected");

    const base = { score: 0.75, correct: 3, total: 4, review: [], prevLevel: null,
      newLevel: null, dir: "유지" as const, rollingAccuracy: null, domain: "cloud",
      domainLabel: "클라우드", articleId: 1, isReview: false, sourceUrl: null,
      canSave: true, credits: { status: "granted" as const, newlyGranted: 118,
        articleReward: { base: 10, bonus: 8, total: 18 }, welcomeReward: 100,
        balance: 118, policyVersion: 1 } };
    await render(createElement(Result, { articleTitle: "Test", result: base }));
    assert.match(container.textContent!, /이번 학습으로 \+118크레딧/);
    assert.match(container.textContent!, /첫 학습 축하 \+100/);
    assert.match(container.querySelector('[aria-label="크레딧 적립 결과"]')?.className ?? "", /motion-safe:animate/);
    await render(createElement(Result, { articleTitle: "Test", result: {
      ...base, isReview: true, canSave: false,
      credits: { ...base.credits, status: "already_granted", newlyGranted: 0 },
    } }));
    assert.match(container.textContent!, /복습은 크레딧이 추가 적립되지 않아요/);
    assert.doesNotMatch(container.textContent!, /이번 학습으로 \+118/);
    assert.doesNotMatch(container.querySelector('[aria-label="크레딧 적립 결과"]')?.className ?? "", /motion-safe:animate/);
    await render(createElement(Result, { articleTitle: "Test", result: {
      ...base, credits: { ...base.credits, status: "disabled", newlyGranted: 0 },
    } }));
    assert.match(container.textContent!, /크레딧 적립을 준비 중/);
    globalThis.fetch = async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://credits-auth.invalid/auth/v1/user") {
        return Response.json({ id: userA, is_anonymous: false });
      }
      if (url === "/api/credits") return snapshot(userA, 118);
      if (url === "/api/credits/history") return Response.json({ userId: userA,
        events: [{ id: "2", amount: 8, reason: "quiz_bonus", createdAt: "2026-10-25T01:00:00+00:00",
          articleId: "1", articleTitle: "테스트 기사" }], nextCursor: "next" });
      if (url === "/api/credits/history?cursor=next") return Response.json({ userId: userA,
        events: [{ id: "1", amount: 10, reason: "article_read", createdAt: "2026-10-25T01:00:00+00:00",
          articleId: "1", articleTitle: "테스트 기사" }], nextCursor: null });
      throw new Error(`Unexpected ${url}`);
    };
    await render(createElement(CreditsPage));
    await act(async () => { await Promise.resolve(); });
    assert.match(container.textContent!, /118/);
    assert.match(container.textContent!, /테스트 기사/);
    const more = [...container.querySelectorAll("button")].find(button => button.textContent === "더 보기");
    assert.ok(more);
    await act(async () => { more.click(); });
    assert.equal(container.querySelectorAll("li").length, 2);
    console.log("Credits UI: balance loading, account isolation, receipt, review, inactive and history pagination passed.");
  } finally {
    globalThis.fetch = originalFetch;
    await act(async () => { root.unmount(); });
    createClient().auth.stopAutoRefresh();
    dom.window.close();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
