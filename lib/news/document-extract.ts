import { JSDOM, VirtualConsole } from "jsdom";
import type { DocumentCandidate } from "./document-candidates";

/** Deterministic section extraction, shared by acquisition and the cron document reviewer. */
export function extractDocumentSnapshot(html: string, candidate: DocumentCandidate) {
  const dom = new JSDOM(html, { url: candidate.url, virtualConsole: new VirtualConsole() });
  try {
    const doc = dom.window.document;
    const lang = doc.documentElement.lang;
    if (lang && !/^en(?:-|$)/i.test(lang)) throw new Error(`unexpected-language:${lang}`);
    const roots = doc.querySelectorAll(candidate.bodySelector);
    if (roots.length !== 1) throw new Error(`ambiguous-body:${roots.length}`);
    const root = roots[0];
    const selected = doc.createElement("div");
    if (candidate.sections) {
      let previousEnd: Element | undefined;
      const anchors = [...root.querySelectorAll("[id]")];
      for (const section of candidate.sections) {
        const starts = anchors.filter(node => node.id === section.start);
        const ends = anchors.filter(node => node.id === section.end);
        if (starts.length !== 1 || ends.length !== 1) throw new Error(`missing-or-duplicate-section:${section.start}`);
        const start = starts[0], end = ends[0];
        const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
        if (!follows(start, end) || start.contains(end)) throw new Error("invalid-section-order");
        if (previousEnd && previousEnd !== start && !follows(previousEnd, start)) throw new Error("overlapping-sections");
        const range = doc.createRange();
        range.setStartBefore(start);
        range.setEndBefore(end);
        selected.append(range.cloneContents());
        previousEnd = end;
      }
    } else selected.append(root.cloneNode(true));
    selected.querySelectorAll("script,style,noscript,nav,footer,.navheader,.navfooter,.headerlink,.md-source-file,.feedback,.sharedaddy,.robots-nocontent,devsite-feedback,devsite-key-takeaways-panel").forEach(node => node.remove());
    const dependencies = {
      figures: selected.querySelectorAll("figure,img,svg").length,
      math: selected.querySelectorAll(".math").length,
      quotes: selected.querySelectorAll("blockquote").length,
      codeBlocks: selected.querySelectorAll("pre").length,
    };
    const references = [...selected.querySelectorAll<HTMLAnchorElement>("a[href]")]
      .filter(node => /^https?:/.test(node.href))
      .map(node => ({ title: (node.textContent ?? "").replace(/\s+/g, " ").trim(), url: node.href }));
    // Keep code tokens, examples, table cells and captions. Never silently remove their meaning.
    const visit = (node: Node): string => {
      if (node.nodeType === dom.window.Node.TEXT_NODE) return node.textContent ?? "";
      if (node.nodeType !== dom.window.Node.ELEMENT_NODE) return [...node.childNodes].map(visit).join("");
      const element = node as Element;
      const tag = element.tagName.toLowerCase();
      if (tag === "br") return "\n";
      if (tag === "img") return `[Image: ${element.getAttribute("alt") || "no description"}]`;
      if (tag === "pre") return `\n\n${element.textContent}\n\n`;
      const value = [...node.childNodes].map(visit).join("");
      if (/^(td|th)$/.test(tag)) return `${value.trim()} | `;
      if (/^(p|h[1-6]|div|section|li|tr|table|ul|ol|blockquote|figure)$/.test(tag)) return `\n${value}\n`;
      return value;
    };
    const text = visit(selected).replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    const titleNode = doc.querySelector(candidate.source === "owasp-genai" ? ".xpro-post-title" : "h1")?.cloneNode(true) as Element | undefined;
    titleNode?.querySelectorAll("devsite-actions,.headerlink,a,button,[hidden]").forEach(node => node.remove());
    const title = (titleNode?.textContent || candidate.title).replace(/\s+/g, " ").trim();
    return { title, text, chars: text.length, lang: lang || null, dependencies, references };
  } finally { dom.window.close(); }
}
