/** Isolated tutorial + login test. Every network request is mocked; no real emails. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://app.invalid/onboarding/" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://age-test.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key" });
  let emails = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://age-test.invalid");
    assert.equal(url.pathname, "/auth/v1/otp");
    assert.equal(JSON.parse(String(init?.body)).email, "reader@example.test");
    emails++;
    return Response.json({});
  };
  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { OnboardingFlow } = await import("../components/OnboardingFlow");
  const { createClient } = await import("../lib/supabase/client");
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {}, bfcacheId: "test" };
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  try {
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router },
      createElement(OnboardingFlow, { domains: [], initialLevels: {}, domainTerms: {}, isSignedIn: false }))); });
    const button = (label: string) => {
      const found = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === label);
      assert.ok(found, `button: ${label}`);
      return found;
    };
    const title = () => container.querySelector("h1")!.textContent!;
    const loginHidden = () => container.querySelector('[aria-label="로그인"]')!.parentElement!.hidden;
    assert.match(title(), /내 속도로/);
    assert.equal(loginHidden(), true);
    assert.ok(container.querySelector('a[href^="/privacy"]'));
    assert.ok(container.querySelector('a[href^="/account/delete"]'));
    await act(async () => { button("다음").click(); });
    assert.match(title(), /모르는 말/);
    await act(async () => { button("캐시").click(); });
    assert.match(container.querySelector("#intro-term")!.textContent!, /잠시 저장/);
    await act(async () => { button("모든 정보를 영구히 보관해요").click(); });
    assert.match(container.querySelector('[role="status"]')!.textContent!, /다시 골라/);
    await act(async () => { button("자주 쓰는 정보를 빠르게 꺼내요").click(); });
    assert.match(container.querySelector('[role="status"]')!.textContent!, /맞아요/);
    const panel = container.querySelector<HTMLElement>('[aria-label="서비스 소개"]')!;
    // Vertical movement should scroll, while a deliberate horizontal swipe advances.
    async function swipe(dx: number, dy: number) {
      await act(async () => {
        const start = new dom.window.Event("touchstart", { bubbles: true });
        Object.defineProperty(start, "touches", { value: [{ clientX: 200, clientY: 100 }] });
        panel.dispatchEvent(start);
        const end = new dom.window.Event("touchend", { bubbles: true });
        Object.defineProperty(end, "changedTouches", { value: [{ clientX: 200 + dx, clientY: 100 + dy }] });
        panel.dispatchEvent(end);
      });
    }
    await swipe(-80, 120);
    assert.match(title(), /모르는 말/);
    await swipe(-100, 0);
    assert.match(title(), /나만의 콘/);
    const scoop = container.querySelector<SVGElement>('svg [role="button"]')!;
    await act(async () => { scoop.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
    assert.match(container.querySelector('[role="status"]')!.textContent!, /클라우드/);
    await act(async () => { panel.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
    assert.equal(loginHidden(), false);
    assert.match(title(), /첫 스쿱/);
    assert.equal(emails, 0, "tutorial never reads articles or writes progress");
    const age = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const email = container.querySelector<HTMLInputElement>('input[type="email"]')!;
    const google = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("구글로"))!;
    const send = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("링크 받기"))!;
    assert.equal(age.checked, false);
    assert.equal(email.disabled, true);
    assert.equal(google.disabled, true);
    assert.equal(send.disabled, true);
    await act(async () => { google.click(); send.click(); });
    assert.equal(emails, 0);
    await act(async () => { age.click(); });
    assert.equal(google.disabled, false);
    assert.equal(email.disabled, false);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(email, "reader@example.test");
      email.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    assert.equal(send.disabled, false);
    await act(async () => { button("사용법 보기").click(); });
    assert.equal(loginHidden(), true);
    await act(async () => { button("바로 로그인").click(); });
    assert.equal(loginHidden(), false);
    assert.equal(email.value, "reader@example.test", "tutorial revisit preserves the email");
    assert.equal(age.checked, true);
    await act(async () => { age.click(); });
    assert.equal(send.disabled, true, "unchecking age also blocks an already-filled email");
    await act(async () => { send.click(); });
    assert.equal(emails, 0);
    await act(async () => { age.click(); });
    await act(async () => { send.click(); });
    assert.equal(emails, 1);
    assert.match(container.textContent!, /로그인 링크를 보냈어요/);
    assert.equal(container.querySelector('input[type="date"]'), null, "no birthdate collection");
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router },
      createElement(OnboardingFlow, { key: "failed", domains: [], initialLevels: {}, domainTerms: {}, isSignedIn: false, authFailed: true }))); });
    assert.equal(loginHidden(), false, "failed auth returns directly to login");
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /다시 시도/);
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router },
      createElement(OnboardingFlow, { key: "direct", domains: [], initialLevels: {}, domainTerms: {}, isSignedIn: false, startAtLogin: true }))); });
    assert.equal(loginHidden(), false, "privacy return link opens login directly");
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router },
      createElement(OnboardingFlow, { domains: [], initialLevels: {}, domainTerms: {}, isSignedIn: true }))); });
    assert.match(title(), /어떤 뉴스를/);
    assert.equal(container.querySelector('[aria-label="서비스 소개"]'), null);
    const { default: OnboardingPage } = await import("../app/onboarding/page");
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router },
      createElement(OnboardingPage))); });
    assert.match(title(), /내 속도로/, "signed-out page shows tutorial without an API call");
    assert.equal(emails, 1);
    console.log("Tutorial: navigation, swipe, examples, login shortcuts and state retention passed. Age gate + mock email passed.");
  } finally {
    await act(async () => { root.unmount(); });
    await createClient().auth.stopAutoRefresh();
    dom.window.close();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
