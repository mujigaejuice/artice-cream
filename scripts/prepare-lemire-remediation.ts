/** Prepare a guarded, non-publishing SQL transaction from the read-only review. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import type { Attribution } from "../lib/content-rights";

type Question = { id: number; variant_id: number; position: number; prompt: string; options: string[]; correct_index: number; explanation: string };
type Variant = { id: number; article_id: number; level: number; title: string; summary: string; content_html: string; glossary: Record<string, unknown>; questions: Question[] };
type Review = { checkedAt: string; article: { id: number; source_url: string; rights_status: string; rights_attribution: Attribution | null; rights_review_note: string; author: string | null }; publisher: { title: string; author: string; authorUrl: string; notices: unknown[] }; variants: Variant[] };
const ids = [749, 751, 754, 1111, 1247, 1500];
const directory = "spike-out/lemire-review";
const reviews: Review[] = ids.map((id) => JSON.parse(readFileSync(`${directory}/${id}.json`, "utf8")));
const original = structuredClone(reviews);
const edits: { table: string; id: number; reason: string }[] = [];
const variants = reviews.flatMap((r) => r.variants);
const questions = variants.flatMap((v) => v.questions);
function replace(id: number, field: "content_html" | "summary", before: string, after: string, reason: string) {
  const variant = variants.find((v) => v.id === id);
  assert.ok(variant, `variant ${id}`);
  assert.equal(variant[field].split(before).length, 2, `exactly one match: variant ${id}`);
  variant[field] = variant[field].replace(before, after);
  edits.push({ table: "article_variants", id, reason });
}
function question(id: number, patch: Partial<Question>, reason: string) {
  const item = questions.find((q) => q.id === id);
  assert.ok(item, `question ${id}`);
  Object.assign(item, patch);
  edits.push({ table: "quiz_questions", id, reason });
}

replace(49, "content_html", "이모지 입력은 이미 올바른 형태이므로 속도가 느려지지만, 여전히 기존 방식보다 훨씬 빠릅니다.", "이모지 입력은 올바른 서로게이트 쌍으로 이루어져 있습니다. 기존 검색 방식은 초당 0.4GB로 느려졌지만, SimdUnicode는 초당 53GB의 검증 속도를 유지했습니다.", "Separate the baseline slowdown from the SIMD result.");
replace(136, "content_html", "정수는 0에서 1억까지이며 각 문자열은 최대 8자리 숫자를 가집니다.", "Python은 0부터 1천만 미만까지, 다른 언어는 0부터 1억 미만까지의 정수를 처리했습니다. 문자열은 최대 8자리 숫자를 가집니다.", "Restore the Python-specific iteration count.");
replace(172, "content_html", "이동하지 않는 분기가 두 개 가까이 발생하지만", "이동하는 분기가 두 개 가까이 발생하지만", "The publisher says two taken branches, not two not-taken branches.");
replace(172, "content_html", "AMD 제온 4(Zen 4)", "AMD Zen 4", "Correct the processor name.");
replace(172, "content_html", "AMD 제온 5(Zen 5)", "AMD Zen 5", "Correct the processor name.");
replace(174, "content_html", "이 경우 분기는 발생하지 않지만(Not-taken), 컴파일러의 최적화 방식에 따라 근접한 위치에 두 개의 분기 명령어가 생성될 수 있다.", "이 경우 저장 연산은 실행되지 않지만, Go 컴파일러가 생성한 기계어에서는 서로 가까운 위치의 두 분기가 실제로 실행된다(Taken).", "Correct the source-level condition versus machine-code branch distinction.");
replace(73, "summary", "이 기술은 웹 브라우저의 V8 엔진에 적용되어 텍스트 처리 속도를 크게 높였습니다.", "simdutf는 V8 엔진에 사용되는 라이브러리이며, 이 새 기능의 브라우저 배포 여부는 원문에서 확인되지 않습니다.", "Do not claim the new branch-only function has shipped in browsers.");
replace(96, "content_html", "측정하는 데이트.", "측정한 내용을 다룬다.", "Correct the malformed sentence.");
replace(94, "content_html", "gzip보다 16배 빠릅니다.", "zstd는 gzip의 최고 속도(2.5GB/s)보다 16배, lz4는 약 13.6배 빠릅니다.", "The 16x ratio applies to zstd, not both formats.");
replace(95, "content_html", "이는 gzip의 최고 속도보다 16배 빠른 것이다.", "zstd의 속도는 gzip의 최고 속도(2.5GB/s)보다 16배, lz4의 속도는 약 13.6배 빠른 것이다.", "Distinguish the two speed ratios.");
replace(96, "content_html", "이는 gzip으로 달성할 수 있는 최고 속도(2.5GB/s)보다 16배 빠른 수치이다.", "zstd의 속도는 gzip으로 달성할 수 있는 최고 속도(2.5GB/s)보다 16배, lz4의 속도는 약 13.6배 빠른 수치이다.", "Distinguish the two speed ratios.");
replace(94, "summary", "속도가 16배 빨라집니다.", "이 합성 데이터 실험에서 zstd는 gzip 대비 16배의 속도를 기록했습니다.", "Limit the ratio to the measured format and synthetic benchmark.");

question(195, { explanation: "Xeon 실험에서 Latin 입력은 기존 검색 방식의 33GB/s에 비해 SimdUnicode가 69GB/s로 약 두 배 빨랐습니다. 이모지 입력에서는 기존 방식이 0.4GB/s로 느려졌지만 SimdUnicode는 53GB/s를 유지했습니다." }, "Remove the contradiction about emoji performance.");
question(196, { prompt: "본문에 따르면, 출력 버퍼에 쓰는 문자열 수정 함수의 동작으로 옳은 것은?", explanation: "출력 버퍼에 쓰는 수정 함수는 입력이 올바르면 각 코드 단위를 그대로 복사하므로 메모리 복사와 비슷한 작업을 수행합니다. 올바른 문자열 객체를 할당 없이 반환하는 동작과는 구별됩니다." }, "Identify the buffer overload rather than conflating it with string return.");
question(204, { prompt: "본문에 따르면, 문자열 객체를 반환하는 수정 함수와 출력 버퍼에 쓰는 수정 함수를 올바르게 구별한 것은?", options: ["문자열 객체를 반환하는 수정 함수는 입력이 올바르면 할당 없이 원본을 반환하고, 출력 버퍼에 쓰는 수정 함수는 올바른 입력을 복사한다.", "두 수정 함수는 올바른 입력에도 반드시 U+FFFD를 추가한다.", "검증 함수는 고립된 서로게이트를 발견해도 반드시 끝까지 검사해야 한다.", "출력 버퍼에 쓰는 수정 함수는 올바른 입력을 복사할 수 없다."], correct_index: 0, explanation: "원문은 올바른 문자열 객체를 그대로 반환하는 ToWellFormed와, 모든 코드 단위를 출력 버퍼에 쓰는 형태를 구별합니다. 후자는 올바른 입력에서 메모리 복사와 유사하며, 검증 함수는 첫 오류에서 반환할 수 있습니다." }, "Remove the validation-versus-repair conflation.");
question(552, { options: ["테스트는 Apple M4 Max 기기에서 5번 실행한 중 가장 좋은 수치를 보고한다.", "Rust는 릴리스 모드로 컴파일되었다.", "생성된 문자열은 1024개의 슬롯을 가진 링 버퍼에 저장된다.", "Python도 다른 언어와 같이 1억 개의 정수를 측정했다."], correct_index: 3, explanation: "Python은 1천만 개, 나머지 언어는 1억 개의 정수를 측정했습니다. 링 버퍼는 원문에 제시된 여러 언어의 코드에 공통으로 사용되므로 Python만의 조건이 아닙니다." }, "The original four choices were all true; introduce a single false choice.");
question(687, { options: ["저장(store) 작업이 빈번하게 발생한다.", "이동하는 분기가 두 개 가까이 발생하지만 저장 작업은 일어나지 않는다.", "모든 프로세서가 한 사이클에 반드시 하나의 이동하는 분기만 처리한다.", "Go 컴파일러가 분기 명령어를 전부 제거한다."], explanation: "값이 기준값보다 작거나 같아 저장 연산은 실행되지 않지만, Go 컴파일러가 생성한 기계어에서는 두 개의 이동하는 분기(taken branch)가 가까이 발생합니다." }, "Align the correct choice with two taken branches in the publisher text.");
question(688, { options: ["애플 M4 Max와 Granite Rapids는 두 개의 분기를 평균 2사이클 미만으로 처리했다.", "AMD Zen 4는 테스트 상황에서 가장 어려움을 겪었다.", "모든 현대 프로세서는 어떤 조건에서도 한 사이클에 하나 이상의 이동하는 분기를 처리한다.", "AMD Zen 5는 AMD Zen 4보다 더 나은 성능을 보였다."], correct_index: 2, explanation: "실험은 특정 프로세서가 특정 조건에서 주기당 하나를 넘는 taken branch를 처리할 수 있음을 보여 줍니다. 모든 프로세서와 모든 조건에 일반화하는 세 번째 보기는 부적절합니다." }, "Replace the all-true choices and remove unedited model drafting text.");
question(695, { explanation: "값이 임계값보다 작거나 같으면 저장은 실행되지 않지만, Go 컴파일러가 생성한 기계어에서는 가까운 위치의 두 taken branch가 실행됩니다. 저장 연산 없이 밀집된 분기를 처리하는 능력을 비교할 수 있습니다." }, "Correct the not-taken statement in the explanation.");
question(300, { options: ["초기 검증을 통해 오류가 없는 부분의 변환 속도를 높일 수 있기 때문", "변환 전에 오류 위치를 기록하여 오류 사이의 유효한 구간을 구별할 수 있기 때문", "일본어 위키백과 파일을 벤치마크 데이터로 선택했기 때문", "오프셋 정보를 바탕으로 유효한 UTF-8 구간을 빠르게 변환할 수 있기 때문"], explanation: "사전 검증과 오류 오프셋 기록은 변환을 빠르게 하는 알고리즘의 요소입니다. 일본어 위키백과 파일을 선택한 것은 측정 조건이므로 속도 향상 원리가 아닙니다." }, "Make the benchmark-only choice the sole unrelated answer.");
question(379, { options: ["zstd가 40GB/s로 가장 빠르며, gzip의 최고 속도(2.5GB/s)보다 16배 빠르다.", "lz4가 34GB/s로 zstd보다 빠르다.", "gzip이 64스레드에서 40GB/s로 zstd와 같은 속도를 기록했다.", "zstd 파일은 gzip보다 6% 작았다."], explanation: "이 합성 데이터 실험에서 zstd는 40GB/s, lz4는 34GB/s였고 gzip의 최고 속도는 2.5GB/s였습니다. 16배라는 비율은 zstd와 gzip의 비교입니다." }, "Remove the potentially second correct gzip choice.");
question(383, { options: ["gzip은 2.5GB/s로 zstd와 lz4보다 16배 빠르다.", "zstd는 40GB/s, lz4는 34GB/s이며, gzip 최고 속도(2.5GB/s) 대비 각각 16배와 약 13.6배다.", "단일 스레드에서 zstd와 lz4는 0.5GB/s를 기록했다.", "zstd 파일은 gzip보다 6% 작았다."], explanation: "측정값은 zstd 40GB/s, lz4 34GB/s, gzip 최고 2.5GB/s입니다. 따라서 비율은 각각 40/2.5=16, 34/2.5=13.6입니다." }, "Do not attribute the 16x ratio to lz4.");

// This script never turns on source actions or marks an article permitted.
const evidence = "https://lemire.me/blog/terms-of-use/";
const sourceNote = "2026-10-08 review: CC BY 3.0 text candidate, comments excluded. Prior public attribution/license omissions found; express reinstatement/permission is not recorded (CC FAQ: no automatic reinstatement before 4.0). Article 754 by Antonio Badia also requires guest-author scope confirmation. No collection, processing or publication approval.";
const sqlString = (value: string): string => { assert.ok(!value.includes("\0") && !value.includes("$$"), "Unsafe SQL block delimiter"); return `'${value.replaceAll("'", "''")}'`; };
const sqlJson = (value: unknown) => `${sqlString(JSON.stringify(value))}::jsonb`;
const statements = ["begin;", "set local standard_conforming_strings = on;", "set local lock_timeout = '5s';", "set local statement_timeout = '30s';", "lock table public.content_source_rights, public.articles, public.article_variants, public.quiz_questions in share row exclusive mode;", `do $$ begin if not exists (select 1 from public.content_source_rights where source='lemire' and rights_status='restricted' and not allow_collect and not allow_process and not allow_publish) then raise exception 'Lemire source state changed; re-review required'; end if; end $$;`];
for (let i = 0; i < reviews.length; i++) {
  const review = reviews[i], before = original[i];
  assert.equal(review.article.id, ids[i]);
  assert.deepEqual(review.variants.map((v) => v.level), [1, 2, 3]);
  const attribution: Attribution = { author: review.publisher.author, originalTitle: review.publisher.title,
    licenseLabel: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    changes: "ARTICECREAM에서 한국어로 번역·요약하고 난이도별로 재작성했으며, 용어 설명과 학습용 퀴즈를 추가했습니다. 원문 이미지·코드·댓글은 제공하지 않습니다.",
    notices: review.article.id === 1111 ? "원문 구현 기여 표시: 이 루틴의 가장 복잡한 부분은 Benjamin Bucher가 작성했습니다." : "" };
  assert.equal(review.publisher.author, review.article.id === 754 ? "Antonio Badia" : "Daniel Lemire");
  const note = `Preliminary source/attribution and existing-content QA reviewed 2026-10-08. Public access remains restricted: missing express CC BY 3.0 reinstatement/permission after prior attribution/license omissions.${review.article.id === 754 ? " Publisher post byline, author metadata and citation identify Antonio Badia; confirm guest-author permission and credit to blog publisher before any release." : ""}${review.article.id === 1500 ? " Source opinions about permits, continuous sunlight and latency must be distinguished from confirmed mission facts before release." : ""} No new external model processing. Existing quiz corrections do not regrade historic user results.`;
  statements.push(`do $$ begin if not exists (select 1 from public.articles where id=${review.article.id} and source='lemire' and status='ready' and source_url=${sqlString(review.article.source_url)} and rights_status=${sqlString(before.article.rights_status)} and rights_attribution is not distinct from ${before.article.rights_attribution === null ? "null::jsonb" : sqlJson(before.article.rights_attribution)} and rights_review_note=${sqlString(before.article.rights_review_note)} and author is not distinct from ${before.article.author === null ? "null::text" : sqlString(before.article.author)}) then raise exception 'Article ${review.article.id} changed; re-review required'; end if; end $$;`);
  statements.push(`update public.articles set author=${sqlString(attribution.author)}, rights_status='restricted', rights_evidence_url=${sqlString(evidence)}, rights_reviewed_at=now(), rights_attribution=${sqlJson(attribution)}, rights_review_note=${sqlString(note)} where id=${review.article.id};`);
  Object.assign(review.article, { author: attribution.author, rights_status: "restricted", rights_attribution: attribution, rights_review_note: note });
  for (const variant of review.variants) {
    assert.equal(variant.questions.length, 4);
    const doc = new JSDOM(variant.content_html).window.document;
    assert.equal(doc.querySelectorAll("img,svg,picture,video,audio,iframe,script,pre,code").length, 0, `text-only variant ${variant.id}`);
    for (const mark of doc.querySelectorAll("mark[data-w]")) assert.ok(variant.glossary[mark.getAttribute("data-w")!], `glossary reference ${variant.id}`);
    for (const q of variant.questions) {
      assert.equal(q.options.length, 4); assert.equal(new Set(q.options).size, 4);
      assert.ok(Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < 4);
      assert.ok(!/Wait, let|let.?s re-read|New Option|Ah, I need/i.test(q.explanation), `unedited drafting text ${q.id}`);
    }
    const oldVariant = before.variants.find((v) => v.id === variant.id)!;
    const assignments: string[] = [];
    for (const field of ["content_html", "summary"] as const) if (variant[field] !== oldVariant[field]) assignments.push(`${field}=${sqlString(variant[field])}`);
    if (assignments.length) {
      statements.push(`do $$ begin if not exists (select 1 from public.article_variants where id=${variant.id} and article_id=${review.article.id} and content_html=${sqlString(oldVariant.content_html)} and summary=${sqlString(oldVariant.summary)}) then raise exception 'Variant ${variant.id} changed'; end if; end $$;`);
      statements.push(`update public.article_variants set ${assignments.join(", ")} where id=${variant.id};`);
    }
    for (const q of variant.questions) {
      const oldQuestion = oldVariant.questions.find((item) => item.id === q.id)!;
      if (JSON.stringify(q) === JSON.stringify(oldQuestion)) continue;
      statements.push(`do $$ begin if not exists (select 1 from public.quiz_questions where id=${q.id} and variant_id=${q.variant_id} and prompt=${sqlString(oldQuestion.prompt)} and options=${sqlJson(oldQuestion.options)} and correct_index=${oldQuestion.correct_index} and explanation=${sqlString(oldQuestion.explanation)}) then raise exception 'Question ${q.id} changed'; end if; end $$;`);
      statements.push(`update public.quiz_questions set prompt=${sqlString(q.prompt)}, options=${sqlJson(q.options)}, correct_index=${q.correct_index}, explanation=${sqlString(q.explanation)} where id=${q.id};`);
    }
  }
}
statements.push(`update public.content_source_rights set review_note=${sqlString(sourceNote)}, reviewed_at=now() where source='lemire';`, "commit;");
mkdirSync(directory, { recursive: true });
const backup = `${directory}/before-remediation.json`;
if (!existsSync(backup)) writeFileSync(backup, JSON.stringify(original, null, 2));
else assert.equal(readFileSync(backup, "utf8"), JSON.stringify(original, null, 2), "Do not overwrite a different review backup");
const sql = statements.join("\n");
writeFileSync(`${directory}/remediation.sql`, sql);
writeFileSync(`${directory}/expected-remediation.json`, JSON.stringify(reviews, null, 2));
const report = { generatedAt: new Date().toISOString(), articles: ids.length, variants: variants.length, questions: questions.length,
  changedVariants: new Set(edits.filter((e) => e.table === "article_variants").map((e) => e.id)).size,
  changedQuestions: new Set(edits.filter((e) => e.table === "quiz_questions").map((e) => e.id)).size,
  sqlSha256: createHash("sha256").update(sql).digest("hex"), publicationApproved: false, sourceNote, edits };
writeFileSync(`${directory}/remediation-plan.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
