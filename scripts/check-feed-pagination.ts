/** A saved first page must not hide older unread articles. No network or DB writes. */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { getTodayPicks } from "../lib/feed";
import type { DomainRow } from "../lib/supabase/types";

async function main() {
  const userId = "11111111-1111-4111-8111-111111111111";
  const past = new Date(Date.now() - 60_000).toISOString();
  const source = { source: "publisher", rights_status: "permitted", evidence_url: "https://publisher.invalid/license",
    reviewed_at: past, expires_at: null, allow_collect: true, allow_process: true, allow_publish: true };
  const domain = { id: 2, slug: "infra", name_ko: "인프라", name_en: "Infrastructure", rss_topic: null, active: true } as DomainRow;
  const variant = (id: number, permitted = true) => ({ id: 100 + id, article_id: id, level: 2,
    title: `Article ${id}`, summary: "Summary", reading_minutes: 2,
    articles: { id, domain_id: 2, source: "publisher", status: "ready", source_url: `https://publisher.invalid/${id}`,
      image_url: null, published_at: "2026-09-01T00:00:00Z", rights_status: permitted ? "permitted" : "blocked",
      rights_evidence_url: source.evidence_url, rights_reviewed_at: past, rights_expires_at: null,
      rights_attribution: { author: "Author", originalTitle: `Original ${id}`, licenseLabel: "CC BY 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/", changes: "Adapted", notices: "" } } });
  let articles = Array.from({ length: 25 }, (_, i) => variant(i + 1));
  let progress: { article_id: number; variant_id: number; status: string; article_variants: ReturnType<typeof variant> }[] = [];
  let offsets: number[] = [];
  let failedOffset = -1;
  let progressFailed = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://feed.invalid");
    assert.ok(!init?.method || init.method === "GET");
    const table = url.pathname.split("/").pop();
    if (table === "content_source_rights") return Response.json([source]);
    if (table === "user_article_progress") {
      assert.equal(url.searchParams.get("user_id"), `eq.${userId}`);
      assert.equal(url.searchParams.get("status"), "in.(started,completed,saved)");
      assert.equal(url.searchParams.get("order"), "started_at.desc");
      if (progressFailed) return Response.json({ message: "progress unavailable" }, { status: 400 });
      return Response.json(progress);
    }
    assert.equal(table, "article_variants");
    assert.equal(url.searchParams.get("level"), "eq.2");
    assert.equal(url.searchParams.get("articles.domain_id"), "eq.2");
    assert.equal(url.searchParams.get("articles.status"), "eq.ready");
    assert.equal(url.searchParams.get("articles.rights_status"), "eq.permitted");
    assert.equal(url.searchParams.get("order"), "articles(published_at).desc.nullslast,id.desc");
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit"));
    assert.equal(limit, 12); offsets.push(offset);
    if (offset === failedOffset) return Response.json({ message: "temporary failure" }, { status: 400 });
    return Response.json(articles.slice(offset, offset + limit));
  };
  try {
    const client = createClient("https://feed.invalid", "test", { auth: { persistSession: false, autoRefreshToken: false } });
    const picks = () => getTodayPicks(client, userId, [domain], new Map([[2, 2]]));
    const saved = (count: number) => articles.slice(0, count).map(v => ({ article_id: v.article_id,
      variant_id: v.id, status: "saved", article_variants: v }));
    progress = saved(12);
    assert.equal((await picks())[0].articleId, 13);
    assert.deepEqual(offsets, [0, 12]);
    offsets = []; progress = saved(24);
    assert.equal((await picks())[0].articleId, 25);
    assert.deepEqual(offsets, [0, 12, 24]);
    offsets = []; progress = saved(25);
    assert.deepEqual(await picks(), []);
    assert.deepEqual(offsets, [0, 12, 24]);
    offsets = []; progress = [];
    articles = articles.map((v, i) => variant(v.article_id, i >= 12));
    assert.equal((await picks())[0].articleId, 13, "withdrawn first page does not hide permitted later content");
    assert.deepEqual(offsets, [0, 12]);
    offsets = []; failedOffset = 12;
    assert.deepEqual(await picks(), []);
    assert.deepEqual(offsets, [0, 12], "read failure must stop pagination");
    offsets = []; failedOffset = -1;
    progress = [{ article_id: 25, variant_id: 125, status: "completed", article_variants: variant(25) }];
    const completed = (await picks())[0];
    assert.equal(completed.articleId, 25); assert.equal(completed.completedNotSaved, true);
    assert.deepEqual(offsets, [], "completed unsaved article keeps priority without scanning");
    offsets = [];
    progress = [{ article_id: 25, variant_id: 125, status: "started", article_variants: { ...variant(25), level: 1 } }];
    const started = (await picks())[0];
    assert.equal(started.articleId, 25, "resume the opened article even when newer ones are available");
    assert.equal(started.variantId, 125);
    assert.equal(started.level, 1, "resume the actual opened variant rather than today's level");
    assert.equal(started.progressStatus, "started");
    assert.equal(started.completedNotSaved, false);
    assert.deepEqual(offsets, []);
    progress.push({ article_id: 24, variant_id: 124, status: "completed", article_variants: variant(24) });
    assert.equal((await picks())[0].articleId, 24, "completed unsaved work keeps existing priority");
    progress = [{ article_id: 25, variant_id: 125, status: "started", article_variants: variant(25, false) }];
    assert.equal((await picks())[0].articleId, 13, "withdrawn started work cannot be resumed");
    progressFailed = true;
    await assert.rejects(picks(), /읽던 아티클/);
    progressFailed = false;
    offsets = []; progress = []; articles = [variant(1)];
    assert.equal((await picks())[0].articleId, 1); assert.deepEqual(offsets, [0]);
    console.log("Feed pagination: older unread articles, started-article resume, actual variant, rights checks, progress failures and completed priority passed.");
  } finally { globalThis.fetch = originalFetch; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
