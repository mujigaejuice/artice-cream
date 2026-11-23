/**
 * Smoke tests for the pure logic shared by server and client (plan §1): scoop
 * color, level adjustment, glossary marking. No network, no DB — run it before
 * touching any of the three.
 *
 *   npm run test:logic
 */
import assert from "node:assert";

import { markTerms, resolveTokenPrice } from "../lib/ai/pipeline";
import {
  LIFT_ABOVE,
  PUSH_BELOW,
  R,
  SCOOP_BOTTOM,
  SCOOP_DOME,
  SLOT_HALF,
  STEP,
  coneHeight,
  coneTopY,
  scoopCy,
  slotRange,
} from "../lib/cone";
import { CATEGORY_SLUGS } from "../lib/ai/schemas";
import { coreColor, DOMAIN_FLAVORS, hslStr, scoopShade } from "../lib/color";
import { CATEGORY_COUNT } from "../lib/policy";
import { applyQuiz } from "../lib/level";
import type { User } from "@supabase/supabase-js";

import { corsHeaders, signedInUser } from "../lib/api";
import { quizHref, readHref, safeNext } from "../lib/routes";

// color: 같은 (슬러그, 날짜, 기사)는 같은 색. 같은 날의 기사도 톤이 다르다.
// 모르는 슬러그는 FALLBACK 한 곳으로 모인다 (lib/color.ts).
const a = scoopShade("cloud", "2026-09-15", 1842);
const b = scoopShade("cloud", "2026-09-15", 1842);
const c = scoopShade("cloud", "2026-09-16", 1842);
assert.deepEqual(a, b, "same article and day must give same color");
assert.notDeepEqual(a, c, "different day should shade differently");
const sameDay = [1842, 1906, 1907].map(id => scoopShade("cloud", "2026-10-24", id));
assert.equal(new Set(sameDay.map(color => color.h)).size, 1, "articles retain their domain hue");
assert.equal(new Set(sameDay.map(color => color.s)).size, 3);
assert.equal(new Set(sameDay.map(color => color.l)).size, 3);
for (let i = 1; i < sameDay.length; i++) {
  assert.ok(Math.abs(sameDay[i].l - sameDay[i - 1].l) >= 4, "reported cloud articles have visibly separated lightness");
}
for (const domain of [...Object.keys(DOMAIN_FLAVORS), "unknown"]) {
  for (let id = 1; id <= 300; id++) {
    const shade = scoopShade(domain, "2026-10-24", id);
    assert.ok(shade.s >= 30 && shade.s <= 92, "saturation stays in palette limits");
    assert.ok(shade.l >= 44 && shade.l <= 90, "lightness stays in palette limits");
  }
  assert.equal(new Set([1917, 1918, 1919].map(id => scoopShade(domain, "2026-10-24", id).l)).size, 3,
    "even pale flavors retain all three lightness bands");
}
assert.match(hslStr(a), /^hsl\([\d.-]+, [\d.]+%, [\d.]+%\)$/, `bad hsl: ${hslStr(a)}`);
// 특정 색값을 박지 않는다 — 테마가 생기면 팔레트가 바뀐다(확장.md §2-7).
// 대신 형식과 "아는 슬러그는 폴백과 다르다"는 불변식만 본다.
assert.match(coreColor("cloud"), /^hsl\([\d.]+, [\d.]+%, [\d.]+%\)$/);
assert.notEqual(coreColor("cloud"), coreColor("no-such-domain"), "아는 슬러그는 폴백과 달라야 한다");
assert.equal(
  coreColor("no-such-domain"),
  coreColor("another-unknown"),
  "unknown slugs share the fallback color",
);
console.log("color ok:", hslStr(a), hslStr(c));

// level: 창(WINDOW=3)을 넘기지 않는 이동평균. 창이 덜 찼어도 바로 움직이는 것은
// 의도된 동작이다 (lib/level.ts의 applyQuiz 주석).
let r = applyQuiz({ level: 2, history: [] }, 1);
assert.equal(r.level, 3, "부분 창에서도 즉시 승급한다");
assert.equal(r.dir, "상승");
assert.deepEqual(r.history, [1], "이번 점수가 history에 쌓인다");

r = applyQuiz({ level: 2, history: [1, 1] }, 1);
assert.equal(r.level, 3, "should promote");
assert.equal(r.rollingAccuracy, 1);

r = applyQuiz({ level: 2, history: [0, 0] }, 0.25);
assert.equal(r.level, 1, "should demote");
assert.equal(r.dir, "하강");

r = applyQuiz({ level: 3, history: [1, 1] }, 1);
assert.equal(r.level, 3, "clamped at max");
assert.equal(r.dir, "유지");

r = applyQuiz({ level: 1, history: [0, 0] }, 0);
assert.equal(r.level, 1, "clamped at min");

r = applyQuiz({ level: 2, history: [0.5, 0.6] }, 0.7);
assert.equal(r.level, 2, "middling average holds");
assert.equal(r.dir, "유지");

r = applyQuiz({ level: 2, history: [0.1, 0.2, 0.3] }, 0.4);
assert.deepEqual(r.history, [0.2, 0.3, 0.4], "window keeps only the last WINDOW scores");

assert.equal(applyQuiz({ level: 1, history: [] }, 5).rollingAccuracy, 1, "score clamps to 0~1");
console.log("level ok");

// markTerms: escapes, marks longest-first, drops absent terms, marks only the
// first occurrence of a surface, and caps at GLOSSARY_MAX[level] (정책.md §4).
const { content_html, glossary } = markTerms(
  ["기준금리가 올랐다. 금리는 <b>중요</b>하다.", "기준금리 이야기 또."],
  [
    { surface: "금리", definition: "돈의 값" },
    { surface: "기준금리", definition: "중앙은행이 정하는 금리" },
    { surface: "없는말", definition: "본문에 없음" },
  ],
  2,
);

const idOf = (surface: string) =>
  Object.keys(glossary).find((k) => glossary[k].term === surface)!;
const count = (needle: string) => (content_html.match(new RegExp(needle, "g")) ?? []).length;

assert.ok(!content_html.includes("<b>"), "raw html must be escaped");
assert.ok(content_html.includes("&lt;b&gt;"), "raw html must survive as entities");
assert.equal(Object.keys(glossary).length, 2, "absent term must be dropped");

const base = idOf("기준금리");
const short = idOf("금리");
assert.equal(count(`data-w="${base}"`), 1, "only the first occurrence of a surface is marked");
assert.equal(count(`data-w="${short}"`), 1, "longest-first must not re-mark inside a mark");
assert.ok(!/<mark[^>]*>[^<]*<mark/.test(content_html), "marks must not nest");
assert.equal(count("<p>"), 2, "one <p> per paragraph");
console.log("markTerms ok");
console.log(content_html);

// keyParagraphs: 문단 인덱스로 받은 중요 대목만 ac-key 클래스가 붙는다.
{
  const { content_html: html } = markTerms(["첫 문단.", "둘째 문단.", "셋째 문단."], [], 2, [1]);
  const paras = html.match(/<p[^>]*>/g) ?? [];
  assert.equal(paras.length, 3);
  assert.ok(!paras[0]?.includes("ac-key"), "지정 안 한 문단엔 안 붙는다");
  assert.ok(paras[1]?.includes("ac-key"), "지정한 문단엔 ac-key가 붙는다");
  assert.ok(!paras[2]?.includes("ac-key"));
}
console.log("keyParagraphs ok");

// glossary cap: 수준 1 상한(12)보다 많은 용어를 주면 상한만큼만 남는다.
{
  const manyTerms = Array.from({ length: 15 }, (_, i) => ({
    surface: `용어${i}`,
    definition: `뜻${i}`,
  }));
  const paragraphs = [manyTerms.map((t) => t.surface).join(" ")];
  const { glossary: capped } = markTerms(paragraphs, manyTerms, 1);
  assert.equal(Object.keys(capped).length, 12, "level 1 caps at GLOSSARY_MAX[1] = 12");
}
console.log("glossary cap ok");

// cone: 선택 없을 때는 STEP 간격, 선택하면 스택이 고른 스쿱을 기준으로 갈라져
// 빈 슬롯이 생긴다(화면구성.md §4-2 — 자리를 메우지 않는다).
{
  const n = 4;
  const base = [0, 1, 2, 3].map((i) => scoopCy(i, n));
  // 0이 맨 아래이므로 위로 갈수록 y가 작아진다
  for (let i = 1; i < n; i++) {
    assert.ok(base[i] < base[i - 1], "위쪽 스쿱은 y가 더 작아야 한다");
    assert.equal(
      Number((base[i - 1] - base[i]).toFixed(6)),
      Number(STEP.toFixed(6)),
      "간격은 STEP 고정",
    );
  }

  // 선택하면 스택이 그 스쿱을 기준으로 갈라진다: 위는 LIFT_ABOVE만큼 올라가고,
  // 아래는 콘과 함께 PUSH_BELOW만큼 내려간다. 고른 스쿱은 세로로 안 움직인다.
  // 콘 높이는 선택과 무관하므로(벌어질 자리를 늘 비워 둔다) 페이지가 밀리지 않는다.
  const sel = 1;
  const after = [0, 1, 2, 3].map((i) => scoopCy(i, n, sel));
  assert.equal(after[sel], base[sel], "빠져나온 스쿱은 세로로 움직이지 않는다(좌측 이동뿐)");
  assert.equal(
    Number((after[0] - base[0]).toFixed(6)),
    Number(PUSH_BELOW.toFixed(6)),
    "선택보다 아래는 콘과 함께 PUSH_BELOW만큼 내려간다",
  );
  assert.equal(
    Number((base[2] - after[2]).toFixed(6)),
    Number(LIFT_ABOVE.toFixed(6)),
    "선택보다 위는 LIFT_ABOVE만큼 올라간다",
  );
  assert.equal(after[2] - after[3], base[2] - base[3], "위쪽 무리끼리 간격은 STEP 그대로");

  assert.equal(
    Number((coneHeight(4) - coneHeight(3)).toFixed(6)),
    Number(STEP.toFixed(6)),
    "스쿱 하나당 STEP만큼 높아진다",
  );
  assert.equal(coneHeight(0) + R, coneHeight(1), "빈 콘 + 스쿱 하나 = R");
}

// slot: 빈 슬롯은 고른 스쿱의 중심에 가운데 정렬되고, 어느 스쿱을 골라도 크기가
// 같으며, 다른 스쿱도 콘도 침범하지 않는다.
{
  const n = 5;
  // 경계는 이웃·콘의 끝에 정확히 맞닿도록 잡혀 있다. 맞닿는 것과 파고드는 것을
  // 가르려면 부동소수 오차만큼의 여유가 필요하다.
  const EPS = 0.01;

  for (let sel = 0; sel < n; sel++) {
    const { top, height } = slotRange(sel, n);
    const cy = scoopCy(sel, n, sel);

    assert.equal(height, 2 * SLOT_HALF, "슬롯 크기는 선택과 무관하게 같다");
    assert.equal(
      Number((top + height / 2).toFixed(6)),
      Number(cy.toFixed(6)),
      `sel=${sel}: 슬롯 한가운데가 고른 스쿱의 중심이어야 한다`,
    );

    for (let i = 0; i < n; i++) {
      if (i === sel) continue; // 빠져나온 스쿱은 좌측으로 나가 있어 겹칠 일이 없다
      const other = scoopCy(i, n, sel);
      const overlaps =
        other - SCOOP_DOME * R < top + height - EPS && other + SCOOP_BOTTOM * R > top + EPS;
      assert.ok(!overlaps, `sel=${sel}일 때 슬롯이 ${i}번 스쿱과 겹치면 안 된다`);
    }

    // 콘도 아래 무리와 함께 내려간다. 맨 아래 스쿱을 골랐을 때가 가장 빠듯하다.
    const coneTopWhenSelected = coneTopY(n) + PUSH_BELOW;
    assert.ok(
      coneTopWhenSelected >= top + height - EPS,
      `sel=${sel}일 때 슬롯이 콘 테두리를 덮으면 안 된다`,
    );
  }
}
console.log("cone ok");

/* ── 정책 상수 ── */
// policy.ts는 schemas.ts를 import할 수 없어(순환) 분류 수를 손으로 적어 둔다.
assert.equal(
  CATEGORY_COUNT,
  CATEGORY_SLUGS.length,
  `lib/policy.ts의 CATEGORY_COUNT(${CATEGORY_COUNT})가 분류 ${CATEGORY_SLUGS.length}개와 다르다`,
);
console.log("policy ok");

/* ── 라우트 모양 (앱출시.md §2 — 정적 내보내기라 동적 세그먼트를 못 쓴다) ── */
// 빌드 시점에 없는 variant id로는 경로를 만들 수 없어서 쿼리스트링으로 옮겼다.
// 링크를 만드는 곳이 네 군데라 모양이 어긋나기 쉬워 한곳에 모았다.
assert.equal(readHref(201), "/read?v=201");
assert.equal(quizHref(201), "/read/quiz?v=201");
assert.equal(readHref(201, "/preview"), "/preview/read?v=201");
assert.equal(quizHref(201, "/preview"), "/preview/read/quiz?v=201");
// id가 경로 세그먼트로 남아 있으면 정적 내보내기가 그 경로를 만들지 못한다.
for (const href of [readHref(7), quizHref(7), readHref(7, "/preview")]) {
  const path = href.split("?")[0];
  assert.ok(!/[0-9]/.test(path), `경로에 id 세그먼트가 남아 있다: ${href}`);
}
// 열린 리다이렉트 — `next`는 URL에서 오므로 내부 경로만 받는다.
assert.equal(safeNext(null), "/");
assert.equal(safeNext(""), "/");
assert.equal(safeNext("/cone"), "/cone");
assert.equal(safeNext("/read?v=1"), "/read?v=1");
assert.equal(safeNext("https://evil.example"), "/");
// URL 파서는 파싱 전에 탭·개행·복귀를 지운다. `/<TAB>/host`가 `//host`가 되므로
// 글자 한 개만 보는 검사로는 못 막는다.
for (const ctrl of ["\t", "\n", "\r"]) {
  const raw = `/${ctrl}/evil.example`;
  assert.equal(safeNext(raw), "/", `제어문자로 오리진이 바뀐다: ${JSON.stringify(raw)}`);
  assert.equal(
    new URL(safeNext(raw), "https://localhost/x").origin,
    "https://localhost",
    `safeNext를 거친 값이 외부 오리진으로 해석된다: ${JSON.stringify(raw)}`,
  );
}
// 정상 경로는 그대로 살아야 한다.
assert.equal(new URL(safeNext("/read?v=1"), "https://localhost/x").origin, "https://localhost");
assert.equal(safeNext("//evil.example"), "/", "프로토콜 상대 URL은 외부로 나간다");
assert.equal(safeNext("/\\evil.example"), "/", "백슬래시도 //로 읽는 브라우저가 있다");
console.log("routes ok");

/* ── CORS 허용 오리진 ── */
// 목록이 넓어지면 API가 열린다. 앱(WebView) 오리진은 웹 전용 전환 때 뺐다.
const devReq = new Request("https://x/api/feed", {
  headers: { origin: "http://localhost:3000" },
});
assert.equal(corsHeaders(devReq)["Access-Control-Allow-Origin"], "http://localhost:3000");
assert.equal(corsHeaders(devReq)["Vary"], "Origin");
for (const origin of ["https://localhost", "capacitor://localhost"]) {
  assert.deepEqual(
    corsHeaders(new Request("https://x/api/feed", { headers: { origin } })),
    {},
    `앱 WebView 오리진(${origin})은 더 이상 허용하지 않는다`,
  );
}
assert.deepEqual(
  corsHeaders(new Request("https://x/api/feed", { headers: { origin: "https://evil.example" } })),
  {},
  "모르는 오리진에는 CORS 헤더를 주지 않는다",
);
// 오리진 헤더가 없는 요청(같은 오리진, curl)도 헤더 없이 통과한다.
assert.deepEqual(corsHeaders(new Request("https://x/api/feed")), {});
console.log("cors ok");

/* ── 로그인 판정 ── */
// 게스트 모드를 없앴다. 그 전에 만든 익명 세션은 토큰이 계속 갱신되므로 서버가 걸러야
// 한다. 여기가 새면 익명 사용자가 로그인 화면을 건너뛰고 홈으로 들어온다.
{
  const base = {
    id: "u",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "",
  } as User;
  assert.equal(signedInUser(null), null);
  assert.equal(signedInUser({ ...base, is_anonymous: true }), null, "익명 세션은 로그인이 아니다");
  assert.equal(signedInUser({ ...base, is_anonymous: false })?.id, "u");
  assert.equal(signedInUser(base)?.id, "u", "is_anonymous가 없는 토큰도 로그인으로 친다");
}
console.log("auth ok");


// 비용 단가 — 게이트웨이도 0이 되면 일일 예산이 가공을 멈추지 못한다.
{
  const haiku = { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 };
  assert.deepEqual(resolveTokenPrice(undefined, true), { price: haiku, source: "gateway-estimate-haiku" });
  assert.deepEqual(resolveTokenPrice("", false), { price: haiku, source: "anthropic-haiku" });
  assert.deepEqual(resolveTokenPrice("0.5, 2", true).price, { input: 0.5, output: 2, cacheWrite: 0.5, cacheRead: 0.5 });
  assert.deepEqual(resolveTokenPrice("3,15,3.75,0.3", true), { price: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 }, source: "configured" });
  assert.deepEqual(resolveTokenPrice("0,0", true).price, { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }, "explicit zero is an opt-out");
  for (const bad of ["abc", "1", "1,2,3", "-1,2", "1,,2,3", "1,Infinity"]) {
    assert.deepEqual(resolveTokenPrice(bad, true), { price: haiku, source: "invalid-config-haiku" }, `bad price ${bad} falls back, never to zero`);
  }
}
console.log("price ok");

console.log("\nall checks passed");
