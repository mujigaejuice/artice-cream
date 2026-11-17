/** Onboarding level quiz: data shape, grading rules and the real /api/onboarding handlers
 * against isolated Supabase HTTP responses. No network or DB. */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { ONBOARDING_QUIZ } from "../lib/onboarding-quiz-data";
import { countCorrect, levelFromQuizScore, publicQuiz, QUIZ_LENGTH } from "../lib/onboarding-quiz";

const SLUGS = ["cloud", "infra", "data", "cs-fundamentals", "deep-learning", "llm", "ai-security", "security"];

/** Display index of the correct option for every question, read from the public layout. */
function correctAnswers(slug: string): number[] {
  const questions = publicQuiz(slug)!;
  return questions.map((question, i) => {
    const right = ONBOARDING_QUIZ[slug][i].options[0];
    const at = question.options.indexOf(right);
    assert.ok(at >= 0, `${slug}:${i} keeps its correct option`);
    return at;
  });
}

function checkData() {
  assert.deepEqual(Object.keys(ONBOARDING_QUIZ), SLUGS);
  assert.equal(QUIZ_LENGTH, 8);
  for (const slug of SLUGS) {
    const items = ONBOARDING_QUIZ[slug];
    assert.equal(items.length, 8, `${slug} has 8 questions`);
    assert.deepEqual(items.map((item) => item.tier), [1, 1, 1, 2, 2, 2, 3, 3], `${slug} tier order`);
    let longest = 0;
    for (const item of items) {
      assert.equal(item.options.length, 4);
      assert.equal(new Set(item.options).size, 4, `${slug}: options differ — ${item.prompt}`);
      const len = (text: string) => [...text].length;
      if (len(item.options[0]) > Math.max(...item.options.slice(1).map(len))) longest++;
    }
    assert.ok(longest <= 3, `${slug}: correct option is the longest in ${longest} questions`);
  }

  // docs/ is gitignored, so CI does not have the spec. Locally it is the source of truth.
  const specPath = new URL("../docs/superpowers/specs/2026-11-17-onboarding-quiz-design.md", import.meta.url);
  if (existsSync(specPath)) {
    const spec = readFileSync(specPath, "utf8");
    const section = spec.slice(spec.indexOf("## 7. 문항"));
    const lines = section.split("\n");
    const prompts = lines.flatMap((line) => line.match(/^\*\*\d\. \(Lv\d\) (.*)\*\*$/)?.[1] ?? []);
    const options = lines.filter((line) => line.startsWith("- ")).map((line) => line.slice(2).replace(/^✅ /, ""));
    const data = SLUGS.flatMap((slug) => ONBOARDING_QUIZ[slug]);
    assert.deepEqual(data.map((item) => item.prompt), prompts, "prompts match spec §7");
    assert.deepEqual(data.flatMap((item) => item.options), options, "options match spec §7");
  }
}

function checkPublicQuiz() {
  assert.equal(publicQuiz("economy"), null);
  const slots = [0, 0, 0, 0];
  for (const slug of SLUGS) {
    const first = publicQuiz(slug)!;
    assert.deepEqual(publicQuiz(slug), first, "same layout on every call");
    assert.equal(first.length, 8);
    for (const question of first) {
      assert.deepEqual(Object.keys(question).sort(), ["options", "prompt"], "nothing but prompt and options leaves the server");
      assert.equal(question.options.length, 4);
    }
    for (const at of correctAnswers(slug)) slots[at]++;
  }
  for (const [at, count] of slots.entries()) assert.ok(count >= 10, `correct option sits at slot ${at} only ${count} times`);
}

function checkGrading() {
  const right = correctAnswers("cloud");
  assert.equal(countCorrect("cloud", right), 8);
  assert.equal(countCorrect("cloud", Array(8).fill(null)), 0);
  assert.equal(countCorrect("cloud", right.map((at, i) => (i < 5 ? at : null))), 5);
  assert.equal(countCorrect("cloud", right.map((at, i) => (i < 5 ? at : (at + 1) % 4))), 5);
  for (const bad of [right.slice(0, 7), [...right, 0], right.map((_, i) => (i === 0 ? 4 : right[i])),
    right.map((_, i) => (i === 0 ? -1 : right[i])), right.map((_, i) => (i === 0 ? 1.5 : right[i])),
    right.map((_, i) => (i === 0 ? "0" : right[i])), "01230123", null, undefined, {}]) {
    assert.equal(countCorrect("cloud", bad), null, `rejects ${JSON.stringify(bad)}`);
  }
  assert.equal(countCorrect("economy", Array(8).fill(null)), null);

  assert.deepEqual([0, 3, 4, 6, 7, 8].map(levelFromQuizScore), [1, 1, 2, 2, 3, 3]);
}

async function checkRoute() {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://onboarding.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public",
    SUPABASE_SERVICE_ROLE_KEY: "test-private",
  });
  const userId = "11111111-1111-4111-8111-111111111111";
  const domains = [
    { id: 1, slug: "cloud", name_ko: "클라우드", name_en: "Cloud", rss_topic: null, active: true },
    { id: 2, slug: "data", name_ko: "데이터", name_en: "Data", rss_topic: null, active: true },
    { id: 3, slug: "economy", name_ko: "경제", name_en: "Economy", rss_topic: null, active: true },
  ];
  let signedIn = true;
  let rpcStatus = 200;
  /** Before the retake migration the RPC answers without "retaken". */
  let rpcKnowsRetake = true;
  const rpcBodies: { p_user_id: string; p_selections: { domainId: number; level: number; retake?: true }[] }[] = [];
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://onboarding.invalid", "test must never use the network");
    calls.push(url.pathname);
    if (url.pathname === "/auth/v1/user") {
      return signedIn ? Response.json({ id: userId, is_anonymous: false })
        : Response.json({ message: "unauthenticated" }, { status: 401 });
    }
    if (url.pathname === "/rest/v1/domains") return Response.json(domains);
    if (url.pathname === "/rest/v1/user_domain_levels") return Response.json([{ domain_id: 1, level: 3 }]);
    if (url.pathname === "/rest/v1/domain_terms") return Response.json([]);
    if (url.pathname === "/rest/v1/content_source_rights") return Response.json([]);
    assert.equal(url.pathname, "/rest/v1/rpc/save_onboarding_preferences", `unexpected call ${url.pathname}`);
    const body = JSON.parse(String(init?.body));
    rpcBodies.push(body);
    if (rpcStatus !== 200) return Response.json({ message: "down" }, { status: rpcStatus });
    const retaken = body.p_selections.filter((s: { retake?: true }) => s.retake).length;
    return Response.json({ ok: true, added: body.p_selections.length - retaken, ...(rpcKnowsRetake ? { retaken } : {}) });
  };

  const { GET, POST } = await import("../app/api/onboarding/route.api");
  const request = (method: "GET" | "POST", body?: unknown, auth = true) =>
    new Request("https://app.invalid/api/onboarding", { method,
      headers: { ...(auth ? { Authorization: "Bearer signed-token" } : {}), Origin: "https://localhost",
        "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
  const right = { cloud: correctAnswers("cloud"), data: correctAnswers("data") };

  // GET: quizzes without answers; the old fields stay for older app builds.
  const raw = await (await GET(request("GET"))).text();
  const data = JSON.parse(raw);
  assert.equal(data.isSignedIn, true);
  assert.deepEqual(data.levels, { "1": 3 });
  assert.ok("domainTerms" in data, "domainTerms stays for older app builds");
  assert.deepEqual(Object.keys(data.quizzes).sort(), ["1", "2"], "only domains that have a quiz");
  assert.deepEqual(data.quizzes["1"], publicQuiz("cloud"));
  assert.doesNotMatch(raw, /"tier"|correct/, "no grading information in the response");
  calls.length = 0;
  const signedOut = await (await GET(request("GET", undefined, false))).json();
  assert.equal(signedOut.isSignedIn, false);
  assert.deepEqual(signedOut.quizzes, {}, "no quiz for a signed-out visitor");

  // POST: graded on the server, the RPC only ever sees levels.
  let response = await POST(request("POST", { selections: [
    { domainId: 1, answers: right.cloud }, { domainId: 2, skipped: true },
  ] }));
  assert.equal(response.status, 200);
  assert.deepEqual(rpcBodies.at(-1), { p_user_id: userId, p_selections: [
    { domainId: 1, level: 3 }, { domainId: 2, level: 2 },
  ] });
  const result = await response.json();
  assert.deepEqual(result.results, [
    { domainId: 1, correct: 8, level: 3 }, { domainId: 2, correct: null, level: 2 },
  ]);
  assert.equal(result.ok, true);

  const half = right.data.map((at, i) => (i < 5 ? at : null));
  await POST(request("POST", { selections: [{ domainId: 2, answers: half }] }));
  assert.deepEqual(rpcBodies.at(-1)!.p_selections, [{ domainId: 2, level: 2 }], "5 of 8 is Lv2");
  await POST(request("POST", { selections: [{ domainId: 2, answers: Array(8).fill(null) }] }));
  assert.deepEqual(rpcBodies.at(-1)!.p_selections, [{ domainId: 2, level: 1 }], "all 모르겠어요 is Lv1");

  // Older app builds keep working with the term check.
  response = await POST(request("POST", { selections: [{ domainId: 1, rareChecked: 3 }, { domainId: 2, rareChecked: 0 }] }));
  assert.equal(response.status, 200);
  assert.deepEqual(rpcBodies.at(-1)!.p_selections, [{ domainId: 1, level: 3 }, { domainId: 2, level: 1 }]);
  assert.deepEqual((await response.json()).results, [
    { domainId: 1, correct: null, level: 3 }, { domainId: 2, correct: null, level: 1 },
  ]);

  // Re-onboarding: an existing domain can be quizzed again; only that selection is marked as a retake.
  response = await POST(request("POST", { selections: [
    { domainId: 1, answers: Array(8).fill(null), retake: true }, { domainId: 2, answers: right.data },
  ] }));
  assert.equal(response.status, 200);
  assert.deepEqual(rpcBodies.at(-1)!.p_selections, [{ domainId: 1, level: 1, retake: true }, { domainId: 2, level: 3 }]);
  assert.deepEqual((await response.json()).results, [
    { domainId: 1, correct: 0, level: 1 }, { domainId: 2, correct: 8, level: 3 },
  ]);
  // A database without the retake migration would silently keep the old level; never report that as saved.
  rpcKnowsRetake = false;
  assert.equal((await POST(request("POST", { selections: [{ domainId: 1, answers: right.cloud, retake: true }] }))).status, 503);
  assert.equal((await POST(request("POST", { selections: [{ domainId: 2, answers: right.data }] }))).status, 200,
    "plain saves still work on the older database");
  rpcKnowsRetake = true;

  // Rejected before anything is saved.
  const writes = rpcBodies.length;
  const bad: unknown[] = [
    "{", null, [], {}, { selections: "x" },
    { selections: [{ domainId: 1, answers: right.cloud.slice(0, 7) }] },
    { selections: [{ domainId: 1, answers: right.cloud.map((at, i) => (i === 0 ? 4 : at)) }] },
    { selections: [{ domainId: 1, answers: right.cloud }, { domainId: 1, skipped: true }] },
    { selections: [{ domainId: 1, answers: right.cloud, skipped: true }] },
    { selections: [{ domainId: 1, answers: right.cloud, rareChecked: 1 }] },
    { selections: [{ domainId: 1 }] },
    { selections: [{ domainId: 1, skipped: false }] },
    { selections: [{ domainId: 1, rareChecked: 5 }] },
    { selections: [{ domainId: 1, skipped: true, retake: true }] },
    { selections: [{ domainId: 1, rareChecked: 1, retake: true }] },
    { selections: [{ domainId: 1, answers: right.cloud, retake: false }] },
    { selections: [{ domainId: 1, answers: right.cloud, retake: "yes" }] },
    { selections: [{ domainId: 99, skipped: true }] },
    { selections: [{ domainId: 3, answers: Array(8).fill(null) }] },
    { selections: [{ domainId: "1", skipped: true }] },
    { selections: Array.from({ length: 33 }, (_, i) => ({ domainId: i + 1, skipped: true })) },
  ];
  for (const body of bad) {
    response = await POST(request("POST", body));
    assert.equal(response.status, 400, `rejects ${JSON.stringify(body)?.slice(0, 80)}`);
  }
  assert.equal(rpcBodies.length, writes, "no invalid request reaches the database");

  // A domain without a quiz can still be skipped.
  response = await POST(request("POST", { selections: [{ domainId: 3, skipped: true }] }));
  assert.equal(response.status, 200);
  assert.deepEqual(rpcBodies.at(-1)!.p_selections, [{ domainId: 3, level: 2 }]);

  rpcStatus = 503;
  assert.equal((await POST(request("POST", { selections: [{ domainId: 1, skipped: true }] }))).status, 503);
  rpcStatus = 200;
  signedIn = false;
  assert.equal((await POST(request("POST", { selections: [{ domainId: 1, skipped: true }] }))).status, 401);
}

async function main() {
  checkData();
  checkPublicQuiz();
  checkGrading();
  await checkRoute();
  console.log("PASS onboarding quiz data, layout, grading and API");
}

main().catch((error) => { console.error(error); process.exit(1); });
