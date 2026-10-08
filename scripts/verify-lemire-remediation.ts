/** Read-only backup/verification of the explicitly selected production remediation. */
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createAdminClient } from "../lib/supabase/admin";
import { articleAllows, sourceAllows, type ArticleRights, type SourceRights } from "../lib/content-rights";

async function main() {
  if (!process.argv.includes("--production")) throw new Error("Pass --production for this live read-only check");
  const directory = "spike-out/lemire-review";
  const expected = JSON.parse(readFileSync(`${directory}/expected-remediation.json`, "utf8")) as {
    article: { id: number; source_url: string; author: string; rights_status: string; rights_attribution: unknown; rights_review_note: string };
    variants: { id: number; article_id: number; level: number; title: string; summary: string; content_html: string; glossary: unknown;
      questions: { id: number; variant_id: number; position: number; prompt: string; options: string[]; correct_index: number; explanation: string }[] }[];
  }[];
  assert.deepEqual(expected.map((r) => r.article.id), [749, 751, 754, 1111, 1247, 1500]);
  const admin = createAdminClient();
  const [articleRead, variantRead, questionRead, sourceRead] = await Promise.all([
    admin.from("articles").select("id,source,source_url,status,author,rights_status,rights_evidence_url,rights_reviewed_at,rights_expires_at,rights_attribution,rights_review_note").in("id", expected.map((r) => r.article.id)).order("id"),
    admin.from("article_variants").select("id,article_id,level,title,summary,content_html,glossary").in("article_id", expected.map((r) => r.article.id)).order("id"),
    admin.from("quiz_questions").select("id,variant_id,position,prompt,options,correct_index,explanation").in("variant_id", expected.flatMap((r) => r.variants.map((v) => v.id))).order("id"),
    admin.from("content_source_rights").select("*").eq("source", "lemire").single(),
  ]);
  for (const result of [articleRead, variantRead, questionRead, sourceRead]) assert.equal(result.error, null);
  assert.equal(articleRead.data?.length, 6); assert.equal(variantRead.data?.length, 18); assert.equal(questionRead.data?.length, 72);
  if (process.argv.includes("--backup")) {
    assert.ok(articleRead.data?.every((a) => a.rights_status === "unreviewed"), "Backup must precede remediation");
    const file = `${directory}/db-before-remediation.json`;
    assert.ok(!existsSync(file), "Never overwrite the production backup");
    writeFileSync(file, JSON.stringify({ backedUpAt: new Date().toISOString(), articles: articleRead.data,
      variants: variantRead.data, questions: questionRead.data, source: sourceRead.data }, null, 2));
    console.log("Production backup saved: 6 articles, 18 variants, 72 questions and source rights. No database writes.");
    return;
  }
  const source = sourceRead.data as SourceRights;
  assert.equal(source.rights_status, "restricted");
  for (const action of ["collect", "process", "publish"] as const) {
    assert.equal(source[`allow_${action}`], false); assert.equal(sourceAllows(source, action), false);
  }
  const plan = JSON.parse(readFileSync(`${directory}/remediation-plan.json`, "utf8"));
  assert.equal(sourceRead.data.review_note, plan.sourceNote);
  for (const review of expected) {
    const article: ArticleRights & { id: number; source_url: string; author: string; rights_review_note: string } = articleRead.data!.find((a) => a.id === review.article.id)!;
    for (const field of ["source_url", "author", "rights_status", "rights_attribution", "rights_review_note"] as const) assert.deepEqual(article[field], review.article[field]);
    assert.equal(article.status, "ready"); assert.equal(article.rights_evidence_url, "https://lemire.me/blog/terms-of-use/");
    assert.ok(article.rights_reviewed_at);
    assert.ok(Number.isFinite(Date.parse(article.rights_reviewed_at)));
    assert.equal(articleAllows(article as ArticleRights, new Map([[source.source, source]]), "publish"), false);
    for (const variant of review.variants) {
      const { questions, ...fields } = variant;
      const stored: typeof fields = variantRead.data!.find((v) => v.id === variant.id)!;
      for (const field of ["id", "article_id", "level", "title", "summary", "content_html", "glossary"] as const) assert.deepEqual(stored[field], fields[field], `${variant.id}.${field}`);
      for (const question of questions) assert.deepEqual(questionRead.data!.find((q) => q.id === question.id), question, `question ${question.id}`);
    }
  }
  const result = { checkedAt: new Date().toISOString(), articles: 6, variants: 18, questions: 72,
    changedVariants: plan.changedVariants, changedQuestions: plan.changedQuestions, attributionVerified: true,
    sourceActionsDisabled: true, publicationApproved: false, remaining: "Express CC BY 3.0 reinstatement/permission; guest-author scope; final release QA" };
  writeFileSync(`${directory}/verified-remediation.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main().catch((cause: unknown) => { console.error(cause instanceof Error ? cause.message : "Verification failed"); process.exitCode = 1; });
