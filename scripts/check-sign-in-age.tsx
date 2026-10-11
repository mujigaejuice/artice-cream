/** Isolated React/Supabase test: age confirmation precedes login; no real emails. */
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
    await act(async () => { age.click(); });
    assert.equal(send.disabled, true, "unchecking age also blocks an already-filled email");
    await act(async () => { send.click(); });
    assert.equal(emails, 0);
    await act(async () => { age.click(); });
    await act(async () => { send.click(); });
    assert.equal(emails, 1);
    assert.match(container.textContent!, /로그인 링크를 보냈어요/);
    assert.equal(container.querySelector('input[type="date"]'), null, "no birthdate collection");
    console.log("Sign-in: explicit age confirmation required for both providers; email flow passed.");
  } finally {
    await act(async () => { root.unmount(); });
    await createClient().auth.stopAutoRefresh();
    dom.window.close();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
