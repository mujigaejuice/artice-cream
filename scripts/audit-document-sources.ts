/** Publisher-only audit: local evidence, no database access, no LLM, no approvals. */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";
import { DOCUMENT_CANDIDATES, DOCUMENT_REVIEW_VERSION } from "../lib/news/document-candidates";
import { extractArticle } from "../lib/news/extract";
import { USER_AGENT } from "../lib/news/source";

const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
const out = `spike-out/document-sources/${new Date().toISOString().replace(/[:.]/g, "-")}`;

async function fetchHtml(url: string) {
  const origin = new URL(url).origin;
  for (let hop = 0; hop < 4; hop++) {
    if (new URL(url).origin !== origin) throw new Error("cross-origin redirect");
    const response = await fetch(url, { redirect: "manual", cache: "no-store",
      headers: { "user-agent": USER_AGENT, "accept-language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(30_000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("redirect without location");
      url = new URL(location, url).href;
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!(response.headers.get("content-type") ?? "").includes("html")) throw new Error("not HTML");
    const html = await response.text();
    if (html.length > 3_000_000) throw new Error("page too large");
    return { html, url };
  }
  throw new Error("redirect limit");
}

async function main() {
  mkdirSync(out, { recursive: true });
  const reports: Record<string, unknown>[] = [];
  for (const candidate of DOCUMENT_CANDIDATES) {
    try {
      const page = await fetchHtml(candidate.url);
      writeFileSync(`${out}/${candidate.key}.html`, page.html);
      const dom = new JSDOM(page.html, { url: page.url, virtualConsole: new VirtualConsole() });
      let metadata;
      try {
        const doc = dom.window.document;
        const root = doc.querySelector(candidate.bodySelector);
        const pageText = clean(doc.body.textContent);
        const headings = [...(root?.querySelectorAll("h1,h2,h3,h4") ?? [])].map(node => ({
          id: node.id || node.closest("section[id], div.section[id]")?.id || null, text: clean(node.textContent) }));
        const body = root?.cloneNode(true) as Element | undefined;
        body?.querySelectorAll("script,style,noscript,nav,footer,.headerlink,.md-source-file,.feedback").forEach(node => node.remove());
        const text = body?.textContent?.replace(/\n\s*\n\s*\n/g, "\n\n").trim() ?? "";
        writeFileSync(`${out}/${candidate.key}.txt`, text);
        metadata = {
          title: clean(doc.querySelector("h1")?.textContent) || candidate.title,
          rootFound: Boolean(root), chars: text.length, headings,
          authors: [...doc.querySelectorAll("[rel=author],meta[name=author]")].map(node => clean(node.getAttribute("content") || node.textContent)),
          canonical: doc.querySelector<HTMLLinkElement>('link[rel=canonical]')?.href ?? null,
          notices: [...pageText.matchAll(/.{0,100}(?:Creative Commons|Copyright|copyright|all rights reserved|used with permission|Last updated).{0,220}/g)].map(match => match[0]),
          licenseLinks: [...doc.querySelectorAll<HTMLAnchorElement>("a[href]")].filter(a => /creativecommons\.org\/licenses|legalnotice|\/LICENSE|site-policies/.test(a.href)).map(a => a.href),
          blocks: { quotes: root?.querySelectorAll("blockquote").length ?? 0, code: root?.querySelectorAll("pre").length ?? 0,
            figures: root?.querySelectorAll("figure,img").length ?? 0, math: root?.querySelectorAll(".math").length ?? 0 },
        };
      } finally { dom.window.close(); }
      const existingExtractor = await extractArticle({ url: candidate.url, title: candidate.title }, "blog");
      const report = { ...candidate, ...metadata, checkedAt: new Date().toISOString(), resolvedUrl: page.url,
        htmlSha256: createHash("sha256").update(page.html).digest("hex"),
        existingExtractor: existingExtractor.ok ? { ok: true, chars: existingExtractor.charCount,
          title: existingExtractor.title, text: existingExtractor.text } : existingExtractor };
      writeFileSync(`${out}/${candidate.key}.json`, JSON.stringify(report, null, 2));
      reports.push(report);
      console.log(JSON.stringify({ key: candidate.key, root: metadata.rootFound, chars: metadata.chars,
        extraction: existingExtractor.ok ? existingExtractor.charCount : existingExtractor.reason, blocks: metadata.blocks }));
    } catch (cause) {
      const report = { ...candidate, error: cause instanceof Error ? cause.message : String(cause) };
      reports.push(report);
      console.log(JSON.stringify(report));
    }
  }
  const evidenceUrls = [...new Set(DOCUMENT_CANDIDATES.map(candidate => candidate.evidenceUrl))];
  const evidence = [];
  for (const [index, url] of evidenceUrls.entries()) {
    try {
      const page = await fetchHtml(url);
      writeFileSync(`${out}/license-${index}.html`, page.html);
      evidence.push({ url, file: `license-${index}.html`, sha256: createHash("sha256").update(page.html).digest("hex") });
    } catch (cause) { evidence.push({ url, error: String(cause) }); }
  }
  const robots = [];
  for (const origin of [...new Set(DOCUMENT_CANDIDATES.map(candidate => new URL(candidate.url).origin))]) {
    const url = `${origin}/robots.txt`;
    try {
      const response = await fetch(url, { redirect: "error", headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(20_000) });
      const text = await response.text();
      robots.push({ url, status: response.status, text });
    } catch (cause) { robots.push({ url, error: String(cause) }); }
  }
  writeFileSync(`${out}/index.json`, JSON.stringify({ version: DOCUMENT_REVIEW_VERSION, checkedAt: new Date().toISOString(), reports, evidence, robots }, null, 2));
  console.log(JSON.stringify({ output: out, documents: reports.length, failed: reports.filter(row => row.error).length,
    note: "No database writes or LLM calls. Inspection is not approval." }));
}

main().catch(cause => { console.error(cause); process.exitCode = 1; });
