/** Read-only publisher verification; never calls a model or writes to the database. */
import { DOCUMENT_CANDIDATES } from "../lib/news/document-candidates";
import { DOCUMENT_APPROVALS } from "../lib/news/document-approvals";
import { reviewDocument } from "../lib/news/document-ingest";
import { mapPool } from "../lib/news/ingest";

async function main() {
  if (!process.argv.includes("--live")) throw new Error("Pass --live to verify the nine reviewed publisher documents");
  const results = await mapPool(DOCUMENT_CANDIDATES.filter(c => !c.hold && DOCUMENT_APPROVALS[c.key]), 3, async candidate => {
    try {
      const result = await reviewDocument(candidate, AbortSignal.timeout(20_000));
      return { key: candidate.key, ok: true, chars: result.text.length, textSha256: result.textSha256 };
    } catch (cause) { return { key: candidate.key, ok: false, reason: cause instanceof Error ? cause.message : "failed" }; }
  });
  console.log(JSON.stringify(results, null, 2));
  if (results.some(r => !r.ok)) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
