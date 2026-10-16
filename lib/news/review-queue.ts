import type { SupabaseClient } from "@supabase/supabase-js";
import { getSourceRights, sourceAllows, type ArticleRights, type SourceRights } from "../content-rights";
import { AUTO_REVIEW_SOURCES, AUTO_REVIEW_VERSION, createAutoReviewer, type AutoReviewResult, type ReviewArticle } from "./auto-review";
import { mapPool, type Deadline } from "./ingest";

const REVIEW_LIMIT = 32;
const REVIEW_CONCURRENCY = 4;
const REVIEW_TIMEOUT_MS = 20_000;
const RETRY_HOURS = 12;
const CLASSIFY_RESERVE_SECONDS = 90;

type Candidate = ReviewArticle & ArticleRights & { id: number };
export type ReviewSummary = {
  candidates: number; reviewed: number; approved: number; deferred: number; skipped: number;
  stoppedBy: "done" | "time"; reasons: Record<string, number>;
};

/** Automatically drains new and existing unreviewed articles, with bounded work and retry rotation. */
export async function reviewPendingArticles(db: SupabaseClient, rights: Map<string, SourceRights>, clock: Deadline): Promise<ReviewSummary> {
  const summary: ReviewSummary = { candidates: 0, reviewed: 0, approved: 0, deferred: 0, skipped: 0, stoppedBy: "done", reasons: {} };
  const sources = AUTO_REVIEW_SOURCES.filter(source => sourceAllows(rights.get(source), "process"));
  if (!sources.length) return summary;
  const retryBefore = new Date(Date.now() - RETRY_HOURS * 3600_000).toISOString();
  const { data, error, count } = await db.from("articles")
    .select("id,source,source_url,title,status,rights_status,rights_reviewed_at,rights_expires_at", { count: "exact" })
    .eq("status", "pending").eq("rights_status", "unreviewed").in("source", sources)
    .or(`rights_reviewed_at.is.null,rights_reviewed_at.lt.${retryBefore}`)
    .order("rights_reviewed_at", { ascending: true, nullsFirst: true })
    .order("fetched_at", { ascending: false }).order("id", { ascending: false }).limit(REVIEW_LIMIT);
  if (error) throw new Error(`auto-review queue: ${error.message}`);
  summary.candidates = count ?? data?.length ?? 0;
  const review = createAutoReviewer();
  await mapPool((data ?? []) as Candidate[], REVIEW_CONCURRENCY, async article => {
    if (clock.remainingSeconds() < CLASSIFY_RESERVE_SECONDS + REVIEW_TIMEOUT_MS / 1000) {
      summary.stoppedBy = "time";
      summary.skipped++;
      return;
    }
    // Never revive an explicit restriction. Expired candidates rotate with the deferred queue.
    if (article.status !== "pending" || article.rights_status !== "unreviewed") {
      summary.skipped++;
      return;
    }
    const signal = AbortSignal.timeout(REVIEW_TIMEOUT_MS);
    // Recheck at start and before writing: a disabled source must stop new work.
    if (!sourceAllows((await getSourceRights(db)).get(article.source ?? ""), "process")) {
      summary.skipped++; return;
    }
    const result: AutoReviewResult = article.rights_expires_at !== null && !(Date.parse(article.rights_expires_at) > Date.now())
      ? { approved: false, reason: "article-expired" } : await review(article, signal);
    const latestSource = (await getSourceRights(db)).get(article.source ?? "");
    if (!sourceAllows(latestSource, "process")) { summary.skipped++; return; }
    const checkedAt = new Date().toISOString();
    const patch = result.approved ? {
      title: result.title, author: result.author, rights_status: "permitted",
      rights_evidence_url: result.evidenceUrl, rights_reviewed_at: checkedAt,
      rights_review_note: JSON.stringify({ automaticReview: AUTO_REVIEW_VERSION, result: "approved", htmlSha256: result.htmlSha256 }),
      rights_attribution: result.attribution,
    } : {
      rights_reviewed_at: checkedAt,
      rights_review_note: JSON.stringify({ automaticReview: AUTO_REVIEW_VERSION, result: "deferred", reason: result.reason }),
    };
    // Compare-and-set avoids overwriting withdrawal, edits, or another review while fetching a page.
    let write = db.from("articles").update(patch).eq("id", article.id).eq("source", article.source!)
      .eq("source_url", article.source_url).eq("status", "pending").eq("rights_status", "unreviewed");
    write = article.rights_reviewed_at === null ? write.is("rights_reviewed_at", null) : write.eq("rights_reviewed_at", article.rights_reviewed_at);
    write = article.rights_expires_at === null ? write.is("rights_expires_at", null) : write.eq("rights_expires_at", article.rights_expires_at);
    const saved = await write.select("id");
    if (saved.error) throw new Error(`auto-review save: ${saved.error.message}`);
    if (!saved.data?.length) { summary.skipped++; return; }
    summary.reviewed++;
    if (result.approved) summary.approved++;
    else {
      summary.deferred++;
      summary.reasons[result.reason] = (summary.reasons[result.reason] ?? 0) + 1;
    }
  });
  return summary;
}
