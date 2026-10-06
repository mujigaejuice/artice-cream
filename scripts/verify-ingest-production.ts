/** Explicit production smoke test: runs the cloud processor once and checks persisted output. */
import { mkdirSync, writeFileSync } from "node:fs";
import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  if (!process.argv.includes("--run-cloud")) throw new Error("Pass --run-cloud to process and save production articles once");
  if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET is required");
  const admin = createAdminClient();
  const { data: domain, error: domainError } = await admin.from("domains")
    .select("id").eq("slug", "cloud").single();
  if (domainError) throw domainError;
  const { data: candidates, error: candidateError } = await admin.from("articles")
    .select("id").eq("domain_id", domain.id).eq("status", "pending")
    .order("published_at", { ascending: false, nullsFirst: false }).order("id").limit(40);
  if (candidateError) throw candidateError;
  if (!candidates.length) throw new Error("Cloud queue is empty");

  const startedAt = new Date().toISOString();
  const response = await fetch("https://artice-cream.vercel.app/api/cron/ingest/cloud", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    signal: AbortSignal.timeout(330_000),
  });
  if (!response.ok) throw new Error(`Production processor returned HTTP ${response.status}; not retrying automatically`);
  const summary = await response.json();
  // Save the response before further checks so a DB/network failure cannot hide the result.
  mkdirSync("spike-out", { recursive: true });
  const reportPath = "spike-out/ingest-production.json";
  writeFileSync(reportPath, JSON.stringify({ startedAt, summary }, null, 2));

  const { data: ready, error: readyError } = await admin.from("articles").select("id,source")
    .in("id", candidates.map((row) => row.id)).eq("status", "ready");
  if (readyError) throw readyError;
  const { data: variants, error: variantError } = ready.length
    ? await admin.from("article_variants").select("id,article_id,level,model")
      .in("article_id", ready.map((row) => row.id))
    : { data: [], error: null };
  if (variantError) throw variantError;
  const { data: quizzes, error: quizError } = variants.length
    ? await admin.from("quiz_questions").select("id,variant_id")
      .in("variant_id", variants.map((row) => row.id))
    : { data: [], error: null };
  if (quizError) throw quizError;
  const articles = ready.map((row) => ({ ...row,
    variants: variants.filter((variant) => variant.article_id === row.id).map((variant) => ({
      level: variant.level, model: variant.model,
      quizCount: quizzes.filter((quiz) => quiz.variant_id === variant.id).length,
    })),
  }));
  const sourceCount = new Set(ready.filter((row) => row.source).map((row) => row.source)).size;
  const checks = {
    settings: summary.articleCap === 4 && summary.articleConcurrency === 2 && summary.llmConcurrency === 6,
    processedFour: summary.processed === 4,
    readyFour: ready.length === 4,
    distinctSources: sourceCount === ready.filter((row) => row.source).length,
    completeContent: articles.every((article) =>
      article.variants.map((v) => v.level).sort().join(",") === "1,2,3" &&
      article.variants.every((v) => v.quizCount === 4 && v.model === summary.model)),
  };
  const result = { startedAt, checkedAt: new Date().toISOString(), summary, articles, checks };
  writeFileSync(reportPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (Object.values(checks).some((passed) => !passed)) process.exitCode = 1;
}

main().catch((cause: unknown) => { console.error(cause); process.exitCode = 1; });
