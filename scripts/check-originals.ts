/** Exercise real handlers with an isolated PostgREST transport; no account/data writes. */
import assert from 'node:assert/strict';
import { articleAllows } from '../lib/content-rights';

async function main(){
  Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://originals.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture-admin'});
  const uid='11111111-1111-4111-8111-111111111111', past='2026-01-01T00:00:00Z';
  const source={source:'artice-original',rights_status:'permitted' as const,evidence_url:'https://app.invalid/originals',reviewed_at:past,expires_at:null,allow_collect:false,allow_process:false,allow_publish:true};
  const article={id:1,domain_id:1,source:source.source,source_url:null,content_kind:'original' as const,original_key:'cloud-01',foundation_order:1,
    editorial_status:'approved' as 'approved'|'withdrawn'|'draft',reference_links:[{title:'Reference',url:'https://reference.invalid',checkedAt:past}],
    status:'ready',rights_status:'permitted' as const,rights_evidence_url:source.evidence_url,rights_reviewed_at:past,rights_expires_at:null,rights_attribution:null,
    domains:{slug:'cloud',name_ko:'클라우드'}};
  assert.equal(articleAllows(article,new Map([[source.source,source]]),'publish'),true);
  assert.equal(articleAllows(article,new Map([[source.source,source]]),'process'),false);
  for(const editorial_status of ['draft','withdrawn'] as const)assert.equal(articleAllows({...article,editorial_status},new Map([[source.source,source]]),'publish'),false);
  assert.equal(articleAllows({...article,reference_links:[]},new Map([[source.source,source]]),'publish'),false);
  const variant={id:2,article_id:1,level:1,title:'Original',summary:'Summary',reading_minutes:2,content_html:'<p>Body</p>',glossary:{},articles:article};
  const questions=Array.from({length:4},(_,i)=>({id:i+10,variant_id:2,position:i+1,prompt:`문제${i}`,options:['가','나','다','라'],correct_index:i,explanation:'근거'}));
  let progress:any={id:3,user_id:uid,article_id:1,variant_id:2,status:'started',quiz_score:null,quiz_answers:null,completed_at:null,saved_at:null};
  const originalFetch=globalThis.fetch;let writes=0,casRace=false,auth=true;
  globalThis.fetch=async(input,init)=>{
    const url=new URL(input instanceof Request?input.url:String(input));assert.equal(url.origin,'https://originals.invalid');
    if(url.pathname==='/auth/v1/user')return Response.json(auth?{id:uid,is_anonymous:false}:{message:'no'}, {status:auth?200:401});
    const table=url.pathname.split('/').pop(),method=init?.method??'GET';
    if(table==='content_source_rights')return Response.json([source]);
    if(table==='articles')return Response.json(article);
    if(table==='article_variants')return Response.json(url.searchParams.has('level')?[variant]:variant);
    if(table==='quiz_questions')return Response.json(questions);
    assert.equal(table,'user_article_progress','Original quizzes must never read/write proficiency, quota or rewards');
    assert.equal(url.searchParams.get('user_id'),`eq.${uid}`,'verified user ownership');
    if(method==='GET')return Response.json(url.searchParams.has('article_id')||url.searchParams.has('id')?progress:progress?[progress]:[]);
    assert.equal(method,'PATCH');writes++;
    if(casRace){progress={...progress,status:'saved',quiz_score:0.25,completed_at:past,saved_at:past};return Response.json([]);}
    if(url.searchParams.get('status')==='eq.started'&&progress.status!=='started')return Response.json([]);
    Object.assign(progress,JSON.parse(String(init?.body)));return Response.json([{id:3}]);
  };
  try{
    const {GET}=await import('../app/api/quiz/route.api');
    const {POST}=await import('../app/api/quiz/grade/route.api');
    const {createAdminClient}=await import('../lib/supabase/admin');
    const {getOriginalPicks}=await import('../lib/feed');
    const request=(path:string,body?:unknown)=>new Request('https://app.invalid'+path,{headers:{authorization:'Bearer fixture','content-type':'application/json'},...(body!==undefined?{method:'POST',body:JSON.stringify(body)}:{})});
    const answers=Object.fromEntries(questions.map(q=>[q.id,q.correct_index]));
    let response=await GET(request('/api/quiz?v=2'));let data=await response.json();
    assert.equal(data.mode,'quiz');assert.equal(data.isOriginal,true);assert.doesNotMatch(JSON.stringify(data),/correct_index|explanation/);
    response=await POST(request('/api/quiz/grade',{variantId:2,answers}));data=await response.json();
    assert.equal(data.score,1);assert.equal(data.isReview,false);assert.equal(data.canSave,true);assert.equal(data.newLevel,null);assert.equal(progress.status,'completed');
    const first=JSON.stringify(progress),firstWrites=writes;
    for(let i=0;i<3;i++){
      data=await (await GET(request('/api/quiz?v=2&practice=1'))).json();assert.equal(data.mode,'quiz');assert.equal(data.isPractice,true);
      data=await (await POST(request('/api/quiz/grade',{variantId:2,answers:{10:3,11:3,12:3,13:0}}))).json();
      assert.equal(data.isReview,true);assert.equal(data.canSave,true);assert.equal(data.score,0);assert.equal(JSON.stringify(progress),first);
    }
    assert.equal(writes,firstWrites);
    progress.status='saved';progress.saved_at=past;const saved=JSON.stringify(progress);
    data=await(await GET(request('/api/quiz?v=2'))).json();assert.equal(data.mode,'result');assert.equal(data.result.canSave,false);
    data=await(await GET(request('/api/quiz?v=2&practice=1'))).json();assert.equal(data.mode,'quiz');assert.doesNotMatch(JSON.stringify(data),/correct_index|explanation/);
    data=await(await POST(request('/api/quiz/grade',{variantId:2,answers}))).json();assert.equal(data.canSave,false);assert.equal(JSON.stringify(progress),saved);assert.equal(writes,firstWrites);
    const picks=await getOriginalPicks(createAdminClient(),uid,[{id:1,slug:'cloud',name_ko:'클라우드',name_en:null,rss_topic:null,active:true}]);
    assert.equal(picks.length,1);assert.equal(picks[0].level,1);assert.equal(picks[0].progressStatus,'saved');
    for(const invalid of [null,[],{}, {...answers,10:4},{...answers,10:-1}])assert.equal((await POST(request('/api/quiz/grade',{variantId:2,answers:invalid}))).status,400);
    progress={...progress,status:'started'};casRace=true;
    data=await(await POST(request('/api/quiz/grade',{variantId:2,answers}))).json();assert.equal(data.isReview,true);assert.equal(data.canSave,false);assert.equal(progress.quiz_score,0.25);assert.equal(progress.status,'saved');
    casRace=false;progress=null;
    assert.equal((await GET(request('/api/quiz?v=2&practice=1'))).status,403);
    assert.equal((await POST(request('/api/quiz/grade',{variantId:2,answers}))).status,403);
    article.editorial_status='withdrawn';
    assert.equal((await GET(request('/api/quiz?v=2&practice=1'))).status,404);
    assert.equal((await POST(request('/api/quiz/grade',{variantId:2,answers}))).status,404);
    auth=false;assert.equal((await GET(request('/api/quiz?v=2'))).status,401);
    console.log('Originals: level-independent catalog, first completion, unlimited practice, saved-score preservation, CAS race, ownership, answer secrecy, withdrawal and invalid inputs passed.');
  }finally{globalThis.fetch=originalFetch;}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
