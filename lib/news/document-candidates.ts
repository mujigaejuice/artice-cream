/** Explicit document inventory. Inclusion grants no collection, processing, or publication rights. */
export const DOCUMENT_REVIEW_VERSION = "document-candidates-v1";

export type DocumentCandidate = {
  key: string;
  source: string;
  url: string;
  title: string;
  domain: string;
  bodySelector: string;
  license: "CC-BY-4.0" | "CC-BY-SA-4.0" | "PostgreSQL";
  evidenceUrl: string;
  /** Complete heading ranges: inclusive start, exclusive end. No character truncation. */
  sections?: readonly { start: string; end: string }[];
  hold?: string;
};

const google = { bodySelector: ".devsite-article-body", license: "CC-BY-4.0" as const,
  evidenceUrl: "https://developers.google.com/terms/site-policies" };
const genai = { source: "owasp-genai", domain: "ai-security", bodySelector: ".xpro-elementor-content",
  license: "CC-BY-SA-4.0" as const, evidenceUrl: "https://genai.owasp.org/project-submissions/" };
const cheatsheets = { source: "owasp-cheatsheets", domain: "security", bodySelector: "article.md-content__inner",
  license: "CC-BY-SA-4.0" as const, evidenceUrl: "https://cheatsheetseries.owasp.org/" };
const postgres = { source: "postgresql-docs", bodySelector: "#docContent", license: "PostgreSQL" as const,
  evidenceUrl: "https://www.postgresql.org/docs/18/legalnotice.html" };
const d2l = { source: "d2l-book", domain: "deep-learning", bodySelector: "div[role=main]",
  license: "CC-BY-SA-4.0" as const, evidenceUrl: "https://github.com/d2l-ai/d2l-en/blob/master/LICENSE" };

export const DOCUMENT_CANDIDATES: readonly DocumentCandidate[] = [
  { ...google, key: "google-ml-neural-networks", source: "google-ml-course", domain: "deep-learning",
    title: "Neural networks", url: "https://developers.google.com/machine-learning/crash-course/neural-networks",
    hold: "Figure-dependent explanation; select a self-contained text lesson before processing." },
  { ...google, key: "google-ml-language-models", source: "google-ml-course", domain: "llm",
    title: "Introduction to Large Language Models", url: "https://developers.google.com/machine-learning/crash-course/llm",
    sections: [{ start: "what_is_a_language_model", end: "context" }] },
  { ...google, key: "google-cloud-compute-instances", source: "google-cloud-docs", domain: "cloud",
    title: "Compute Engine instances", url: "https://docs.cloud.google.com/compute/docs/instances",
    sections: [{ start: "introduction", end: "instances_and_containers" }] },
  { ...google, key: "google-cloud-storage-objects", source: "google-cloud-docs", domain: "cloud",
    title: "About Cloud Storage objects", url: "https://docs.cloud.google.com/storage/docs/objects",
    sections: [{ start: "objects", end: "naming" }, { start: "immutability", end: "whats_next" }] },
  { ...genai, key: "owasp-genai-prompt-injection", title: "LLM01:2025 Prompt Injection",
    url: "https://genai.owasp.org/llmrisk/llm01-prompt-injection/" },
  { ...genai, key: "owasp-genai-information-disclosure", title: "LLM02:2025 Sensitive Information Disclosure",
    url: "https://genai.owasp.org/llmrisk/llm022025-sensitive-information-disclosure/" },
  { ...cheatsheets, key: "owasp-authentication", title: "Authentication Cheat Sheet",
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
    sections: [{ start: "introduction", end: "authentication-general-guidelines" },
      { start: "user-ids", end: "authentication-solution-and-sensitive-accounts" }] },
  { ...cheatsheets, key: "owasp-authorization", title: "Authorization Cheat Sheet",
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html",
    sections: [{ start: "enforce-least-privileges", end: "thoroughly-review-the-authorization-logic-of-chosen-tools-and-technologies-implementing-custom-logic-if-necessary" }] },
  { ...postgres, key: "postgresql-querying", domain: "data", title: "Querying a Table",
    url: "https://www.postgresql.org/docs/18/tutorial-select.html" },
  { ...postgres, key: "postgresql-indexes", domain: "cs-fundamentals", title: "Introduction to Indexes",
    url: "https://www.postgresql.org/docs/18/indexes-intro.html" },
  { ...d2l, key: "d2l-linear-regression", title: "Linear Regression",
    url: "https://d2l.ai/chapter_linear-regression/linear-regression.html",
    hold: "Long math/figure-heavy chapter; repository revision match and bounded text lesson still required. robots.txt check unresolved." },
  { ...d2l, key: "d2l-generalization", title: "Generalization",
    url: "https://d2l.ai/chapter_linear-regression/generalization.html",
    hold: "Math/figure-dependent chapter; repository revision match and bounded text lesson still required. robots.txt check unresolved." },
];

/** Preserve meaningful query parameters, but collapse known locale, tracking, and trailing-slash aliases. */
export function documentUrlKey(value: string): string {
  const url = new URL(value.replace(/&#0?38;/g, "&amp;").replace(/&amp;/g, "&"));
  url.hash = "";
  if (url.hostname === "cloud.google.com" && url.pathname.includes("/docs/")) url.hostname = "docs.cloud.google.com";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|gclid$|fbclid$|hl$)/.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/$/, "");
  return url.href;
}

/** These sources collect from the explicit inventory, never from an RSS fallback. */
export const DOCUMENT_SOURCE_IDS = new Set(DOCUMENT_CANDIDATES.map(candidate => candidate.source));

export function findDocumentCandidate(source: string | null, url: string): DocumentCandidate | undefined {
  try {
    return DOCUMENT_CANDIDATES.find(candidate => candidate.source === source && documentUrlKey(candidate.url) === documentUrlKey(url));
  } catch { return undefined; }
}
