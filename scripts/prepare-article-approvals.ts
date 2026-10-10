/**
 * Prepare guarded SQL for manually reviewed article-level rights approvals
 * (Kubernetes CC BY 4.0, DuckDB MIT, Rust MIT, web.dev / Chrome CC BY 4.0).
 * Reads the DB and the publisher pages; writes only local files under spike-out/article-approvals/<batch>.
 * It never approves anything itself and never calls an LLM.
 *
 * Run: BATCH=batch2 node --env-file=.env.local --import=tsx scripts/prepare-article-approvals.ts
 * A target that is already `permitted` is skipped, so earlier batches can stay in the list.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";
import { createAdminClient } from "../lib/supabase/admin";
import { extractArticle } from "../lib/news/extract";
import { USER_AGENT } from "../lib/news/source";
import { MAX_BLOG_BODY_CHARS } from "../lib/policy";
import type { Attribution } from "../lib/content-rights";

const REVIEWED_ON = "2026-10-09";
const BATCH = process.env.BATCH ?? "batch1";
const OUT_DIR = `spike-out/article-approvals/${BATCH}`;
const CHANGES = "ARTICECREAM 가공본은 한국어 번역·요약과 난이도별 재작성, 용어 풀이·학습용 퀴즈로 구성됩니다. 원문 이미지·코드·댓글은 제공하지 않습니다.";
const GOOGLE_CHANGES = `Google이 제공한 원문을 바탕으로 수정했습니다. ${CHANGES}`;
/** Words that signal a rights notice inside the article body. Every match must be read by a person. */
const NOTICE_PATTERN = /.{0,80}(?:copyright|all rights reserved|licensed|reprinted|republished|permission|disclaimer).{0,120}/gi;

type SourceId = "kubernetes" | "duckdb" | "rust-blog" | "web-dev" | "chrome-developers";
type Target = {
  id: number;
  source: SourceId;
  /** Names exactly as the publisher prints them. */
  authors: string[];
  /** How many NOTICE_PATTERN hits a person has read and judged to be ordinary technical prose. */
  readNoticeHits: number;
};

const TARGETS: Target[] = [
  { id: 530, source: "kubernetes", authors: ["Natalie Fisher"], readNoticeHits: 0 },
  { id: 531, source: "kubernetes", authors: ["Roman Bednář"], readNoticeHits: 0 },
  // 16 hits, all "permission" as Unix file permissions (emptyDir permission modes). Read 2026-10-09.
  { id: 532, source: "kubernetes", authors: ["Nispriha Jagan", "Neeraj Krishna Gopalakrishna"], readNoticeHits: 16 },
  { id: 533, source: "kubernetes", authors: ["Kevin Torres Martinez"], readNoticeHits: 0 },
  { id: 1824, source: "kubernetes", authors: ["Paco Xu"], readNoticeHits: 0 },
  { id: 1822, source: "duckdb", authors: ["The DuckDB team"], readNoticeHits: 0 },
  { id: 819, source: "duckdb", authors: ["The DuckDB team"], readNoticeHits: 0 },
  { id: 1828, source: "rust-blog", authors: ["Mateusz Mikuła", "Ralf Jung"], readNoticeHits: 0 },
  { id: 1829, source: "rust-blog", authors: ["The Rust Release Team"], readNoticeHits: 0 },
  // 1 hit: Firefox's "site permission add-on" (a browser feature name). Read 2026-10-09.
  { id: 1826, source: "web-dev", authors: ["Rachel Andrew"], readNoticeHits: 1 },
  { id: 1827, source: "chrome-developers", authors: ["Matthias Rohmer"], readNoticeHits: 0 },
];

const K8S_NOTICES = "원문 저작권: © 2026 The Kubernetes Authors; © 2026 Kubernetes, a Series of LF Projects, LLC. 본문 CC BY 4.0. 프로젝트 정책: https://lfprojects.org/policies/";
const K8S_LICENSE = "https://github.com/kubernetes/website/blob/main/LICENSE";
const DUCKDB_LICENSE = "https://github.com/duckdb/duckdb-web/blob/main/LICENSE";
const DUCKDB_LICENSE_RAW = "https://raw.githubusercontent.com/duckdb/duckdb-web/main/LICENSE";
const DUCKDB_COPYRIGHT = "Copyright 2018-2025 Stichting DuckDB Foundation";
const RUST_README_RAW = "https://raw.githubusercontent.com/rust-lang/blog.rust-lang.org/main/README.md";
const RUST_README = "https://github.com/rust-lang/blog.rust-lang.org/blob/main/README.md";
const RUST_MIT = "https://github.com/rust-lang/blog.rust-lang.org/blob/main/LICENSE-MIT";
const RUST_MIT_RAW = "https://raw.githubusercontent.com/rust-lang/blog.rust-lang.org/main/LICENSE-MIT";
const GOOGLE_POLICY = "https://developers.google.com/terms/site-policies";
const CC_BY_4 = "https://creativecommons.org/licenses/by/4.0/";
const GOOGLE_PAGE_NOTICE = /Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4\.0 License, and code samples are licensed under the Apache 2\.0 License/;

const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sqlJson = (value: unknown) => `${sqlString(JSON.stringify(value))}::jsonb`;
const clean = (value: string | null | undefined) => value?.replace(/\s+/g, " ").trim() ?? "";

async function get(url: string) {
  return fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(25_000), cache: "no-store" });
}

async function rawText(url: string, label: string): Promise<string> {
  const response = await get(url);
  assert.equal(response.status, 200, `${label} fetch`);
  return (await response.text()).trim();
}

async function duckdbLicenseText(): Promise<string> {
  const text = await rawText(DUCKDB_LICENSE_RAW, "DuckDB LICENSE");
  assert.ok(text.startsWith(DUCKDB_COPYRIGHT), "DuckDB LICENSE copyright line changed; re-review");
  assert.ok(text.includes("Permission is hereby granted") && text.includes("THE SOFTWARE IS PROVIDED"), "DuckDB LICENSE body changed");
  return text;
}

async function rustLicenseText(): Promise<string> {
  assert.match(await rawText(RUST_README_RAW, "Rust README"), /the blog is licensed MIT\/Apache 2\.0/, "Rust README licence statement changed; re-review");
  const text = await rawText(RUST_MIT_RAW, "Rust LICENSE-MIT");
  assert.ok(text.startsWith("Permission is hereby granted") && text.includes("THE SOFTWARE IS PROVIDED"), "Rust LICENSE-MIT body changed");
  return text;
}

async function duckdbFrontMatter(sourceUrl: string): Promise<{ author: string; title: string; repoUrl: string }> {
  const m = new URL(sourceUrl).pathname.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/(.+?)(?:\.html)?$/);
  assert.ok(m, `Unexpected DuckDB URL: ${sourceUrl}`);
  const repoUrl = `https://raw.githubusercontent.com/duckdb/duckdb-web/main/_posts/${m[1]}-${m[2]}-${m[3]}-${m[4]}.md`;
  const head = (await rawText(repoUrl, `DuckDB repo file for ${sourceUrl}`)).split("\n---")[0];
  const author = head.match(/^author:\s*"(.+)"\s*$/m)?.[1];
  const title = head.match(/^title:\s*"(.+)"\s*$/m)?.[1];
  assert.ok(author && title, "front matter author/title");
  return { author, title, repoUrl };
}

async function rustFrontMatter(sourceUrl: string): Promise<{ authors: string[]; title: string; repoUrl: string }> {
  const slug = new URL(sourceUrl).pathname.split("/").filter(Boolean).pop()!;
  const repoUrl = `https://raw.githubusercontent.com/rust-lang/blog.rust-lang.org/main/content/${slug}.md`;
  // The file opens with "+++", so the first "\n+++" is the closing delimiter.
  const head = (await rawText(repoUrl, `Rust repo file for ${sourceUrl}`)).split("\n+++")[0];
  const authorsRaw = head.match(/^authors\s*=\s*\[(.+)\]\s*$/m)?.[1];
  const title = head.match(/^title\s*=\s*"(.+)"\s*$/m)?.[1];
  assert.ok(authorsRaw && title, "front matter authors/title");
  return { authors: [...authorsRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1]), title, repoUrl };
}

/** The element whose text must contain every author name. */
function bylineSelector(source: SourceId): string | null {
  return ({ kubernetes: null, duckdb: null, "rust-blog": ".publish-date-author", "web-dev": ".wd-authors", "chrome-developers": ".dcc-authors" } as const)[source];
}

async function main() {
  assert.match(BATCH, /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "BATCH must be a simple directory name");
  assert.ok(!existsSync(OUT_DIR), "batch directory already exists; use a new BATCH to preserve review evidence");
  const admin = createAdminClient();
  const duckdbText = TARGETS.some((t) => t.source === "duckdb") ? await duckdbLicenseText() : "";
  const rustText = TARGETS.some((t) => t.source === "rust-blog") ? await rustLicenseText() : "";
  const statements = ["begin;"];
  const backup: unknown[] = [];
  const planned: unknown[] = [];
  const evidence: unknown[] = [];
  const skipped: number[] = [];

  for (const target of TARGETS) {
    const { data: article, error } = await admin.from("articles")
      .select("id,source,source_url,title,author,status,rights_status,rights_evidence_url,rights_reviewed_at,rights_expires_at,rights_attribution,rights_review_note")
      .eq("id", target.id).single();
    if (error) throw new Error(error.message);
    if (article.rights_status === "permitted") { skipped.push(article.id); continue; }
    assert.equal(article.source, target.source, `article ${target.id} source`);
    assert.equal(article.status, "pending", `article ${target.id} must be pending`);
    assert.equal(article.rights_status, "unreviewed", `article ${target.id} must be unreviewed`);

    const response = await get(article.source_url);
    assert.equal(response.status, 200, `publisher page ${article.source_url}`);
    assert.equal(new URL(response.url).origin, new URL(article.source_url).origin, "publisher redirect left the origin");
    const html = await response.text();
    const dom = new JSDOM(html, { url: response.url, virtualConsole: new VirtualConsole() });
    const doc = dom.window.document;
    const boundarySelector = target.source === "kubernetes" ? ".td-content" : target.source === "rust-blog" ? "section.white" : "article, main";
    const boundary = doc.querySelector(boundarySelector);
    assert.ok(boundary, `article boundary missing: ${article.source_url}`);
    boundary.querySelectorAll("script,style,noscript").forEach((node) => node.remove());

    const bodyText = clean(boundary.textContent);
    // Rust's blog has no <h1>; its title sits in <header>.
    const pageTitle = clean((boundary.querySelector("h1") ?? doc.querySelector("h1") ?? boundary.querySelector("header"))?.textContent);
    assert.ok(pageTitle.includes(clean(article.title).slice(0, 40)), `page title does not match stored title for ${target.id}`);
    const selector = bylineSelector(target.source);
    const bylineText = selector ? clean(doc.querySelector(selector)?.textContent) : bodyText;
    assert.ok(bylineText, `byline element missing (${selector}) for ${target.id}`);
    for (const name of target.authors) assert.ok(bylineText.includes(name), `byline lacks "${name}" for ${target.id}`);
    assert.equal(boundary.querySelectorAll("blockquote").length, 0, `article ${target.id} quotes other material`);
    // Google pages print their standard licence sentence inside the article area. That sentence is
    // what we verify below, not an exception, so it is not counted as a hit.
    const hits = bodyText.replace(GOOGLE_PAGE_NOTICE, "").match(NOTICE_PATTERN) ?? [];
    assert.equal(hits.length, target.readNoticeHits, `article ${target.id} notice hits changed; read them: ${JSON.stringify(hits)}`);

    const extracted = await extractArticle({ url: article.source_url, title: article.title }, "blog");
    assert.ok(extracted.ok, `extraction failed for ${target.id}: ${JSON.stringify(extracted)}`);
    assert.ok(extracted.charCount <= MAX_BLOG_BODY_CHARS);

    const author = target.authors.join(", ");
    let attribution: Attribution;
    let evidenceUrl: string;
    let scopeNote: string;
    if (target.source === "kubernetes") {
      assert.ok(/Distributed under CC BY 4\.0/.test(clean(doc.body.textContent)), `CC BY 4.0 footer missing for ${target.id}`);
      assert.ok([...doc.querySelectorAll<HTMLAnchorElement>("a[href]")].some((a) => /\/website\/LICENSE$/.test(a.href)), "website LICENSE link missing");
      evidenceUrl = K8S_LICENSE;
      scopeNote = "CC BY 4.0 footer and website LICENSE link verified";
      attribution = { author, originalTitle: article.title, licenseLabel: "원문 CC BY 4.0", licenseUrl: CC_BY_4, changes: CHANGES, notices: K8S_NOTICES };
    } else if (target.source === "duckdb") {
      const front = await duckdbFrontMatter(article.source_url);
      assert.equal(front.author, author, `repo author differs for ${target.id}`);
      assert.equal(front.title, article.title, `repo title differs for ${target.id}`);
      evidenceUrl = DUCKDB_LICENSE;
      scopeNote = `duckdb-web repository post matches (${front.repoUrl}); repository LICENSE is MIT`;
      attribution = { author, originalTitle: article.title, licenseLabel: "원문 MIT License", licenseUrl: DUCKDB_LICENSE, changes: CHANGES,
        notices: `원문 저작권·허락 고지(MIT License 전문, 원문 그대로): ${duckdbText}` };
    } else if (target.source === "rust-blog") {
      const front = await rustFrontMatter(article.source_url);
      assert.deepEqual(front.authors, target.authors, `repo authors differ for ${target.id}`);
      assert.equal(front.title, article.title, `repo title differs for ${target.id}`);
      evidenceUrl = RUST_README;
      scopeNote = `blog repository post matches (${front.repoUrl}); README states MIT/Apache 2.0, MIT selected`;
      attribution = { author, originalTitle: article.title, licenseLabel: "원문 MIT License", licenseUrl: RUST_MIT, changes: CHANGES,
        notices: `Rust 블로그 저장소는 블로그를 MIT/Apache 2.0으로 허락하며 MIT를 선택했습니다. 허락문(원문 그대로): ${rustText}` };
    } else {
      assert.match(clean(doc.body.textContent), GOOGLE_PAGE_NOTICE, `Google CC BY 4.0 page notice missing for ${target.id}`);
      assert.ok([...doc.querySelectorAll<HTMLAnchorElement>("a[href]")].some((a) => a.href === CC_BY_4), "CC BY 4.0 link missing");
      const site = target.source === "web-dev" ? "web.dev" : "Chrome for Developers";
      evidenceUrl = article.source_url;
      scopeNote = "page carries the CC BY 4.0 (text) / Apache 2.0 (code) notice";
      attribution = { author, originalTitle: article.title, licenseLabel: "원문 CC BY 4.0", licenseUrl: CC_BY_4, changes: GOOGLE_CHANGES,
        notices: `원문 제공: Google (${site}). 본문은 CC BY 4.0, 코드 샘플은 Apache 2.0이며 구분됩니다. Google 사이트 정책: ${GOOGLE_POLICY}` };
    }

    const htmlSha = createHash("sha256").update(html).digest("hex");
    const note = `Reviewed current publisher article, authors, license scope (${scopeNote}), no blockquote, no body-text rights notices, and prose-only extraction on ${REVIEWED_ON}. Media and code excluded. Publisher HTML SHA256 ${htmlSha}. Text rights approved; actual processing/publication remain governed by separate source flags. LLM provider decision pending.`;

    statements.push(`do $$ begin if not exists (select 1 from public.articles where id=${article.id} and source=${sqlString(article.source)} and source_url=${sqlString(article.source_url)} and status='pending' and rights_status='unreviewed' and author is not distinct from ${article.author === null ? "null::text" : sqlString(article.author)} and rights_attribution is not distinct from ${article.rights_attribution === null ? "null::jsonb" : sqlJson(article.rights_attribution)} and rights_review_note=${sqlString(article.rights_review_note)}) then raise exception 'Article ${article.id} changed; re-review required'; end if; end $$;`);
    statements.push(`update public.articles set author=${sqlString(author)}, rights_status='permitted', rights_evidence_url=${sqlString(evidenceUrl)}, rights_reviewed_at=now(), rights_attribution=${sqlJson(attribution)}, rights_review_note=${sqlString(note)} where id=${article.id};`);
    backup.push(article);
    planned.push({ id: article.id, source: target.source, url: article.source_url, attribution, note, evidenceUrl });
    evidence.push({ id: article.id, source: target.source, title: article.title, authors: target.authors, chars: extracted.charCount, quotes: 0, noticeHits: hits.length, scope: scopeNote });
    dom.window.close();
  }

  statements.push("commit;");
  mkdirSync("spike-out/article-approvals", { recursive: true });
  mkdirSync(OUT_DIR);
  writeFileSync(`${OUT_DIR}/before.json`, JSON.stringify(backup, null, 2));
  writeFileSync(`${OUT_DIR}/planned.json`, JSON.stringify(planned, null, 2));
  writeFileSync(`${OUT_DIR}/approve.sql`, statements.join("\n\n") + "\n");
  console.log(JSON.stringify({ prepared: planned.length, skippedAlreadyApproved: skipped, sql: `${OUT_DIR}/approve.sql`, evidence }, null, 1));
}

main().catch((cause: unknown) => { console.error(cause instanceof Error ? cause.message : "Preparation failed"); process.exitCode = 1; });
