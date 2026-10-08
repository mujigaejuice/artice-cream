/** Read-only current Kubernetes/Go article review. Saves local evidence; never approves or calls LLM. */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import { SOURCES } from "../lib/news/feeds";
import { feedSources, USER_AGENT } from "../lib/news/source";
import { extractArticle } from "../lib/news/extract";
import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  mkdirSync("spike-out/licensed-review", { recursive: true });
  const reports: Record<string, unknown>[] = [];
  for (const source of feedSources(SOURCES.filter((source) => ["kubernetes", "go-blog"].includes(source.id)))) {
    for (const item of await source.fetchLatest()) {
      const expected = new URL(item.url);
      if (expected.origin !== (source.id === "kubernetes" ? "https://kubernetes.io" : "https://go.dev") || !expected.pathname.startsWith("/blog/")) throw new Error("Unexpected article URL");
      const response = await fetch(item.url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(20_000) });
      if (!response.ok || new URL(response.url).origin !== expected.origin) throw new Error(`Publisher fetch failed: ${item.url}`);
      const html = await response.text();
      const dom = new JSDOM(html, { url: response.url, virtualConsole: new VirtualConsole() });
      const doc = dom.window.document;
      const content = doc.querySelector(source.id === "kubernetes" ? ".td-content" : ".Article, article, main");
      if (!content) throw new Error(`Missing article boundary: ${item.url}`);
      const parsed = new Readability(doc.cloneNode(true) as Document).parse();
      const links = [...doc.querySelectorAll<HTMLAnchorElement>("a[href]")];
      const evidenceLinks = links.filter((link) => source.id === "kubernetes" ? /(?:git\.k8s\.io|github\.com\/kubernetes)\/website\/LICENSE/.test(link.href) : link.href === "https://go.dev/copyright");
      if (!evidenceLinks.length) throw new Error(`Article license link missing: ${item.url}`);
      const authorElements = [...doc.querySelectorAll('.author, .author-date, .td-content .text-muted, [rel="author"], .author-byline')].map((node) => node.textContent?.trim()).filter(Boolean);
      content.querySelectorAll("script,style,noscript").forEach((node) => node.remove());
      const quoted = [...content.querySelectorAll("blockquote")].map((node) => node.textContent?.trim());
      const media = [...content.querySelectorAll("img,iframe,video,audio")].map((node) => ({ tag: node.tagName, src: node.getAttribute("src"), alt: node.getAttribute("alt") }));
      const notices = content.textContent?.match(/.{0,80}(?:copyright|all rights reserved|licensed|reprinted|republished|permission|disclaimer).{0,120}/gi) ?? [];
      const publisherFooter = [...doc.querySelectorAll("footer")].map((node) => node.textContent?.replace(/\s+/g, " ").trim()).join(" ");
      const body = [...content.querySelectorAll("p,h2,h3,li")].filter((node) => !node.closest("pre,figure,table"))
        .map((node) => node.textContent?.trim()).filter(Boolean);
      const extracted = await extractArticle(item, "blog");
      const { data: stored, error } = await admin.from("articles").select("id,source,source_url,title,author,status,domain_id,fetched_at,rights_status,rights_evidence_url,rights_reviewed_at,rights_expires_at,rights_attribution,rights_review_note")
        .eq("source_url", item.url).maybeSingle();
      if (error) throw new Error(error.message);
      const report = { checkedAt: new Date().toISOString(), source: source.id, url: item.url, feedTitle: item.title,
        publishedAt: item.publishedAt?.toISOString(), htmlSha256: createHash("sha256").update(html).digest("hex"),
        parsedTitle: parsed?.title, parsedByline: parsed?.byline, authorElements,
        licenseLinks: evidenceLinks.map((link) => ({ text: link.textContent?.trim(), url: link.href })), publisherFooter, quoted, media, notices, body, extracted, stored };
      const slug = expected.pathname.split("/").filter(Boolean).pop()!;
      writeFileSync(`spike-out/licensed-review/${source.id}-${slug}.json`, JSON.stringify(report, null, 2));
      reports.push(report);
      console.log(JSON.stringify({ source: report.source, url: item.url, title: report.parsedTitle, byline: report.parsedByline, authorElements, quotes: quoted.length, media: media.length, notices, extraction: extracted.ok ? { ok: true, chars: extracted.charCount } : extracted, storedId: stored?.id, storedStatus: stored?.status }));
      dom.window.close();
    }
  }
  writeFileSync("spike-out/licensed-review/index.json", JSON.stringify(reports, null, 2));
}
main().catch((cause: unknown) => { console.error(cause instanceof Error ? cause.message : "Review failed"); process.exitCode = 1; });
