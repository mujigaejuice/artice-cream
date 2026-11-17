/** Onboarding flow: pick domains, take the level quiz per new domain, save once, show the result.
 * Every network request is mocked. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

type Body = { selections: Record<string, unknown>[] };

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://app.invalid/onboarding/" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://onboarding-ui.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key" });

  const posts: Body[] = [];
  let failuresLeft = 0;
  let results: unknown[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), "https://app.invalid");
    if (url.pathname === "/auth/v1/user" || url.origin === "https://onboarding-ui.invalid") return Response.json({}, { status: 401 });
    assert.equal(url.pathname, "/api/onboarding");
    assert.equal(init?.method, "POST");
    posts.push(JSON.parse(String(init?.body)));
    if (failuresLeft > 0) { failuresLeft--; return Response.json({ error: "down" }, { status: 503 }); }
    return Response.json({ ok: true, added: 1, results });
  };

  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { OnboardingFlow } = await import("../components/OnboardingFlow");
  const pushes: string[] = [];
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push(href: string) { pushes.push(href); },
    replace() {}, prefetch() {}, bfcacheId: "test" };

  const domains = [
    { id: 1, slug: "cloud", name_ko: "클라우드", name_en: "Cloud", rss_topic: null, active: true },
    { id: 2, slug: "data", name_ko: "데이터", name_en: "Data", rss_topic: null, active: true },
    { id: 3, slug: "economy", name_ko: "경제", name_en: "Economy", rss_topic: null, active: true },
  ];
  const quiz = (name: string) => Array.from({ length: 8 }, (_, n) => ({
    prompt: `${name} 문제 ${n + 1}`, options: [0, 1, 2, 3].map((o) => `${name} ${n + 1}번 보기 ${o}`),
  }));
  const quizzes = { "1": quiz("클라우드"), "2": quiz("데이터") };

  const container = dom.window.document.getElementById("root")!;
  const text = () => container.textContent ?? "";
  const buttons = () => [...container.querySelectorAll<HTMLButtonElement>("button")];
  const button = (label: string) => {
    const found = buttons().find((item) => item.textContent === label || item.getAttribute("aria-label") === label);
    assert.ok(found, `button "${label}" in: ${text().slice(0, 160)}`);
    return found;
  };
  const radios = () => [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
  const click = (element: HTMLElement) => act(async () => { element.click(); });
  const domainBox = (name: string) => {
    const label = [...container.querySelectorAll("label")].find((item) => item.textContent?.includes(name));
    assert.ok(label, `domain row ${name}`);
    return label.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  };

  /** Answer one domain: option numbers 0..3, or "idk" for 모르겠어요. */
  async function answerAll(choices: (number | "idk")[]) {
    for (const choice of choices) {
      assert.equal(radios().length, 5, "four options plus 모르겠어요");
      assert.equal(button("다음").disabled, true, "no next before choosing");
      await click(radios()[choice === "idk" ? 4 : choice]);
      assert.equal(button("다음").disabled, false);
      await click(button("다음"));
    }
  }

  async function mount(props: { initialLevels?: Record<string, number>; quizzes?: Record<string, ReturnType<typeof quiz>> } = {}) {
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(AppRouterContext.Provider, { value: router },
        createElement(OnboardingFlow, { domains, initialLevels: props.initialLevels ?? {}, quizzes: props.quizzes ?? quizzes,
          isSignedIn: true })));
    });
    return root;
  }
  async function unmount(root: ReturnType<typeof createRoot>) { await act(async () => { root.unmount(); }); posts.length = 0; pushes.length = 0; }

  // 1. Full path: quiz one domain, skip another, one save, one result screen.
  let root = await mount();
  assert.match(container.querySelector("h1")!.textContent!, /어떤 뉴스를 읽을까요/);
  assert.equal([...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].filter((box) => box.checked).length, 0,
    "nothing is selected at first");
  assert.equal(button("한 개 이상 골라 주세요").disabled, true);
  await click(domainBox("클라우드"));
  await click(domainBox("데이터"));
  await click(button("다음"));
  assert.match(text(), /클라우드/);
  assert.match(text(), /1 \/ 2 분야/);
  assert.match(text(), /1 \/ 8/);
  assert.match(text(), /클라우드 문제 1/);
  const choices: (number | "idk")[] = [0, 1, 2, 3, 0, "idk", 2, 1];
  await answerAll(choices.slice(0, 5));
  assert.match(text(), /6 \/ 8/);
  assert.match(text(), /클라우드 문제 6/);
  await answerAll(choices.slice(5));
  assert.match(text(), /데이터/);
  assert.match(text(), /2 \/ 2 분야/);
  assert.match(text(), /데이터 문제 1/);
  assert.doesNotMatch(text(), /클라우드 문제/);
  assert.equal(posts.length, 0, "nothing is saved while questions remain");
  results = [{ domainId: 1, correct: 5, level: 2 }, { domainId: 2, correct: null, level: 2 }];
  await click(button("이 분야 건너뛰기"));
  assert.equal(posts.length, 1, "one save for the whole flow");
  assert.deepEqual(posts[0], { selections: [
    { domainId: 1, answers: [0, 1, 2, 3, 0, null, 2, 1] }, { domainId: 2, skipped: true },
  ] });
  assert.match(text(), /클라우드/);
  assert.match(text(), /8문제 중 5개/);
  assert.match(text(), /Lv2/);
  assert.match(text(), /건너뜀/);
  assert.deepEqual(pushes, []);
  await click(button("시작하기"));
  assert.deepEqual(pushes, ["/"]);
  await unmount(root);

  // 2. A failed save keeps the answers; retrying sends the same body.
  failuresLeft = 1;
  results = [{ domainId: 1, correct: 8, level: 3 }];
  root = await mount();
  await click(domainBox("클라우드"));
  await click(button("다음"));
  await answerAll([0, 0, 0, 0, 0, 0, 0, 0]);
  assert.match(container.querySelector('[role="alert"]')!.textContent!, /저장하지 못했어요/);
  assert.equal(posts.length, 1);
  await click(button("다시 시도"));
  assert.equal(posts.length, 2);
  assert.deepEqual(posts[1], posts[0], "retry resends the same answers");
  assert.match(text(), /8문제 중 8개/);
  assert.match(text(), /Lv3/);
  await unmount(root);

  // 3. Existing domains stay subscribed and are not asked again unless the user chooses to retake them.
  results = [{ domainId: 2, correct: null, level: 2 }];
  root = await mount({ initialLevels: { "1": 3 } });
  const existing = domainBox("클라우드");
  assert.equal(existing.checked, true);
  assert.equal(existing.disabled, true);
  assert.match(text(), /Lv3/);
  assert.equal(button("클라우드 퀴즈 다시 풀기").getAttribute("aria-pressed"), "false");
  await click(domainBox("데이터"));
  await click(button("다음"));
  assert.match(text(), /데이터 문제 1/);
  assert.doesNotMatch(text(), /클라우드 문제/);
  await click(button("이 분야 건너뛰기"));
  assert.deepEqual(posts[0], { selections: [{ domainId: 2, skipped: true }] }, "the existing domain is not sent");
  await unmount(root);

  // 3b. Re-onboarding: an existing domain can be quizzed again; its answers go out marked as a retake.
  results = [{ domainId: 1, correct: 2, level: 1 }];
  root = await mount({ initialLevels: { "1": 3 } });
  await click(button("클라우드 퀴즈 다시 풀기"));
  assert.equal(button("클라우드 퀴즈 다시 풀기").getAttribute("aria-pressed"), "true");
  await click(button("다음"));
  assert.match(text(), /클라우드 문제 1/, "the retake quiz starts");
  assert.match(text(), /1 \/ 1 분야/);
  await answerAll([0, 0, "idk", "idk", "idk", "idk", "idk", "idk"]);
  assert.deepEqual(posts, [{ selections: [{ domainId: 1, answers: [0, 0, null, null, null, null, null, null], retake: true }] }]);
  assert.match(text(), /8문제 중 2개/);
  assert.match(text(), /Lv1/);
  await unmount(root);

  // 3c. Skipping a retake keeps the current level: nothing is sent for that domain.
  results = [{ domainId: 2, correct: 8, level: 3 }];
  root = await mount({ initialLevels: { "1": 3 } });
  await click(button("클라우드 퀴즈 다시 풀기"));
  await click(domainBox("데이터"));
  await click(button("다음"));
  assert.match(text(), /클라우드 문제 1/);
  await click(button("이 분야 건너뛰기"));
  assert.match(text(), /데이터 문제 1/);
  await answerAll([0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(posts, [{ selections: [{ domainId: 2, answers: [0, 0, 0, 0, 0, 0, 0, 0] }] }]);
  await unmount(root);

  // 3d. Turning a retake back off before starting means no quiz for it.
  root = await mount({ initialLevels: { "1": 3 } });
  await click(button("클라우드 퀴즈 다시 풀기"));
  await click(button("클라우드 퀴즈 다시 풀기"));
  results = [];
  await click(button("다음"));
  assert.deepEqual(posts, [{ selections: [] }]);
  await unmount(root);

  // 4. A domain without a quiz is saved as skipped, with no questions.
  results = [{ domainId: 3, correct: null, level: 2 }];
  root = await mount();
  await click(domainBox("경제"));
  await click(button("다음"));
  assert.deepEqual(posts, [{ selections: [{ domainId: 3, skipped: true }] }]);
  assert.doesNotMatch(text(), /문제 1/);
  await unmount(root);

  // 5. Editing with nothing new just goes home.
  results = [];
  root = await mount({ initialLevels: { "1": 3 } });
  await click(button("다음"));
  assert.deepEqual(posts, [{ selections: [] }]);
  assert.deepEqual(pushes, ["/"]);
  await unmount(root);

  console.log("PASS onboarding flow: pick, quiz per new domain, skip, retry, existing domains, no-quiz domains");
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
