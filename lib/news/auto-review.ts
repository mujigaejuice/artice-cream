import { createHash } from "node:crypto";
import { JSDOM, VirtualConsole } from "jsdom";
import type { Attribution } from "../content-rights";
import { USER_AGENT } from "./source";

/** Versioned, deterministic checks for sources whose processing was enabled by the operator. */
export const AUTO_REVIEW_VERSION = "source-policy-v1";
export const AUTO_REVIEW_SOURCES = ["kubernetes", "go-blog", "duckdb", "rust-blog",
  "web-dev", "chrome-developers", "google-cloud-docs", "google-ml-course"] as const;
type ReviewSource = typeof AUTO_REVIEW_SOURCES[number];
export type ReviewArticle = { source: string | null; source_url: string; title: string | null };
export type AutoReviewResult =
  | { approved: true; title: string; author: string; evidenceUrl: string; attribution: Attribution; htmlSha256: string }
  | { approved: false; reason: string };

const CC_BY = "https://creativecommons.org/licenses/by/4.0/";
const K8S_LICENSE = "https://github.com/kubernetes/website/blob/main/LICENSE";
const DUCK_LICENSE = "https://github.com/duckdb/duckdb-web/blob/main/LICENSE";
const RUST_README = "https://github.com/rust-lang/blog.rust-lang.org/blob/main/README.md";
const RUST_LICENSE = "https://github.com/rust-lang/blog.rust-lang.org/blob/main/LICENSE-MIT";
const GOOGLE_NOTICE = /Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4\.0 License, and code samples are licensed under the Apache 2\.0 License\.?/i;
const CHANGES = "한국어 번역·요약과 난이도별 재작성, 용어 풀이·학습용 퀴즈를 추가했습니다. 원문 이미지·영상·코드·표·댓글은 제공하지 않습니다.";
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const titleKey = (s: string) => clean(s).toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Validate before every fetch, including redirect hops; RSS URLs cannot choose arbitrary hosts. */
function publisherUrl(source: ReviewSource, value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
    switch (source) {
      case "kubernetes": return u.hostname === "kubernetes.io" && u.pathname.startsWith("/blog/");
      case "go-blog": return u.hostname === "go.dev" && u.pathname.startsWith("/blog/");
      case "duckdb": return u.hostname === "duckdb.org" && /^\/\d{4}\/\d{2}\/\d{2}\/[\w-]+(?:\.html)?\/?$/.test(u.pathname);
      case "rust-blog": return u.hostname === "blog.rust-lang.org" && /^\/\d{4}\/\d{2}\/\d{2}\/[\w.-]+\/?$/.test(u.pathname);
      case "web-dev": return u.hostname === "web.dev" && /^\/(?:blog|articles)\//.test(u.pathname);
      case "chrome-developers": return u.hostname === "developer.chrome.com" && /^\/(?:blog|docs)\//.test(u.pathname);
      case "google-cloud-docs": return ["cloud.google.com", "docs.cloud.google.com"].includes(u.hostname) && /\/docs\//.test(u.pathname);
      case "google-ml-course": return u.hostname === "developers.google.com" && u.pathname.startsWith("/machine-learning/");
    }
  } catch { return false; }
}

function requireCheck(value: unknown, reason: string): asserts value {
  if (!value) throw new Error(reason);
}

async function readUrl(url: string, signal: AbortSignal, allowed: (url: string) => boolean): Promise<{ text: string; url: string }> {
  for (let hop = 0; hop < 4; hop++) {
    requireCheck(allowed(url), "unexpected-origin");
    const response = await fetch(url, { headers: { "user-agent": USER_AGENT, "accept-language": "en-US,en;q=0.9" }, redirect: "manual", cache: "no-store", signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      requireCheck(location, "redirect-without-location");
      url = new URL(location, url).href;
      continue;
    }
    requireCheck(response.ok, `http-${response.status}`);
    const text = await response.text();
    requireCheck(text.length <= 2_000_000, "page-too-large");
    return { text, url };
  }
  throw new Error("too-many-redirects");
}

/** Shared only within one cron run; a failed license fetch is retried on the next run. */
export function createAutoReviewer() {
  const evidenceCache = new Map<string, Promise<string>>();
  const evidence = (url: string, signal: AbortSignal) => {
    let pending = evidenceCache.get(url);
    if (!pending) {
      pending = readUrl(url, signal, candidate => candidate === url).then(r => r.text.trim());
      evidenceCache.set(url, pending);
    }
    return pending;
  };

  return async function review(article: ReviewArticle, signal: AbortSignal): Promise<AutoReviewResult> {
    if (!(AUTO_REVIEW_SOURCES as readonly string[]).includes(article.source ?? "")) return { approved: false, reason: "unsupported-source" };
    const source = article.source as ReviewSource;
    let dom: JSDOM | undefined;
    try {
      const page = await readUrl(article.source_url, signal, url => publisherUrl(source, url));
      dom = new JSDOM(page.text, { url: page.url, virtualConsole: new VirtualConsole() });
      const doc = dom.window.document;
      const boundary = doc.querySelector(source === "kubernetes" ? ".td-content" : source === "go-blog" ? ".Article, article" :
        source === "rust-blog" ? "section.white, article" : source === "duckdb" ? ".postcontent, article" : ".devsite-article-body, article, main");
      requireCheck(boundary, "missing-article-body");
      const heading = (source === "go-blog" ? boundary.querySelector("h1:not(.small)") :
        boundary.querySelector("h1") ?? doc.querySelector("h1") ?? boundary.querySelector("header h2, header"))?.cloneNode(true) as Element | undefined;
      heading?.querySelectorAll("devsite-actions, [data-nosnippet], button").forEach(n => n.remove());
      const title = clean(heading?.textContent);
      requireCheck(title, "missing-title");
      const body = boundary.cloneNode(true) as Element;
      body.querySelectorAll("script, style, noscript, pre, code, table, figure, nav, footer, .feedback, #comments, .comments").forEach(n => n.remove());
      // Exception-bearing articles are skipped automatically, without creating a manual consent task.
      requireCheck(!body.querySelector("blockquote"), "quoted-material");
      const bodyText = clean(body.textContent).replace(GOOGLE_NOTICE, "");
      requireCheck(!/(?:guest\s+(?:blog\s+)?post|mirror of the original article|reprinted\s+(?:from|with)|republished\s+(?:from|with)|all rights reserved|used (?:with|by) permission|not (?:covered|licensed) (?:by|under)|except (?:where|as) (?:otherwise )?(?:noted|indicated)|©|\bcopyright\b|\blicensed under\b)/i.test(bodyText), "article-license-exception");
      const links = [...doc.querySelectorAll<HTMLAnchorElement>("a[href]")].map(a => a.href);
      let author = "", evidenceUrl = "", licenseUrl = CC_BY, licenseLabel = "원문 CC BY 4.0", notices = "";

      if (source === "kubernetes") {
        requireCheck(/Distributed under CC BY 4\.0/.test(clean(doc.body.textContent)) &&
          links.some(url => [K8S_LICENSE, "https://git.k8s.io/website/LICENSE"].includes(url)), "missing-license-notice");
        const byline = [...doc.querySelectorAll(".td-content .td-byline, .td-content .text-muted")]
          .map(node => clean(node.textContent)).find(text => /^By\s+/i.test(text));
        author = (byline ?? "").replace(/^By\s+/i, "").split(/\s*\|\s*/)[0];
        evidenceUrl = K8S_LICENSE;
        notices = `원문 제공: The Kubernetes Authors / Kubernetes, a Series of LF Projects, LLC. 본문 CC BY 4.0. https://lfprojects.org/policies/`;
      } else if (source === "go-blog") {
        requireCheck(links.includes("https://go.dev/copyright"), "missing-license-link");
        const copyright = await evidence("https://go.dev/copyright", signal);
        requireCheck(copyright.includes(CC_BY) && /Creative Commons Attribution 4\.0/.test(copyright), "license-policy-changed");
        author = clean(doc.querySelector(".Article .author, article .author, .author")?.textContent)
          .replace(/\s+\d{1,2} [A-Za-z]+ \d{4}$/, "");
        evidenceUrl = "https://go.dev/copyright";
        notices = "원문 제공: Go Authors / Google. Go 사이트 본문 CC BY 4.0, 코드는 별도 BSD 라이선스. https://go.dev/copyright";
      } else if (source === "duckdb" || source === "rust-blog") {
        const path = new URL(page.url).pathname;
        const match = path.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/([\w.-]+?)(?:\.html)?\/?$/)!;
        const repoUrl = source === "duckdb"
          ? `https://raw.githubusercontent.com/duckdb/duckdb-web/main/_posts/${match[1]}-${match[2]}-${match[3]}-${match[4]}.md`
          : `https://raw.githubusercontent.com/rust-lang/blog.rust-lang.org/main/content/${match[4]}.md`;
        const licenseRaw = source === "duckdb" ? "https://raw.githubusercontent.com/duckdb/duckdb-web/main/LICENSE"
          : "https://raw.githubusercontent.com/rust-lang/blog.rust-lang.org/main/LICENSE-MIT";
        const [post, license, readme] = await Promise.all([evidence(repoUrl, signal), evidence(licenseRaw, signal),
          source === "rust-blog" ? evidence("https://raw.githubusercontent.com/rust-lang/blog.rust-lang.org/main/README.md", signal) : Promise.resolve("")]);
        requireCheck(/Permission is hereby granted/.test(license) && /THE SOFTWARE IS PROVIDED/.test(license), "license-policy-changed");
        if (source === "rust-blog") requireCheck(/the blog is licensed MIT\/Apache 2\.0/i.test(readme), "license-scope-changed");
        const head = post.split(source === "duckdb" ? "\n---" : "\n+++")[0];
        const repoTitle = head.match(/^title\s*[:=]\s*"(.+)"\s*$/m)?.[1];
        requireCheck(repoTitle && titleKey(repoTitle) === titleKey(title), "repository-title-mismatch");
        if (source === "duckdb") {
          author = head.match(/^authors?:\s*"(.+)"\s*$/m)?.[1] ??
            [...(head.match(/^authors?:\s*\n((?:[ \t]+-[^\n]+\n?)+)/m)?.[1] ?? "").matchAll(/^\s*-\s*(.+)$/gm)].map(m => m[1].trim()).join(", ");
        } else {
          author = [...(head.match(/^authors\s*=\s*\[([^\]]+)\]/m)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(m => m[1]).join(", ");
        }
        requireCheck(author && author.split(", ").every(name => clean(doc.body.textContent).includes(name)), "repository-author-mismatch");
        evidenceUrl = source === "duckdb" ? DUCK_LICENSE : RUST_README;
        licenseUrl = source === "duckdb" ? DUCK_LICENSE : RUST_LICENSE;
        licenseLabel = "원문 MIT License";
        notices = `원문 저작권·허락 고지(MIT License 전문): ${license}`;
      } else {
        requireCheck(GOOGLE_NOTICE.test(clean(doc.body.textContent)) && links.includes(CC_BY), "missing-license-notice");
        author = [...doc.querySelectorAll(".wd-author > div > span:first-of-type, .dcc-author > div > span:first-of-type, [rel=author]")]
          .map(n => clean(n.textContent)).filter(Boolean).filter((name, i, all) => all.indexOf(name) === i).join(", ");
        if (!author && ["google-cloud-docs", "google-ml-course"].includes(source)) author = "Google";
        evidenceUrl = page.url;
        notices = "원문 제공: Google. 본문 CC BY 4.0, 코드 샘플 Apache 2.0. https://developers.google.com/terms/site-policies";
      }
      requireCheck(author && author.length < 1000, "missing-author");
      signal.throwIfAborted();
      return { approved: true, title, author, evidenceUrl, htmlSha256: createHash("sha256").update(page.text).digest("hex"),
        attribution: { author, originalTitle: title, licenseLabel, licenseUrl,
          changes: `${source === "go-blog" || source.startsWith("google-") || ["web-dev", "chrome-developers"].includes(source) ? "Google이 제공한 원문을 바탕으로 수정했습니다. " : ""}${CHANGES}`, notices } };
    } catch (error) {
      return { approved: false, reason: signal.aborted ? "timeout" : error instanceof Error ? error.message : "review-failed" };
    } finally { dom?.window.close(); }
  };
}
