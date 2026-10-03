/**
 * Smoke tests for the pure logic shared by server and client (plan §1): scoop
 * color, level adjustment, glossary marking. No network, no DB — run it before
 * touching any of the three.
 *
 *   npm run test:logic
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";

import { markTerms } from "../lib/ai/pipeline";
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
import { coreColor, hslStr, scoopShade } from "../lib/color";
import { CATEGORY_COUNT } from "../lib/policy";
import { applyQuiz } from "../lib/level";
import type { User } from "@supabase/supabase-js";

import { corsHeaders, signedInUser } from "../lib/api";
import {
  AUTH_DEEP_LINK,
  AUTH_HOST,
  AUTH_SCHEME,
  authRedirectUrl,
  isNative,
  parseAuthDeepLink,
} from "../lib/native";
import { quizHref, readHref, safeNext } from "../lib/routes";

// color: 같은 (슬러그, 날짜)는 같은 색, 날짜가 바뀌면 색도 바뀐다.
// 모르는 슬러그는 FALLBACK 한 곳으로 모인다 (lib/color.ts).
const a = scoopShade("cloud", "2026-09-15");
const b = scoopShade("cloud", "2026-09-15");
const c = scoopShade("cloud", "2026-09-16");
assert.deepEqual(a, b, "same day must give same color");
assert.notDeepEqual(a, c, "different day should shade differently");
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

/* ── CORS 허용 오리진 (앱출시.md §2) ── */
// WebView는 쿠키를 안 보내므로 Bearer 토큰을 쓰고, 그래서 오리진 허용이 필요하다.
// 목록이 넓어지면 API가 열리고, 좁아지면 앱이 못 부른다.
const nativeReq = new Request("https://x/api/feed", {
  headers: { origin: "https://localhost" },
});
assert.equal(corsHeaders(nativeReq)["Access-Control-Allow-Origin"], "https://localhost");
assert.equal(corsHeaders(nativeReq)["Vary"], "Origin");
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

/* ── 네이티브 경계 (T2 스펙 §6·§7) ── */
// 앱과 웹이 갈리는 자리가 여기 하나여야 한다. 화면마다 분기하면 다음 화면에서 빠뜨린다.
assert.equal(isNative(), false, "노드에는 Capacitor 전역이 없다");

const g = globalThis as { Capacitor?: { isNativePlatform?: () => boolean } };
g.Capacitor = { isNativePlatform: () => true };
assert.equal(isNative(), true);
assert.equal(authRedirectUrl(), AUTH_DEEP_LINK, "네이티브는 딥링크로 돌아온다");
delete g.Capacitor;
assert.equal(isNative(), false);

// 딥링크 파싱 — 우리 것만 받고 나머지는 지나간다.
assert.deepEqual(parseAuthDeepLink("artice-cream://auth/callback?code=abc"), {
  code: "abc",
  next: "/",
});
assert.deepEqual(parseAuthDeepLink("artice-cream://auth/callback?code=abc&next=/cone"), {
  code: "abc",
  next: "/cone",
});
assert.equal(
  parseAuthDeepLink("artice-cream://auth/callback?next=//evil.example"),
  null,
  "code도 error도 없으면 우리가 시작한 응답이 아니다",
);
assert.equal(
  parseAuthDeepLink("https://localhost/auth/callback?code=abc"),
  null,
  "웹 콜백은 페이지가 받는다",
);
assert.equal(
  parseAuthDeepLink("artice-cream://other/thing"),
  null,
  "스킴을 하나 더 붙여도 여기가 막지 않는다",
);
assert.equal(parseAuthDeepLink("URL이 아닌 것"), null);
// 우리가 시작한 응답만 받는다. code도 error도 없는 딥링크는 아무 앱이나 쏠 수 있고,
// 그걸 처리하면 열린 로그인 브라우저를 닫고 사용자를 화면에서 끌어낸다.
assert.equal(parseAuthDeepLink("artice-cream://auth/callback"), null, "빈 콜백은 무시한다");
assert.equal(
  parseAuthDeepLink("artice-cream://auth/callback?next=/cone"),
  null,
  "next만 있는 딥링크로 화면을 옮길 수 없어야 한다",
);
assert.equal(parseAuthDeepLink("artice-cream://auth/evil?code=x"), null, "경로가 다르면 우리 것이 아니다");
assert.deepEqual(
  parseAuthDeepLink("artice-cream://auth/callback?error=invalid_request&error_code=email_exists"),
  { code: null, next: "/" },
  "실패 응답은 받아서 안내해야 한다",
);
// 딥링크의 next도 safeNext를 거친다 — 제어문자 우회가 여기로 들어온다.
assert.deepEqual(
  parseAuthDeepLink("artice-cream://auth/callback?code=abc&next=%2F%09%2Fevil.example"),
  { code: "abc", next: "/" },
);
// 매니페스트와 상수가 어긋나면 딥링크가 조용히 안 걸린다. 스킴을 바꿀 일이
// 생기면(스펙 §11-4) 두 곳을 같이 고쳐야 한다.
const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
assert.ok(
  manifest.includes(`android:scheme="${AUTH_SCHEME}"`),
  `AndroidManifest에 ${AUTH_SCHEME} 스킴이 없다`,
);
assert.ok(
  manifest.includes(`android:host="${AUTH_HOST}"`),
  `AndroidManifest에 ${AUTH_HOST} 호스트가 없다`,
);
// 커스텀 스킴을 new URL()로 쪼개면 엔진마다 답이 다르다. 노드는
// host="auth" pathname="/callback", 안드로이드 WebView는 host="" pathname=
// "//auth/callback"이다. parseAuthDeepLink가 그 둘 중 하나에 기대면 이 테스트는
// 통과하는데 앱에서만 조용히 안 걸린다. 문자열로 자르는 구현을 지키기 위한 못이다.
{
  const parsed = new URL(AUTH_DEEP_LINK);
  const enginePicksHost = parsed.host === AUTH_HOST;
  assert.ok(
    enginePicksHost || parsed.pathname.includes(AUTH_HOST),
    "URL 파서가 스킴을 이해하지 못한다",
  );
  // 어느 쪽이든 파싱 결과는 같아야 한다.
  assert.deepEqual(parseAuthDeepLink(`${AUTH_DEEP_LINK}?code=abc`), { code: "abc", next: "/" });
}
console.log("native ok");

console.log("\nall checks passed");
