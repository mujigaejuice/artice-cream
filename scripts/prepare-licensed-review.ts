/** Prepare guarded SQL for the two manually reviewed current Kubernetes/Go articles. No DB writes. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createAdminClient } from "../lib/supabase/admin";
import type { Attribution } from "../lib/content-rights";

const targets = [
  { source: "kubernetes", slug: "scaling-kubernetes-workloads-with-node-swap", author: "Ocean Xie, Yuan Wang",
    evidence: "https://github.com/kubernetes/website/blob/main/LICENSE", notices: "원문 저작권: © 2026 The Kubernetes Authors; © 2026 Kubernetes, a Series of LF Projects, LLC. 본문 CC BY 4.0. 프로젝트 정책: https://lfprojects.org/policies/" },
  { source: "go-blog", slug: "archsimd", author: "Junyang Shao and David Chase",
    evidence: "https://go.dev/copyright", notices: "원문 제공: The Go Authors / Google. 본문은 CC BY 4.0이며 코드의 BSD 라이선스와 구분됩니다. Google 사이트 정책: https://developers.google.com/terms/site-policies" },
];
const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sqlJson = (value: unknown) => `${sqlString(JSON.stringify(value))}::jsonb`;
async function main() {
  const admin = createAdminClient();
  const statements = ["begin;"];
  const backup: unknown[] = [];
  const planned: unknown[] = [];
  for (const target of targets) {
    const review = JSON.parse(readFileSync(`spike-out/licensed-review/${target.source}-${target.slug}.json`, "utf8"));
    assert.equal(review.source, target.source);
    assert.equal(review.quoted.length, 0);
    assert.equal(review.notices.length, 0);
    assert.equal(review.extracted.ok, true);
    assert.ok(review.extracted.charCount <= 12000);
    assert.ok(review.parsedByline.includes(target.author));
    assert.ok(review.parsedTitle.includes(review.feedTitle));
    const { data: article, error } = await admin.from("articles").select("id,source,source_url,title,author,status,rights_status,rights_evidence_url,rights_reviewed_at,rights_expires_at,rights_attribution,rights_review_note")
      .eq("source_url", review.url).single();
    if (error) throw new Error(error.message);
    assert.equal(article.source, target.source);
    assert.equal(article.status, "pending");
    assert.equal(article.rights_status, "unreviewed");
    const attribution: Attribution = { author: target.author, originalTitle: review.feedTitle,
      licenseLabel: "원문 CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      changes: "ARTICECREAM 가공본은 한국어 번역·요약과 난이도별 재작성, 용어 풀이·학습용 퀴즈로 구성됩니다. 원문 이미지·코드·댓글은 제공하지 않습니다.", notices: target.notices };
    const note = `Reviewed current publisher article, authors, CC BY 4.0 scope, no blockquote/other license notices, and prose-only extraction on 2026-10-08. Media and code excluded. Publisher HTML SHA256 ${review.htmlSha256}. Text rights approved; actual processing/publication remain governed by separate source flags. Pickle key-purpose/body-recording confirmation pending.`;
    statements.push(`do $$ begin if not exists (select 1 from public.articles where id=${article.id} and source=${sqlString(target.source)} and source_url=${sqlString(review.url)} and status='pending' and rights_status='unreviewed' and author is not distinct from ${article.author === null ? "null::text" : sqlString(article.author)} and rights_attribution is not distinct from ${article.rights_attribution === null ? "null::jsonb" : sqlJson(article.rights_attribution)} and rights_review_note=${sqlString(article.rights_review_note)}) then raise exception 'Article ${article.id} changed; re-review required'; end if; end $$;`);
    statements.push(`update public.articles set author=${sqlString(target.author)}, rights_status='permitted', rights_evidence_url=${sqlString(target.evidence)}, rights_reviewed_at=now(), rights_attribution=${sqlJson(attribution)}, rights_review_note=${sqlString(note)} where id=${article.id};`);
    backup.push(article);
    planned.push({ id: article.id, source: target.source, url: review.url, attribution, note });
  }
  statements.push("commit;");
  writeFileSync("spike-out/licensed-review/before-approval.json", JSON.stringify(backup, null, 2));
  writeFileSync("spike-out/licensed-review/planned-approval.json", JSON.stringify(planned, null, 2));
  writeFileSync("spike-out/licensed-review/approve.sql", statements.join("\n\n") + "\n");
  console.log(JSON.stringify({ preparedArticles: planned.length, sql: "spike-out/licensed-review/approve.sql", backedUp: true, published: false }));
}
main().catch((cause: unknown) => { console.error(cause instanceof Error ? cause.message : "Preparation failed"); process.exitCode = 1; });
