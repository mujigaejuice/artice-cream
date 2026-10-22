import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';

async function main(){
  const dom=new JSDOM('<div id="root"></div>',{url:'https://originals-ui.invalid/'});
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,self:dom.window,
    HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,BroadcastChannel:undefined}))Object.defineProperty(globalThis,key,{configurable:true,value});
  Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://originals-auth.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture',NEXT_PUBLIC_API_BASE:''});
  dom.window.localStorage.setItem('artice-auth',JSON.stringify({access_token:'fixture',refresh_token:'refresh',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'fixture-user',is_anonymous:false}}));
  const {createRoot}=await import('react-dom/client');
  const {AppRouterContext}=await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const {Reader}=await import('../components/Reader');
  const {Quiz}=await import('../components/Quiz');
  const {FoundationCatalog}=await import('../components/FoundationCatalog');
  const {createClient}=await import('../lib/supabase/client');
  const root=createRoot(dom.window.document.getElementById('root')!);
  const container=dom.window.document.getElementById('root')!;
  const router={back(){},forward(){},refresh(){},hmrRefresh(){},push(){},replace(){},prefetch(){},bfcacheId:'fixture'};
  const render=async(node:React.ReactNode)=>{await act(async()=>{root.render(createElement(AppRouterContext.Provider,{value:router},node));});};
  const click=async(label:string)=>{const button=[...container.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(button,label);await act(async()=>button.click());};
  const originalFetch=globalThis.fetch;let gradeCalls=0;
  const questions=Array.from({length:4},(_,i)=>({id:i+1,position:i+1,prompt:`문제 ${i+1}`,options:['가','나','다','라']}));
  globalThis.fetch=async(input,init)=>{
    assert.equal(String(input),'/api/quiz/grade');gradeCalls++;
    assert.deepEqual(JSON.parse(String(init?.body)).answers,{'1':0,'2':0,'3':0,'4':0});
    return Response.json({score:1,correct:4,total:4,review:[],prevLevel:null,newLevel:null,dir:'유지',rollingAccuracy:null,domain:'cloud',domainLabel:'클라우드',articleId:1,variantId:2,isOriginal:true,isReview:true,canSave:false,sourceUrl:null});
  };
  try{
    await render(createElement(Reader,{variantId:2,articleId:1,level:1,title:'오리지널',contentHtml:'<p>본문</p>',glossary:{},readingMinutes:2,
      domainSlug:'cloud',domainLabel:'클라우드',sourceName:'artice cream Original',sourceUrl:null,isOriginal:true,
      referenceLinks:[{title:'공식 자료',url:'https://reference.invalid',checkedAt:'2026-10-22'}],progressStatus:'saved',quizScore:0.5}));
    assert.doesNotMatch(container.textContent!,/원문 (읽기|보기)/);assert.match(container.textContent!,/사실 확인에 참고한 자료/);
    assert.ok(container.querySelector('a[href="/read/quiz?v=2&practice=1"]'));
    await render(createElement(Quiz,{variantId:2,articleTitle:'오리지널',questions,isOriginal:true,isPractice:true}));
    for(let round=0;round<2;round++){
      assert.match(container.textContent!,/문제 1/);
      assert.equal(container.querySelectorAll('[aria-pressed="true"]').length,0,'retry clears answers');
      for(let i=0;i<4;i++){await click('가');await click(i===3?'제출하기':'다음');}
      assert.match(container.textContent!,/100점/);assert.doesNotMatch(container.textContent!,/원문 보기|콘에 올리기/);
      await click('퀴즈 다시 풀기');
    }
    assert.equal(gradeCalls,2);
    const domain={id:1,slug:'cloud',name_ko:'클라우드',name_en:null,rss_topic:null,active:true};
    await render(createElement(FoundationCatalog,{domains:[domain],selectedDomainIds:[1],unlocked:false,picks:[{variantId:2,articleId:1,domain,level:1,title:'쌓은 기초',summary:'설명',readingMinutes:2,sourceName:'artice cream Original',imageUrl:null,publishedAt:null,isOriginal:true,foundationOrder:1,progressStatus:'saved',completedNotSaved:false}]}));
    assert.ok(container.querySelector('a[href="/read?v=2"]'),'saved original is available even with exhausted daily quota');
    assert.match(container.textContent!,/1편 중 1편 쌓았어요/);
    console.log('Original UI: no source button, references, saved retry link, repeated quiz reset and exhausted-quota reopening passed.');
  }finally{globalThis.fetch=originalFetch;await act(async()=>root.unmount());createClient().auth.stopAutoRefresh();dom.window.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
