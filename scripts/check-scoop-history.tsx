/** Real cone handler/SDK and React UI, with isolated HTTP fixtures. No external requests. */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dayKey, monthRangeUtc } from "../lib/day";
import type { Scoop } from "../lib/feed";

async function main() {
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://scoops.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public", SUPABASE_SERVICE_ROLE_KEY: "test-private",
    NEXT_PUBLIC_API_BASE: "" });
  const uid = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const domain = { id: 4, slug: "cs-fundamentals", name_ko: "CS 기초", active: true, name_en: null, rss_topic: null };
  const past = "2020-01-01T00:00:00Z";
  const article = { source: "publisher", status: "ready", rights_status: "permitted", rights_evidence_url: "https://publisher.invalid/license",
    rights_reviewed_at: past, rights_expires_at: null, domains: domain,
    rights_attribution: { author: "Author", originalTitle: "Original", licenseLabel: "CC BY", licenseUrl: "https://publisher.invalid/license", changes: "Translated", notices: "" } };
  function record(id: number, userId: string, date: string, rights = "blocked", status = "saved") {
    return { id, user_id: userId, article_id: id + 100, variant_id: id + 200, status, completed_at: date, quiz_score: 0.75,
      article_variants: { title: `Private title ${id}`, summary: `Private summary ${id}.`, articles: { ...article, rights_status: rights } } };
  }
  const records = [record(1, uid, "2026-09-30T14:59:59Z"), record(2, uid, "2026-09-30T15:00:00Z"),
    record(3, uid, "2026-10-04T01:00:00Z", "permitted"), record(4, other, "2026-10-04T01:00:00Z"),
    record(5, uid, "2026-10-05T01:00:00Z", "permitted", "completed")];
  let anonymous = false;
  let historyFails = false;
  let registryFails = false;
  let adminReads = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://scoops.invalid");
    assert.ok(!init?.method || init.method === "GET", "history does not write any records");
    if (url.pathname === "/auth/v1/user") return Response.json({ id: uid, is_anonymous: anonymous });
    const table = url.pathname.split("/").at(-1);
    if (table === "domains") return Response.json([domain]);
    assert.equal(new Headers(init?.headers).get("apikey"), "test-private", "private history is read only on server");
    adminReads++;
    if (table === "content_source_rights") return registryFails
      ? Response.json({ code: "XX000", message: "private database detail" }, { status: 503 })
      : Response.json([{ source: "publisher", rights_status: "permitted", evidence_url: article.rights_evidence_url,
        reviewed_at: past, expires_at: null, allow_publish: true }]);
    assert.equal(table, "user_article_progress");
    assert.equal(url.searchParams.get("user_id"), `eq.${uid}`, "verified owner filter is mandatory");
    assert.equal(url.searchParams.get("status"), "eq.saved");
    assert.doesNotMatch(url.searchParams.get("select")!, /content_html|original_text|quiz_answers|correct_index|rights_review_note/);
    if (historyFails) return Response.json({ code: "XX000", message: "private database detail" }, { status: 503 });
    const bounds = url.searchParams.getAll("completed_at");
    const rows = records.filter(r => r.user_id === uid && r.status === "saved" && bounds.every(bound =>
      bound.startsWith("gte.") ? Date.parse(r.completed_at) >= Date.parse(bound.slice(4)) :
      bound.startsWith("lt.") ? Date.parse(r.completed_at) < Date.parse(bound.slice(3)) : true));
    rows.sort((a, b) => a.completed_at.localeCompare(b.completed_at) * (url.searchParams.get("order")!.includes("desc") ? -1 : 1));
    return Response.json(rows);
  };
  const { GET } = await import("../app/api/cone/route.api");
  const request = (query = "", token = true) => new Request(`https://app.invalid/api/cone${query}`, {
    headers: token ? { Authorization: "Bearer test-token" } : {},
  });
  let october: { scoops: Scoop[]; months: string[] };
  try {
    assert.deepEqual(await (await GET(request("", false))).json(), { status: "onboarding" });
    anonymous = true;
    assert.deepEqual(await (await GET(request())).json(), { status: "onboarding" });
    assert.equal(adminReads, 0);
    anonymous = false;
    for (const month of ["", "2026-13", "2026-00", "x", "0000-01"]) {
      assert.equal((await GET(request(`?month=${month}`))).status, 400);
    }
    const response = await GET(request(`?month=2026-10&userId=${other}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    october = await response.json();
    assert.deepEqual(october.months, ["2026-10", "2026-09"]);
    assert.deepEqual(october.scoops.map(s => s.id), [2, 3]);
    assert.deepEqual(october.scoops[0], { id: 2, articleId: 102, variantId: null, domain: domain.slug,
      domainLabel: domain.name_ko, date: "2026-10-01", title: "현재 열람 불가", summaryFirstLine: null, score: 0.75 });
    assert.equal(october.scoops[1].title, "Private title 3");
    assert.equal(october.scoops[1].variantId, 203);
    assert.doesNotMatch(JSON.stringify(october), /Private (title|summary) [1245]|rights_attribution|user_id/);
    const september = await (await GET(request("?month=2026-09"))).json();
    assert.deepEqual(september.scoops.map((s: Scoop) => s.id), [1]);
    registryFails = true;
    const unavailable = await (await GET(request("?month=2026-10"))).json();
    assert.equal(unavailable.scoops.length, 2, "registry failure preserves history");
    assert.ok(unavailable.scoops.every((s: Scoop) => s.variantId === null && s.summaryFirstLine === null));
    registryFails = false;
    historyFails = true;
    const failed = await GET(request("?month=2026-10"));
    assert.equal(failed.status, 503, "database errors must not pretend history is empty");
    assert.doesNotMatch(JSON.stringify(await failed.json()), /private database detail/);
  } finally { globalThis.fetch = originalFetch; }

  const { ScoopPanel } = await import("../components/ScoopPanel");
  const hiddenHtml = renderToStaticMarkup(createElement(ScoopPanel, { scoop: october!.scoops[0] }));
  assert.doesNotMatch(hiddenHtml, /href=|Private title|다시 읽기/);
  assert.match(hiddenHtml, /현재 열람 불가/);
  assert.match(hiddenHtml, /75/);
  const publicHtml = renderToStaticMarkup(createElement(ScoopPanel, { scoop: october!.scoops[1] }));
  assert.match(publicHtml, /href=/);
  assert.match(publicHtml, /다시 읽기/);

  const dom = new JSDOM('<div id="root"></div>', { url: "https://app.invalid/cone/?month=2026-10&scoop=2" });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, self: dom.window, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const { ScoopCone } = await import("../components/ScoopCone");
  const cloudScoops: Scoop[] = [1842, 1906, 1907].map((articleId, i) => ({
    ...october!.scoops[1], id: i + 1, articleId, domain: "cloud", domainLabel: "클라우드",
    date: "2026-10-24", title: `Article ${articleId}`,
  }));
  const colors = (scoops: Scoop[], selectedId?: number) => {
    const svg = JSDOM.fragment(renderToStaticMarkup(createElement(ScoopCone, { scoops, selectedId })));
    return new Map([...svg.querySelectorAll('.ac-scoop[role="button"]')].map(scoop =>
      [scoop.getAttribute("aria-label"), scoop.querySelector("path")!.getAttribute("fill")]));
  };
  const initialColors = colors(cloudScoops);
  assert.equal(new Set(initialColors.values()).size, 3, "same-day cloud scoops render different article tones");
  const changedColors = colors([
    ...cloudScoops.toReversed().map(scoop => ({ ...scoop, id: scoop.id + 100, variantId: 999 })),
    { ...cloudScoops[0], id: 104, articleId: 1918, title: "New article" },
  ], 101);
  for (const [label, fill] of initialColors) {
    assert.equal(changedColors.get(label), fill, "colors survive reordering, selection, new scoops and variant/progress ID changes");
  }
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.localStorage.setItem("artice-auth", JSON.stringify({ access_token: "test-token", refresh_token: "test-refresh", token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: uid, is_anonymous: false } }));
  const calls: string[] = [];
  let slow = false;
  const pending: Array<(value: Response) => void> = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input), dom.window.location.origin);
    assert.equal(url.pathname, "/api/cone");
    const month = url.searchParams.get("month")!;
    calls.push(month);
    if (slow) return new Promise<Response>(resolve => pending.push(resolve));
    return Response.json({ status: "ok", domains: [domain], months: october!.months,
      scoops: month === "2026-09" ? [{ ...october!.scoops[0], id: 1, date: "2026-09-30" }] : october!.scoops });
  };
  const { createRoot } = await import("react-dom/client");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { default: ConePage } = await import("../app/(tabs)/cone/page");
  const { createClient } = await import("../lib/supabase/client");
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {}, bfcacheId: "test" };
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  try {
    await act(async () => { root.render(createElement(AppRouterContext.Provider, { value: router }, createElement(ConePage))); });
    assert.deepEqual(calls, ["2026-10"]);
    assert.match(container.textContent!, /현재 열람 불가/);
    assert.match(container.textContent!, /스쿱 2개/);
    assert.ok(container.querySelector(`option[value="${dayKey().slice(0, 7)}"]`));
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape" }));
    });
    assert.equal(new URL(dom.window.location.href).searchParams.get("month"), "2026-10", "closing panel preserves month");
    assert.equal(new URL(dom.window.location.href).searchParams.has("scoop"), false);
    await act(async () => {
      const select = container.querySelector("select")!;
      select.value = "2026-09";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    assert.equal(calls.at(-1), "2026-09");
    assert.match(container.textContent!, /스쿱 1개/);
    assert.equal(new URL(dom.window.location.href).searchParams.get("month"), "2026-09");
    const scoop = container.querySelector<SVGElement>('.ac-scoop[role="button"]')!;
    assert.ok(scoop);
    await act(async () => { scoop.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
    assert.equal(new URL(dom.window.location.href).searchParams.get("month"), "2026-09", "selecting a scoop preserves month");
    assert.match(container.textContent!, /현재 열람 불가/);
    await act(async () => {
      dom.window.history.replaceState(null, "", "/cone/?month=2026-10");
      dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
    });
    assert.equal(calls.at(-1), "2026-10", "history navigation reloads the matching month");
    assert.equal(container.querySelector("select")!.value, "2026-10");
    assert.match(container.textContent!, /스쿱 2개/);
    slow = true;
    for (let i = 0; i < 2; i++) await act(async () => {
      dom.window.dispatchEvent(new dom.window.PageTransitionEvent("pageshow", { persisted: true }));
    });
    assert.equal(pending.length, 2);
    await act(async () => { pending[1](Response.json({ status: "ok", domains: [domain], months: ["2026-09"], scoops: [] })); });
    await act(async () => { pending[0](Response.json({ error: "old failure" }, { status: 503 })); });
    assert.match(container.textContent!, /스쿱 0개/);
    assert.doesNotMatch(container.textContent!, /old failure|불러오지 못했어요/);
    assert.deepEqual(monthRangeUtc("2026-10"), ["2026-09-30T15:00:00.000Z", "2026-10-31T15:00:00.000Z"]);
    console.log("Scoops: owner isolation, private metadata redaction, KST months, failures, readable links, month navigation and stale responses passed.");
  } finally {
    await act(async () => { root.unmount(); });
    await createClient().auth.stopAutoRefresh();
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
