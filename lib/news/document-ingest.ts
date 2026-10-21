import { createHash } from "node:crypto";
import { JSDOM, VirtualConsole } from "jsdom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSourceRights, sourceAllows, type ArticleRights, type SourceRights } from "../content-rights";
import { DOCUMENT_CANDIDATES, DOCUMENT_SOURCE_IDS, documentUrlKey, findDocumentCandidate, type DocumentCandidate } from "./document-candidates";
import { DOCUMENT_APPROVALS } from "./document-approvals";
import { extractDocumentSnapshot } from "./document-extract";
import type { ExtractResult } from "./extract";
import { mapPool, type Deadline } from "./ingest";
import { USER_AGENT } from "./source";

export const DOCUMENT_INGEST_VERSION = "document-cron-v1";
const DAY = 86_400_000;
const RECHECK_DAYS = 7;
const PERMISSION_DAYS = 30;
const RETRY_HOURS = 12;
const TIMEOUT_MS = 20_000;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

type DocumentRow = ArticleRights & {
  id: number; source_url: string; original_text: string | null; rights_review_note: string;
  domain_id: number | null; published_at: string | null;
};

function requireCheck(value: unknown, reason: string): asserts value {
  if (!value) throw new Error(reason);
}

/** Bound response size and validate each redirect against the exact inventory URL. */
async function readHtml(url: string, allowed: (url: string) => boolean, signal: AbortSignal) {
  for (let hop = 0; hop < 4; hop++) {
    requireCheck(allowed(url), "document-redirect-outside-inventory");
    const response = await fetch(url, { redirect: "manual", cache: "no-store", signal,
      headers: { "user-agent": USER_AGENT, "accept-language": "en-US,en;q=0.9" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      requireCheck(location, "document-redirect-missing-location");
      url = new URL(location, url).href;
      continue;
    }
    requireCheck(response.ok, `document-http-${response.status}`);
    requireCheck(response.headers.get("content-type")?.includes("html"), "document-not-html");
    const reader = response.body?.getReader();
    requireCheck(reader, "document-empty-response");
    const decoder = new TextDecoder();
    let bytes = 0, html = "";
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        requireCheck(bytes <= 3_000_000, "document-page-too-large");
        html += decoder.decode(part.value, { stream: true });
      }
      return html + decoder.decode();
    } finally { await reader.cancel(); }
  }
  throw new Error("document-redirect-limit");
}

/** Compare the selected body with the reviewed snapshot and check the live publisher notice. */
export async function reviewDocument(candidate: DocumentCandidate, signal: AbortSignal) {
  const approval = DOCUMENT_APPROVALS[candidate.key];
  requireCheck(approval && !candidate.hold, "document-not-approved");
  const html = await readHtml(candidate.url, url => Boolean(findDocumentCandidate(candidate.source, url)?.key === candidate.key), signal);
  const snapshot = extractDocumentSnapshot(html, candidate);
  requireCheck(snapshot.chars >= 600 && snapshot.chars <= 15_000, "document-length");
  requireCheck(!snapshot.dependencies.figures && !snapshot.dependencies.math && !snapshot.dependencies.quotes, "document-dependencies");
  requireCheck(sha(snapshot.text) === approval.textSha256, "document-content-changed");
  const dom = new JSDOM(html, { url: candidate.url, virtualConsole: new VirtualConsole() });
  try {
    dom.window.document.querySelectorAll("script,style,noscript").forEach(n => n.remove());
    const text = dom.window.document.body.textContent?.replace(/\s+/g, " ") ?? "";
    const links = [...dom.window.document.querySelectorAll<HTMLAnchorElement>("a[href]")].map(a => a.href);
    if (candidate.license === "PostgreSQL") {
      const legalHtml = await readHtml(candidate.evidenceUrl, url => url === candidate.evidenceUrl, signal);
      const legalDom = new JSDOM(legalHtml, { virtualConsole: new VirtualConsole() });
      try {
        const notice = legalDom.window.document.querySelector("#docContent .legalnotice")?.textContent?.replace(/\s+/g, " ").trim();
        requireCheck(notice === approval.attribution.notices, "document-license-changed");
      } finally { legalDom.window.close(); }
    } else if (candidate.source === "owasp-genai") {
      // This publisher declares the license as plain footer text, without a CC hyperlink.
      requireCheck(/Unless otherwise specified, all content on the site is Creative Commons Attribution-ShareAlike v4\.0/i.test(text) &&
        /provided without\s+warranty of service or accuracy/i.test(text) &&
        links.includes("https://owasp.org/www-policy/operational/general-disclaimer.html"), "document-license-notice-missing");
    } else {
      requireCheck(links.includes(approval.attribution.licenseUrl), "document-license-link-missing");
      requireCheck(candidate.license === "CC-BY-4.0" ?
        /content of this page is licensed under the Creative Commons Attribution 4\.0/i.test(text) :
        /Creative Commons Attribution.ShareAlike (?:4\.0|v4\.0)/i.test(text), "document-license-notice-missing");
    }
  } finally { dom.window.close(); }
  signal.throwIfAborted();
  return { text: snapshot.text, htmlSha256: sha(html), textSha256: approval.textSha256, references: snapshot.references };
}

export type DocumentSummary = {
  version: string; inventory: number; eligible: number; discovered: number; reviewed: number;
  approved: number; deferred: number; skipped: number; stoppedBy: "done" | "time"; reasons: Record<string, number>;
};

/** Inventory discovery plus bounded revalidation; no LLM and no revival of restrictions. */
export async function syncDocumentCandidates(db: SupabaseClient, rights: Map<string, SourceRights>,
  domains: ReadonlyMap<string, { id: number }>, clock: Deadline): Promise<DocumentSummary> {
  const summary: DocumentSummary = { version: DOCUMENT_INGEST_VERSION, inventory: DOCUMENT_CANDIDATES.length,
    eligible: 0, discovered: 0, reviewed: 0, approved: 0, deferred: 0, skipped: 0, stoppedBy: "done", reasons: {} };
  const candidates = DOCUMENT_CANDIDATES.filter(c => !c.hold && DOCUMENT_APPROVALS[c.key] &&
    sourceAllows(rights.get(c.source), "collect") && domains.has(c.domain));
  summary.eligible = candidates.length;
  if (!candidates.length) return summary;
  // Include aliases already stored under these sources, but never overwrite them or duplicate them.
  const { data: existing, error } = await db.from("articles")
    .select("id,source,source_url,status,domain_id,published_at,original_text,rights_status,rights_evidence_url,rights_reviewed_at,rights_expires_at,rights_attribution,rights_review_note")
    .in("source", [...new Set(candidates.map(c => c.source))]);
  if (error) throw new Error(`document queue: ${error.message}`);
  const rows = (existing ?? []) as DocumentRow[];
  const known = new Map<string, DocumentRow>();
  for (const row of rows) {
    try { known.set(`${row.source}:${documentUrlKey(row.source_url)}`, row); } catch { /* malformed legacy URL is not an inventory match */ }
  }
  await mapPool(candidates, 3, async candidate => {
    if (clock.remainingSeconds() < 120) { summary.stoppedBy = "time"; summary.skipped++; return; }
    let currentSources = await getSourceRights(db);
    if (!sourceAllows(currentSources.get(candidate.source), "collect")) { summary.skipped++; return; }
    let row = known.get(`${candidate.source}:${documentUrlKey(candidate.url)}`);
    if (!row) {
      const inserted = await db.from("articles").upsert({ source: candidate.source, source_url: candidate.url,
        title: candidate.title, domain_id: domains.get(candidate.domain)!.id, published_at: null,
        status: "pending", rights_status: "unreviewed" }, { onConflict: "source_url", ignoreDuplicates: true })
        .select("id,source,source_url,status,domain_id,published_at,original_text,rights_status,rights_evidence_url,rights_reviewed_at,rights_expires_at,rights_attribution,rights_review_note");
      if (inserted.error) throw new Error(`document discovery: ${inserted.error.message}`);
      row = inserted.data?.[0] as DocumentRow | undefined;
      if (!row) { summary.skipped++; return; } // another run inserted first
      summary.discovered++;
    }
    if (!["pending", "ready"].includes(row.status) || !["unreviewed", "permitted"].includes(row.rights_status) ||
      !sourceAllows(currentSources.get(candidate.source), "process")) { summary.skipped++; return; }
    const sinceReview = row.rights_reviewed_at ? Date.now() - Date.parse(row.rights_reviewed_at) : Infinity;
    const due = row.rights_status === "permitted" ? RECHECK_DAYS * DAY : RETRY_HOURS * 3600_000;
    if (sinceReview < due && (row.rights_expires_at === null || Date.parse(row.rights_expires_at) > Date.now())) { summary.skipped++; return; }
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    let result: Awaited<ReturnType<typeof reviewDocument>> | undefined, reason = "";
    try { result = await reviewDocument(candidate, signal); }
    catch (cause) { reason = signal.aborted ? "document-timeout" : cause instanceof Error ? cause.message : "document-review-failed"; }
    currentSources = await getSourceRights(db);
    if (!sourceAllows(currentSources.get(candidate.source), "collect") || !sourceAllows(currentSources.get(candidate.source), "process")) { summary.skipped++; return; }
    const now = new Date().toISOString();
    const note = JSON.stringify({ automaticReview: DOCUMENT_INGEST_VERSION, key: candidate.key,
      result: result ? "approved" : "deferred", reason: reason || undefined,
      textSha256: result?.textSha256, htmlSha256: result?.htmlSha256,
      scope: candidate.sections ?? "whole-document-body", references: result?.references,
      acquiredAt: DOCUMENT_APPROVALS[candidate.key].acquiredAt });
    const patch = result ? { rights_status: "permitted", rights_reviewed_at: now,
      rights_expires_at: new Date(Date.now() + PERMISSION_DAYS * DAY).toISOString(),
      rights_evidence_url: candidate.evidenceUrl, rights_attribution: DOCUMENT_APPROVALS[candidate.key].attribution,
      rights_review_note: note, original_text: row.status === "pending" ? result.text : null,
      domain_id: domains.get(candidate.domain)!.id, title: candidate.title } :
      { rights_status: "unreviewed", rights_reviewed_at: now, rights_review_note: note, original_text: null };
    let write = db.from("articles").update(patch).eq("id", row.id).eq("source", row.source!)
      .eq("source_url", row.source_url).eq("status", row.status).eq("rights_status", row.rights_status);
    write = row.rights_reviewed_at === null ? write.is("rights_reviewed_at", null) : write.eq("rights_reviewed_at", row.rights_reviewed_at);
    write = row.rights_expires_at === null ? write.is("rights_expires_at", null) : write.eq("rights_expires_at", row.rights_expires_at);
    const saved = await write.select("id");
    if (saved.error) throw new Error(`document review save: ${saved.error.message}`);
    if (!saved.data?.length) { summary.skipped++; return; }
    summary.reviewed++;
    if (result) summary.approved++;
    else { summary.deferred++; summary.reasons[reason] = (summary.reasons[reason] ?? 0) + 1; }
  });
  return summary;
}

/** Use only the approved scoped snapshot. Never fall back to generic news truncation. */
export function extractStoredDocument(row: Pick<DocumentRow, "source" | "source_url" | "original_text" | "rights_review_note">): ExtractResult {
  const failure: ExtractResult = { ok: false, url: row.source_url, host: null, reason: "document-review-required", retryable: true };
  const candidate = findDocumentCandidate(row.source, row.source_url);
  if (!candidate || candidate.hold || !row.original_text) return failure;
  const approval = DOCUMENT_APPROVALS[candidate.key];
  try {
    const note = JSON.parse(row.rights_review_note);
    if (!approval || note.automaticReview !== DOCUMENT_INGEST_VERSION || note.result !== "approved" ||
      note.key !== candidate.key || note.textSha256 !== approval.textSha256 || sha(row.original_text) !== approval.textSha256) return failure;
  } catch { return failure; }
  return { ok: true, url: candidate.url, host: new URL(candidate.url).hostname, title: candidate.title,
    text: row.original_text, charCount: row.original_text.length, imageUrl: null };
}

export { DOCUMENT_SOURCE_IDS };
