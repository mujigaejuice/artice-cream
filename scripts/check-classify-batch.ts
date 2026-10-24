import assert from "node:assert/strict";

async function main() {
  Object.assign(process.env,{BASE_URL:"https://classify.invalid",API_KEY:"fixture",MODEL_ID:"fixture"});
  const originalFetch=globalThis.fetch;
  let calls=0;
  let mode:"truncated"|"missing"|"duplicate"|"outside"|"always-invalid"="truncated";
  const items=Array.from({length:20},(_,i)=>({i,category:"infra"}));
  globalThis.fetch=async (input,init)=>{
    assert.equal(new URL(String(input)).origin,"https://classify.invalid");
    const body=JSON.parse(String(init?.body));
    assert.ok(body.max_tokens>=3200,"20 candidates need output headroom beyond the old 800-token limit");
    calls++;
    let result=items;
    if(calls===1||mode==="always-invalid") {
      if(mode==="truncated") return Response.json({choices:[{message:{content:'{"items":['},finish_reason:"length"}],usage:{prompt_tokens:10,completion_tokens:800}});
      result=mode==="duplicate"?[...items.slice(0,19),items[0]]:
        mode==="outside"?[...items.slice(0,19),{i:20,category:"infra"}]:items.slice(0,19);
    }
    return Response.json({choices:[{message:{content:JSON.stringify({items:result})},finish_reason:"stop"}],usage:{prompt_tokens:10,completion_tokens:400}});
  };
  try {
    const {classifyCandidates,newMeter}=await import("../lib/ai/pipeline");
    const input=items.map(({i})=>({source:"fixture",title:`Article ${i}`,summary:""}));
    for(const nextMode of ["truncated","missing","duplicate","outside"] as const) {
      mode=nextMode;calls=0;
      const result=await classifyCandidates(input,newMeter());
      assert.equal(result.length,20);assert.equal(calls,2,`${mode} responses must be repaired before saving`);
    }
    mode="always-invalid";calls=0;
    await assert.rejects(classifyCandidates(input,newMeter()),/exactly once/);
    assert.equal(calls,2,"invalid batches must stop after one repair");
    calls=0;assert.deepEqual(await classifyCandidates([]),[]);assert.equal(calls,0);
    console.log("Classification batch: output headroom, truncated JSON, omitted/duplicate/out-of-range indices and bounded repair passed.");
  } finally {globalThis.fetch=originalFetch;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
