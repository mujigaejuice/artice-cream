/** Read-only live evidence/feed probe. No DB writes, LLM calls, or permission approvals. */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JSDOM, VirtualConsole } from "jsdom";
import { SOURCES } from "../lib/news/feeds";
import { SOURCE_CANDIDATES } from "../lib/news/source-candidates";
import { parseFeed, USER_AGENT } from "../lib/news/source";

async function download(url: string) {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  const final = new URL(response.url);
  if (final.protocol !== "https:") throw new Error("Non-HTTPS redirect");
  return { url: response.url, status: response.status, contentType: response.headers.get("content-type"), body: await response.text() };
}
async function inspect(url: string) {
  const response = await download(url);
  if (response.status !== 200) return { url: response.url, status: response.status };
  const dom = new JSDOM(response.body, { url: response.url, virtualConsole: new VirtualConsole() });
  const doc = dom.window.document;
  doc.querySelectorAll("script,style,noscript").forEach((node) => node.remove());
  const clean = (value: string | null | undefined) => value?.replace(/\s+/g, " ").trim() ?? "";
  const body = clean(doc.body.textContent);
  const result = { url: response.url, status: response.status, sha256: createHash("sha256").update(response.body).digest("hex"),
    title: clean(doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? doc.querySelector("article h1, main h1, h1")?.textContent ?? doc.title),
    author: clean(doc.querySelector('meta[name="author"]')?.getAttribute("content") ?? doc.querySelector('.byline, [rel="author"], .author, .author-date')?.textContent),
    licenseLinks: [...doc.querySelectorAll<HTMLAnchorElement>('a[href]')].filter((a) => /creativecommons\.org\/licenses|\/LICENSE|site-policies|terms-and-conditions|\/copyright/i.test(a.href))
      .map((a) => ({ label: clean(a.textContent), url: a.href })),
    feeds: [...doc.querySelectorAll<HTMLLinkElement>('link[rel="alternate"]')].filter((link) => /rss|atom/.test(link.type)).map((link) => link.href),
    licenseEvidence: [...body.matchAll(/.{0,100}(?:Creative Commons|licensed under|Copyright 2009|MIT\/Apache|CC BY-SA|CC-BY-SA|AS IS|Permission is hereby).{0,200}/gi)].map((match) => match[0]).slice(0, 12),
  };
  dom.window.close();
  return result;
}
async function main() {
  for (const candidate of SOURCE_CANDIDATES) {
    if (SOURCES.filter((source) => source.id === candidate.source.id && source.url === candidate.source.url).length !== 1) {
      throw new Error(`Candidate/catalog mismatch: ${candidate.source.id}`);
    }
  }
  mkdirSync("spike-out/source-candidates", { recursive: true });
  const queue = [...SOURCE_CANDIDATES];
  const reports: Record<string, unknown>[] = [];
  async function worker() {
    for (let candidate = queue.shift(); candidate; candidate = queue.shift()) {
      const report: Record<string, unknown> = { id: candidate.source.id, name: candidate.name, checkedAt: new Date().toISOString(), license: candidate.license, scope: candidate.scope };
      try {
        const feed = await download(candidate.source.url);
        const entries = feed.status === 200 ? parseFeed(feed.body) : [];
        report.feed = { requested: candidate.source.url, finalUrl: feed.url, status: feed.status, entries: entries.length,
          recent14Days: entries.filter((e) => e.publishedAt >= Date.now() - 14 * 86_400_000).length,
          latest: entries.slice(0, 2).map((e) => ({ title: e.title, url: e.link, publishedAt: e.publishedAt ? new Date(e.publishedAt).toISOString() : null })) };
        report.evidence = await inspect(candidate.evidenceUrl);
        if (candidate.repositorySampleUrl) {
          const repository = await download(candidate.repositorySampleUrl);
          report.repositorySample = { url: repository.url, status: repository.status,
            sha256: createHash("sha256").update(repository.body).digest("hex"),
            title: repository.body.match(/^title\s*[:=]\s*["']?(.+?)["']?\s*$/m)?.[1],
            author: repository.body.match(/^authors?\s*[:=]\s*(.+)$/m)?.[1] };
        }
        const sampleUrl = entries.find((e) => e.link.startsWith("https://"))?.link ?? candidate.sampleUrl;
        report.sample = await inspect(sampleUrl);
      } catch (cause: unknown) { report.error = cause instanceof Error ? cause.message : "Probe failed"; }
      reports.push(report);
      writeFileSync(`spike-out/source-candidates/${candidate.source.id}.json`, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ id: report.id, feed: report.feed, error: report.error }));
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  reports.sort((a, b) => SOURCE_CANDIDATES.findIndex((c) => c.source.id === a.id) - SOURCE_CANDIDATES.findIndex((c) => c.source.id === b.id));
  writeFileSync("spike-out/source-candidates/index.json", JSON.stringify(reports, null, 2));
  if (reports.some((report) => {
    const feed = report.feed as { status?: number; entries?: number } | undefined;
    const evidence = report.evidence as { status?: number } | undefined;
    const sample = report.sample as { status?: number } | undefined;
    const repository = report.repositorySample as { status?: number } | undefined;
    return report.error || feed?.status !== 200 || !feed.entries || evidence?.status !== 200 || sample?.status !== 200 || (repository && repository.status !== 200);
  })) throw new Error("Some probes failed; inspect spike-out/source-candidates/index.json before registering permissions.");
}
main().catch((cause: unknown) => { console.error(cause instanceof Error ? cause.message : "Audit failed"); process.exitCode = 1; });
