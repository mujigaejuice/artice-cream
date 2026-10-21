/** Reproducible offline preparation of cached publisher evidence. No database or LLM calls. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";
import { DOCUMENT_CANDIDATES, DOCUMENT_REVIEW_VERSION, documentUrlKey } from "../lib/news/document-candidates";
import { extractDocumentSnapshot } from "../lib/news/document-extract";

const directory = process.argv[2];
if (!directory) throw new Error("Usage: node --import=tsx scripts/prepare-document-candidates.ts <audit-directory>");
const audit = JSON.parse(readFileSync(join(directory, "index.json"), "utf8"));
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const pgEvidence = audit.evidence.find((row: { url: string }) => row.url === "https://www.postgresql.org/docs/18/legalnotice.html");
if (!pgEvidence?.file) throw new Error("PostgreSQL documentation notice missing");
const licenseDom = new JSDOM(readFileSync(join(directory, pgEvidence.file), "utf8"), { virtualConsole: new VirtualConsole() });
const legal = licenseDom.window.document.querySelector("#docContent .legalnotice");
if (!legal) throw new Error("PostgreSQL documentation notice selector changed");
const postgresNotice = legal.textContent?.replace(/\s+/g, " ").trim() ?? "";
licenseDom.window.close();
if (!/Permission to use, copy, modify, and distribute this software and its documentation/.test(postgresNotice) || !/UNIVERSITY OF CALIFORNIA/i.test(postgresNotice)) throw new Error("PostgreSQL legal notice incomplete");
writeFileSync(join(directory, "postgresql-required-notice.txt"), postgresNotice);
const prepared = DOCUMENT_CANDIDATES.map(candidate => {
  const report = audit.reports.find((row: { key: string }) => row.key === candidate.key);
  if (!report?.htmlSha256) throw new Error(`Missing successful audit: ${candidate.key}`);
  const html = readFileSync(join(directory, `${candidate.key}.html`), "utf8");
  if (hash(html) !== report.htmlSha256) throw new Error(`Snapshot hash mismatch: ${candidate.key}`);
  const snapshot = extractDocumentSnapshot(html, candidate);
  const blockers = candidate.hold ? [candidate.hold] : [];
  if (snapshot.chars < 600 || snapshot.chars > 15_000) blockers.push(`body-length:${snapshot.chars}`);
  if (snapshot.dependencies.figures || snapshot.dependencies.math) blockers.push("visual-or-math-dependency");
  if (snapshot.dependencies.quotes) blockers.push("third-party-quotation-review");
  const evidence = audit.evidence.find((row: { url: string }) => row.url === candidate.evidenceUrl);
  if (!evidence?.sha256 || hash(readFileSync(join(directory, evidence.file), "utf8")) !== evidence.sha256) throw new Error(`License evidence missing/changed: ${candidate.key}`);
  writeFileSync(join(directory, `${candidate.key}.selected.txt`), snapshot.text);
  const attribution = {
    author: candidate.source.startsWith("google-") ? "Google" : candidate.source === "postgresql-docs" ? "PostgreSQL Global Development Group; The Regents of the University of California" : candidate.source === "owasp-cheatsheets" ? "Cheat Sheets Series Team" : candidate.source === "owasp-genai" ? "OWASP GenAI Security Project contributors" : "Aston Zhang, Zachary C. Lipton, Mu Li, Alexander J. Smola",
    originalTitle: candidate.title,
    licenseLabel: candidate.license,
    licenseUrl: candidate.license === "PostgreSQL" ? candidate.evidenceUrl : candidate.license === "CC-BY-4.0" ? "https://creativecommons.org/licenses/by/4.0/" : "https://creativecommons.org/licenses/by-sa/4.0/",
    changes: "Acquisition snapshot only; selected complete sections, HTML navigation removed, examples and table text preserved. No translation, rewrite or quiz created yet. Update this notice when adapting.",
    notices: candidate.license === "PostgreSQL" ? postgresNotice : candidate.source === "owasp-cheatsheets" ? "Copyright - Cheat Sheets Series Team. This work is licensed under Creative Commons Attribution-ShareAlike 4.0 International. Preserve contributors and change notices; adaptations must retain the applicable ShareAlike license." : candidate.source === "owasp-genai" ? "Copyright 2025 OWASP. Unless otherwise specified, site content is Creative Commons Attribution-ShareAlike v4.0 and provided without warranty of service or accuracy. Preserve original notices and ShareAlike on adaptations." : candidate.source.startsWith("google-") ? "Except as otherwise noted, page content is licensed under Creative Commons Attribution 4.0 and code samples under Apache 2.0. Preserve Google attribution and site policy link. Media and code licenses are not approved by this acquisition record." : "Book: CC BY-SA 4.0. Exact chapter/repository revision match and complete notices remain under review.",
  };
  const updated = report.notices?.join(" ").match(/Last updated\s+(\d{4}-\d{2}-\d{2})/);
  return { ...candidate, title: candidate.title, observedTitle: snapshot.title, canonicalKey: documentUrlKey(report.resolvedUrl),
    acquiredAt: report.checkedAt, publishedAt: null, htmlSha256: report.htmlSha256,
    sourceUpdatedAt: updated?.[1] ?? null, documentVersion: candidate.source === "postgresql-docs" ? "18" : candidate.source === "owasp-genai" ? "LLM Top 10 2025" : null,
    attributionDraft: attribution,
    licenseEvidenceSha256: evidence.sha256, textSha256: hash(snapshot.text),
    chars: snapshot.chars, dependencies: snapshot.dependencies, references: snapshot.references, acquisitionStatus: blockers.length ? "held" : "prepared",
    blockers, originalText: blockers.length ? null : snapshot.text,
    // These are acquisition records, not permissions to send content to a model or publish it.
    status: "pending", rightsStatus: "restricted", version: DOCUMENT_REVIEW_VERSION };
});
writeFileSync(join(directory, "prepared.json"), JSON.stringify(prepared, null, 2));
console.log(JSON.stringify(prepared.map(({ key, title, chars, dependencies, acquisitionStatus, blockers }) => ({ key, title, chars, dependencies, acquisitionStatus, blockers })), null, 2));
