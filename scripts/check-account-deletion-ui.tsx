/** React DOM + real Supabase client with isolated storage/HTTP. No real accounts or emails. */
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

async function main() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "https://app.invalid/account/delete/" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, self: dom.window,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://auth-test.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key", NEXT_PUBLIC_API_BASE: "https://app.invalid" });
  const account = { userId: "11111111-1111-4111-8111-111111111111", email: "reader@example.test", canDelete: true };
  let canDelete = true;
  let postStatus = 200;
  let posts = 0;
  let emails = 0;
  let logoutStatus = 204;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === "https://app.invalid" && url.pathname === "/api/account/delete") {
      if (init?.method === "POST") {
        posts++;
        assert.deepEqual(JSON.parse(String(init.body)), { expectedUserId: account.userId, confirmation: "계정 삭제" });
        return postStatus === 200 ? Response.json({ deleted: true }) :
          Response.json({ error: "reauthentication_required" }, { status: postStatus });
      }
      return new Headers(init?.headers).has("authorization") ? Response.json({ ...account, canDelete }) :
        Response.json({ error: "unauthenticated" }, { status: 401 });
    }
    assert.equal(url.origin, "https://auth-test.invalid", "unexpected network destination");
    if (url.pathname === "/auth/v1/otp") {
      emails++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.email, account.email);
      assert.equal(body.create_user, false);
      assert.equal(url.searchParams.get("redirect_to"), "https://app.invalid/auth/callback");
      return Response.json({});
    }
    assert.equal(url.pathname, "/auth/v1/logout", "unexpected auth request");
    if (logoutStatus !== 204) return Response.json({ msg: "test failure" }, { status: logoutStatus });
    return new Response(null, { status: 204 });
  };
  const session = JSON.stringify({ access_token: "test-access-token", refresh_token: "test-refresh-token",
    token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: account.userId, email: account.email, is_anonymous: false } });
  dom.window.localStorage.setItem("artice-auth", session);
  // Import React DOM after installing the DOM so input events use the browser implementation.
  const { createRoot } = await import("react-dom/client");
  const { DeleteAccountForm } = await import("../components/DeleteAccountForm");
  const { createClient } = await import("../lib/supabase/client");
  const { rememberDeletionReturn, consumeDeletionReturn } = await import("../lib/deletion-return");
  const client = createClient();
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  const flush = async () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      await act(async () => { await delay(10); });
      if (!container.querySelector('[aria-busy="true"]')) return;
    }
    assert.fail(`form did not settle: ${container.textContent}`);
  };
  const mount = async () => {
    await act(async () => { root.render(null); });
    await act(async () => { root.render(createElement(DeleteAccountForm)); });
    await flush();
  };
  const button = (label: string) => {
    const found = [...container.querySelectorAll("button")].find((item) => item.textContent === label);
    assert.ok(found, `missing button: ${label}`);
    return found;
  };
  const click = async (element: HTMLElement) => {
    await act(async () => { element.click(); });
    await flush();
  };
  const fill = async (id: string, value: string) => {
    const input = container.querySelector<HTMLInputElement>(`#${id}`);
    assert.ok(input, `missing input: ${id}`);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
  };
  try {
    await mount();
    assert.match(container.textContent!, /reader@example.test/);
    assert.equal(button("계정과 데이터 영구 삭제").disabled, true);
    await fill("delete-confirmation", "삭제");
    assert.equal(button("계정과 데이터 영구 삭제").disabled, true);
    assert.equal(posts, 0, "loading and typing cannot delete an account");

    // Cancelling a pending email confirmation must not redirect a later ordinary login here.
    rememberDeletionReturn();
    const cancel = [...container.querySelectorAll("a")].find((item) => item.textContent === "취소하고 돌아가기")!;
    // Stop actual navigation, after the React handler has received the bubbling click.
    dom.window.document.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await click(cancel);
    assert.equal(consumeDeletionReturn("/"), "/", "cancel must clear the deletion return hint");
    assert.equal(posts, 0);

    // Switching accounts clears the old return hint only after logout succeeds.
    rememberDeletionReturn();
    logoutStatus = 400;
    await click(button("다른 계정으로 확인"));
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /로그아웃하지 못했어요/);
    assert.ok(dom.window.localStorage.getItem("artice-delete-return"));
    logoutStatus = 204;
    // The SDK can clear local auth even when the logout endpoint rejects the request.
    dom.window.localStorage.setItem("artice-auth", session);
    await mount();
    await click(button("다른 계정으로 확인"));
    assert.equal(consumeDeletionReturn("/"), "/");
    assert.ok(container.querySelector("#deletion-email"), container.textContent ?? "empty form");
    assert.equal(posts, 0);

    // Email verification requests never delete; a later callback must return to deletion.
    await fill("deletion-email", account.email);
    await click(button("본인 확인 링크 받기"));
    assert.equal(emails, 1);
    assert.equal(posts, 0);
    assert.equal(consumeDeletionReturn("/"), "/account/delete/");
    assert.match(container.querySelector('[role="status"]')!.textContent!, /최종 버튼/);

    // Expired reauthentication returns to the email form and clears confirmation text.
    dom.window.localStorage.setItem("artice-auth", session);
    postStatus = 403;
    await mount();
    await fill("delete-confirmation", "계정 삭제");
    await click(button("계정과 데이터 영구 삭제"));
    assert.equal(posts, 1);
    assert.ok(container.querySelector("#deletion-email"));
    assert.equal(container.querySelector("#delete-confirmation"), null);
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /본인 확인 시간이 지났어요/);

    // After explicit confirmation, display success and clear both session and return hint.
    postStatus = 200;
    canDelete = true;
    await mount();
    rememberDeletionReturn();
    await fill("delete-confirmation", "계정 삭제");
    await click(button("계정과 데이터 영구 삭제"));
    assert.equal(posts, 2);
    assert.match(container.textContent!, /계정 삭제가 완료됐어요/);
    assert.equal(dom.window.localStorage.getItem("artice-auth"), null);
    assert.equal(consumeDeletionReturn("/"), "/");
    console.log("Account deletion UI: cancellation, account switch, email request, explicit confirmation, reauthentication and cleanup passed.");
  } finally {
    await act(async () => { root.unmount(); });
    await client.auth.stopAutoRefresh();
    dom.window.close();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
