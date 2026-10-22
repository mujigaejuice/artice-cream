/** Validate, stage, then explicitly publish only after the Original UI has been deployed. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ORIGINAL_BRIEFS } from '../content/originals/briefs';
import { QuizQuestionSchema, GlossaryTermSchema } from '../lib/ai/schemas';
import { markTerms } from '../lib/ai/pipeline';
import { createAdminClient } from '../lib/supabase/admin';

const Schema=z.object({key:z.string(),domain:z.string(),order:z.number().int(),title:z.string().min(5),summary:z.string().min(20),
  paragraphs:z.array(z.string().min(30)).min(4),terms:z.array(GlossaryTermSchema).min(3).max(5),
  questions:z.array(QuizQuestionSchema.extend({evidence:z.string().min(8)})).length(4),
  referenceLinks:z.array(z.object({title:z.string().min(1),url:z.url().refine(s=>s.startsWith('https://')),checkedAt:z.iso.datetime()})).min(1),
  model:z.string(),review:z.object({status:z.enum(['automated_checks_passed','editorial_checked']),issues:z.array(z.string()),answers:z.array(z.number().int().min(0).max(3)).length(4),sourceSha256:z.string().regex(/^[a-f0-9]{64}$/)}),
});
async function main(){
  const publish=process.argv.includes('--publish');
  const articles=ORIGINAL_BRIEFS.map(brief=>{
    const path=`content/originals/articles/${brief.key}.json`;assert.ok(existsSync(path),`Missing ${brief.key}`);
    const item=Schema.parse(JSON.parse(readFileSync(path,'utf8')));assert.equal(item.key,brief.key);assert.equal(item.domain,brief.domain);assert.equal(item.order,brief.order);
    assert.equal(item.review.issues.length,0);const body=item.paragraphs.join('\n\n');const chars=body.replace(/\s/g,'').length;
    assert.ok(chars>=500&&chars<=1100,`${brief.key}: length ${chars}`);
    assert.ok(item.questions.every(q=>body.includes(q.evidence)),`${brief.key}: question evidence`);
    assert.deepEqual(item.review.answers,item.questions.map(q=>q.correct_index),`${brief.key}: reviewed answers`);
    assert.ok(item.questions.every(q=>new Set(q.options).size===4),`${brief.key}: distinct options`);
    assert.ok(item.terms.every(t=>body.includes(t.surface)),`${brief.key}: terms`);
    const marked=markTerms(item.paragraphs,item.terms,1,[1]);
    assert.equal(Object.keys(marked.glossary).length,item.terms.length);
    return {...item,...marked,bodySha256:createHash('sha256').update(JSON.stringify({title:item.title,summary:item.summary,paragraphs:item.paragraphs,terms:item.terms,questions:item.questions})).digest('hex')};
  });
  assert.equal(articles.length,64);assert.equal(new Set(articles.map(a=>a.key)).size,64);assert.equal(new Set(articles.map(a=>a.title)).size,64);
  console.log(JSON.stringify({validated:articles.length,questions:articles.length*4,domains:8}));
  if(!process.argv.includes('--stage')&&!publish)return;
  if(publish){
    const response=await fetch('https://artice-cream.vercel.app/originals/',{cache:'no-store',signal:AbortSignal.timeout(30_000)});
    assert.ok(response.ok,'Deploy the Original UI before publication');
    const page=await response.text();
    assert.ok(page.includes('artice cream Original')&&page.includes('첫 결과를 콘에 올린 뒤에도 계속 복습'),'The deployed app must support Original practice');
  }
  const db=createAdminClient(),evidence='https://artice-cream.vercel.app/originals/';
  const must=<T>(r:{data:T;error:any})=>{if(r.error)throw new Error(r.error.message);return r.data;};
  const domains=must(await db.from('domains').select('id,slug').eq('active',true));
  assert.ok(domains);
  const now=new Date().toISOString();
  must(await db.from('content_source_rights').upsert({source:'artice-original',rights_status:'permitted',evidence_url:evidence,reviewed_at:now,
    allow_collect:false,allow_process:false,allow_publish:false,review_note:'Service-authored foundation collection, AI-assisted composition. Explicit article editorial approval and reference review required. No RSS/automatic rewriting. Publication staged separately.'},{onConflict:'source',ignoreDuplicates:true}));
  if(publish){
    const source=must(await db.from('content_source_rights').select('rights_status,allow_collect,allow_process').eq('source','artice-original').single());
    assert.ok(source);assert.equal(source.rights_status,'permitted','Never override withdrawn source rights');
    assert.equal(source.allow_collect,false);assert.equal(source.allow_process,false);
  }
  const report=[];
  for(const item of articles){
    const domain=domains.find(d=>d.slug===item.domain);assert.ok(domain);
    must(await db.from('articles').upsert({source:'artice-original',source_url:null,content_kind:'original',original_key:item.key,
      foundation_order:item.order,domain_id:domain.id,title:item.title,author:'artice cream',status:'ready',editorial_status:'draft',
      rights_status:'restricted',rights_evidence_url:evidence,rights_reviewed_at:now,rights_expires_at:null,rights_attribution:null,
      reference_links:item.referenceLinks,published_at:null,rights_review_note:JSON.stringify({version:'originals-v1',key:item.key,bodySha256:item.bodySha256,
        check:'AI-assisted composition, grounded factual review and question validation; no claim of human expert review',referenceHtmlSha256:item.review.sourceSha256})},
      {onConflict:'original_key',ignoreDuplicates:true}));
    const article=must(await db.from('articles').select('id,source,content_kind,rights_review_note,editorial_status').eq('original_key',item.key).single());
    assert.ok(article);
    if(publish)assert.notEqual(article.editorial_status,'withdrawn','Never republish a withdrawn original');
    assert.equal(article.source,'artice-original');assert.equal(article.content_kind,'original');
    assert.equal(JSON.parse(article.rights_review_note).bodySha256,item.bodySha256,'Existing content differs; never overwrite an article with learning history');
    must(await db.from('article_variants').upsert({article_id:article.id,level:1,title:item.title,summary:item.summary,content_html:item.content_html,
      glossary:item.glossary,reading_minutes:Math.max(1,Math.round(item.paragraphs.join('').replace(/\s/g,'').length/500)),model:item.model},{onConflict:'article_id,level',ignoreDuplicates:true}));
    const variants=must(await db.from('article_variants').select('id,level,content_html').eq('article_id',article.id));assert.ok(variants);assert.equal(variants.length,1);
    const variant=variants[0];assert.equal(variant.level,1);assert.equal(variant.content_html,item.content_html);
    const quiz=item.questions.map(({evidence:_,...q},i)=>({...q,variant_id:variant.id,position:i+1}));
    must(await db.from('quiz_questions').upsert(quiz,{onConflict:'variant_id,position',ignoreDuplicates:true}));
    const stored=must(await db.from('quiz_questions').select('variant_id,position,prompt,options,correct_index,explanation').eq('variant_id',variant.id).order('position'));
    assert.deepEqual(stored,quiz);
    report.push({key:item.key,articleId:article.id,variantId:variant.id,bodySha256:item.bodySha256});
  }
  mkdirSync('spike-out/originals-20261022',{recursive:true});writeFileSync('spike-out/originals-20261022/staged.json',JSON.stringify({stagedAt:now,articles:report},null,2));
  console.log(JSON.stringify({staged:report.length,publication:'still gated by source and article editorial status'}));
  if(publish){
    const ids=report.map(r=>r.articleId);
    // Source publication stays disabled until the complete collection passes validation.
    must(await db.from('articles').update({editorial_status:'approved',rights_status:'permitted',rights_reviewed_at:now,published_at:now})
      .in('id',ids).eq('source','artice-original').eq('editorial_status','draft').eq('rights_status','restricted'));
    const ready=must(await db.from('articles').select('id,editorial_status,rights_status').in('id',ids));
    assert.ok(ready);assert.equal(ready.length,64);
    assert.ok(ready.every(r=>r.editorial_status==='approved'&&r.rights_status==='permitted'),'All 64 originals must be approved before enabling publication');
    must(await db.from('content_source_rights').update({allow_publish:true,reviewed_at:now})
      .eq('source','artice-original').eq('rights_status','permitted'));
    for(const id of ids)assert.equal(must(await db.rpc('content_article_allows',{article_key:id,action_name:'publish'})),true);
    console.log(JSON.stringify({published:64,questions:256}));
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
