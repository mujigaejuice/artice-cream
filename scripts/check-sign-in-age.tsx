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
  let expectedEmail = "reader@example.test";
  let otpStatus = 200;
  let verifyStatus = 400;
  let verifies = 0;
  let onboardingLoads = 0;
  let navigations = 0;
  let expectedCode = "012345";
  const receivedEmails: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), "https://app.invalid");
    if (url.origin === "https://app.invalid" && url.pathname === "/api/onboarding") {
      onboardingLoads++;
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-access-token");
      return Response.json({ domains: [{ id: 1, slug: "cloud", name_ko: "클라우드" }], levels: {}, domainTerms: {}, isSignedIn: true });
    }
    assert.equal(url.origin, "https://age-test.invalid");
    if (url.pathname === "/auth/v1/verify") {
      verifies++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.email, expectedEmail);
      assert.equal(body.token, expectedCode, "leading zeroes survive verification");
      assert.equal(body.type, "email");
      return verifyStatus === 200 ? Response.json({ access_token: "test-access-token", refresh_token: "test-refresh-token",
        token_type: "bearer", expires_in: 3600, user: { id: "reader-id", email: expectedEmail } }) :
        Response.json({ code: verifyStatus === 429 ? "over_request_rate_limit" : "otp_expired", msg: "Invalid or expired OTP" }, { status: verifyStatus });
    }
    assert.equal(url.pathname, "/auth/v1/otp");
    receivedEmails.push(JSON.parse(String(init?.body)).email);
    assert.equal(receivedEmails.at(-1), expectedEmail);
    assert.equal(JSON.parse(String(init?.body)).create_user, true);
    assert.equal(url.searchParams.has("redirect_to"), false, "email codes need no browser redirect");
    emails++;
    return Response.json(otpStatus === 200 ? {} : otpStatus === 500
      ? { code: "unexpected_failure", msg: "Error sending confirmation email" }
      : { code: "over_email_send_rate_limit", msg: "Too many requests" }, { status: otpStatus });
  };
  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { OnboardingFlow } = await import("../components/OnboardingFlow");
  const { createClient } = await import("../lib/supabase/client");
  const router = { back() {}, forward() {}, refresh() { navigations++; }, hmrRefresh() {}, push() { navigations++; }, replace() { navigations++; }, prefetch() {}, bfcacheId: "test" };
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
    // SDK의 PKCE 암호화는 React act 밖의 비동기 작업이므로 완료 상태까지 기다린다.
    async function finishLogin() {
      const ageInput = () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      for (let i = 0; i < 200 && ageInput().disabled; i++) {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
      }
      assert.equal(ageInput().disabled, false, "login request should settle and unlock the form");
    }
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
    const send = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("인증번호 받기"))!;
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
    await finishLogin();
    assert.equal(emails, 1);
    assert.match(container.textContent!, /인증번호를 보냈어요/);
    assert.equal(container.querySelector('input[type="date"]'), null, "no birthdate collection");
    await act(async () => { age.click(); });
    const beforeBlocked = emails;
    await act(async () => { button("인증번호 다시 받기").click(); });
    assert.equal(emails, beforeBlocked, "resend also requires the age confirmation");
    await act(async () => { age.click(); });
    const beforeResend = emails;
    await act(async () => { button("인증번호 다시 받기").click(); button("인증번호 다시 받기").click(); });
    await finishLogin();
    assert.equal(emails, beforeResend + 1, "same-tick double click sends only one request");
    otpStatus = 429;
    await act(async () => { button("인증번호 다시 받기").click(); });
    await finishLogin();
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /잠시 기다린/);
    assert.equal(button("인증번호 다시 받기").disabled, false);
    assert.ok(container.querySelector('input[autocomplete="one-time-code"]'), "failed resend keeps code entry available");
    otpStatus = 500;
    await act(async () => { button("인증번호 다시 받기").click(); });
    await finishLogin();
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /발송 서비스에 문제/);
    assert.doesNotMatch(container.querySelector('[role="alert"]')!.textContent!, /주소와 연결/);
    assert.equal(button("인증번호 다시 받기").disabled, false);
    assert.ok(container.querySelector('input[autocomplete="one-time-code"]'), "SMTP failure preserves code entry for a previous email");
    otpStatus = 200;
    await act(async () => { button("인증번호 다시 받기").click(); });
    await finishLogin();
    await act(async () => { button("이메일 주소 수정").click(); });
    const corrected = container.querySelector<HTMLInputElement>('input[type="email"]')!;
    assert.equal(corrected.value, "reader@example.test");
    expectedEmail = "corrected@example.test";
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(corrected, expectedEmail);
      corrected.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    const auth = createClient().auth;
    const originalOtp = auth.signInWithOtp;
    auth.signInWithOtp = async () => { throw new Error("unhandled transport failure"); };
    await act(async () => { button("인증번호 받기").click(); });
    await finishLogin();
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /연결을 확인/);
    assert.equal(button("인증번호 받기").disabled, false, "unexpected exception releases the form");
    auth.signInWithOtp = originalOtp;
    otpStatus = 500;
    await act(async () => { button("인증번호 받기").click(); });
    await finishLogin();
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /발송 서비스에 문제/);
    assert.equal(container.querySelector('[role="status"]'), null, "SMTP failure must not claim an email was sent");
    assert.equal(button("인증번호 받기").disabled, false);
    otpStatus = 200;
    await act(async () => { button("인증번호 받기").click(); });
    await finishLogin();
    assert.ok(container.querySelector('[role="status"]'), JSON.stringify({ receivedEmails, text: container.textContent }));
    assert.match(container.querySelector('[role="status"]')!.textContent!, /corrected@example.test/);
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
    assert.equal(onboardingLoads, 0);
    await act(async () => { button("바로 로그인").click(); });
    const pageAge = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => { pageAge.click(); });
    async function fill(selector: string, value: string) {
      const input = container.querySelector<HTMLInputElement>(selector)!;
      assert.ok(input, `input: ${selector}`);
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      });
    }
    await fill('input[type="email"]', expectedEmail);
    await act(async () => { button("인증번호 받기").click(); });
    await finishLogin();
    const codeSelector = 'input[autocomplete="one-time-code"]';
    assert.equal(button("인증번호 확인하고 로그인").disabled, true);
    await fill(codeSelector, "12ab56");
    assert.equal(button("인증번호 확인하고 로그인").disabled, true);
    await fill(codeSelector, "012 345");
    await act(async () => { pageAge.click(); });
    await act(async () => { button("인증번호 확인하고 로그인").click(); });
    assert.equal(verifies, 0, "verification also requires age confirmation");
    await act(async () => { pageAge.click(); });
    await act(async () => { button("인증번호 확인하고 로그인").click(); button("인증번호 확인하고 로그인").click(); });
    await finishLogin();
    assert.equal(verifies, 1, "double verification clicks make one request");
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /올바르지 않거나 만료/);
    assert.equal(dom.window.localStorage.getItem("artice-auth"), null);
    verifyStatus = 429;
    await act(async () => { button("인증번호 확인하고 로그인").click(); });
    await finishLogin();
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /잠시 기다린/);
    const originalVerify = auth.verifyOtp;
    auth.verifyOtp = async () => { throw new Error("connection interrupted"); };
    await act(async () => { button("인증번호 확인하고 로그인").click(); });
    await finishLogin();
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /연결을 확인/);
    auth.verifyOtp = originalVerify;
    // A project configured for eight digits works too; the code remains a string.
    expectedCode = "00123456";
    await fill(codeSelector, expectedCode);
    verifyStatus = 200;
    await act(async () => { button("인증번호 확인하고 로그인").click(); });
    for (let attempt = 0; attempt < 100 && !container.textContent?.includes("어떤 뉴스를"); attempt++) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
    }
    assert.match(title(), /어떤 뉴스를/, "OTP completes in the requesting page");
    assert.equal(onboardingLoads, 1, "fetch authenticated onboarding data once after verification");
    assert.ok((await auth.getSession()).data.session);
    assert.equal(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked, true, "new domains initialize after login");
    assert.equal(navigations, 0, "no callback navigation or page refresh required");
    console.log("Tutorial + email OTP: age gate, resend, rate limits, invalid/expired codes, duplicate clicks, recovery and same-page login passed.");
  } finally {
    await act(async () => { root.unmount(); });
    await createClient().auth.stopAutoRefresh();
    dom.window.close();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
