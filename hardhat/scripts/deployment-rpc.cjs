'use strict';
// Bounded read-only mainnet transport. No signing/submission method can pass this allowlist.
const E=require('ethers'),T=require('./transaction-envelope.cjs');
const LIMITS={timeoutMs:20000,responseBytes:2*1024*1024,requestBytes:256*1024,requests:2000,totalBytes:100*1024*1024,deadlineMs:300000};
function limits(input={}){const out={...LIMITS};for(const [k,v] of Object.entries(input)){T.need(Object.hasOwn(out,k)&&Number.isSafeInteger(v)&&v>0&&v<=out[k],'RPC limits may only decrease.');out[k]=v;}return out;}
const quantity=x=>typeof x==='string'&&/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(x)&&x.length<=66;
const block=x=>['latest','pending','finalized'].includes(x)||quantity(x)||(x&&typeof x==='object'&&Object.keys(x).length===2&&x.requireCanonical===true&&/^0x[0-9a-f]{64}$/.test(x.blockHash));
function scopeFor(plan){return [...new Set([...plan.operations.map(x=>x.predictedAddress),plan.creator,plan.governor,plan.config.constructorArgs.usdcTokenAddress,...plan.config.constructorArgs.ensConfig,...(plan.config.creatorPolicy.stateChecks||[]).map(x=>x.to),...(plan.config.creatorPolicy.target?[plan.config.creatorPolicy.target]:[])].filter(x=>x!==E.ZeroAddress).map(x=>x.toLowerCase()))];}
function validate(method,p,scope){
 T.need(Array.isArray(p),'RPC parameters must be an array.');let ok=false;
 const addr=x=>typeof x==='string'&&E.isAddress(x)&&scope.includes(x.toLowerCase());
 switch(method){
 case 'eth_chainId':ok=p.length===0;break;
 case 'eth_getCode':case 'eth_getTransactionCount':ok=p.length===2&&addr(p[0])&&block(p[1]);break;
 case 'eth_getBlockByNumber':ok=p.length===2&&(['latest','finalized'].includes(p[0])||quantity(p[0]))&&typeof p[1]==='boolean';break;
 case 'eth_getTransactionByHash':case 'eth_getTransactionReceipt':ok=p.length===1&&/^0x[0-9a-f]{64}$/.test(p[0]);break;
 case 'eth_call':T.exact(p[0],['to','data','from']);ok=p.length===2&&addr(p[0].to)&&p[0].from===E.ZeroAddress&&/^0x(?:[0-9a-f]{2})*$/.test(p[0].data)&&block(p[1]);break;
 case 'eth_estimateGas':{
  T.exact(p[0],['type','from','to','value','data','gas','maxFeePerGas','maxPriorityFeePerGas','nonce','accessList']);const x=p[0];
  ok=p.length===2&&block(p[1])&&x.type==='0x2'&&addr(x.from)&&x.to===null&&x.value==='0x0'&&/^0x(?:[0-9a-f]{2})+$/.test(x.data)&&['gas','maxFeePerGas','maxPriorityFeePerGas','nonce'].every(k=>quantity(x[k]))&&BigInt(x.gas)<=T.MAX_GAS&&Array.isArray(x.accessList)&&x.accessList.length===0;break;
 }
 default:throw Error('RPC method is not read-only allowlisted.');
 }
 T.need(ok,'RPC parameter shape, overrides or address scope rejected.');
}
function endpoint(url){let u;try{u=new URL(url);}catch{throw Error('Invalid RPC endpoint.');}T.need(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash,'RPC endpoint must be HTTPS without embedded credentials or fragments.');return u;}
async function boundedRequest(url,method,params,state,fetchImpl=globalThis.fetch){
 const l=state.limits;T.need(!state.stopped&&Date.now()-state.started<l.deadlineMs&&state.requests<l.requests,'RPC budget or deadline exhausted.');
 const id=++state.requests,body=JSON.stringify({jsonrpc:'2.0',id,method,params}),size=Buffer.byteLength(body);T.need(size<=l.requestBytes&&state.bytes+size<=l.totalBytes,'RPC request/total byte budget exceeded.');state.bytes+=size;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(l.timeoutMs,l.deadlineMs-(Date.now()-state.started)));
 try{
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json','accept-encoding':'identity'},body,redirect:'error',signal:controller.signal});
  T.need(response.status===200&&(!response.headers.get('content-encoding')||response.headers.get('content-encoding')==='identity'),'RPC HTTP status/encoding rejected.');
  const length=response.headers.get('content-length');T.need(length===null||(/^\d+$/.test(length)&&Number(length)<=l.responseBytes&&Number(length)+state.bytes<=l.totalBytes),'RPC content length exceeds budget.');
  T.need(response.body&&typeof response.body.getReader==='function','Bounded response stream required.');const reader=response.body.getReader(),chunks=[];let got=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;got+=value.byteLength;state.bytes+=value.byteLength;T.need(got<=l.responseBytes&&state.bytes<=l.totalBytes&&!controller.signal.aborted&&Date.now()-state.started<l.deadlineMs,'RPC response budget/deadline exceeded.');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
  const x=JSON.parse(Buffer.concat(chunks).toString('utf8'));T.exact(x,['jsonrpc','id','result']);T.need(x.jsonrpc==='2.0'&&x.id===id,'Malformed RPC response identity.');return x.result;
 }catch{state.stopped=true;throw Error('RPC request failed, timed out, redirected, exceeded bounds or returned malformed data. No successful observation established.');}finally{clearTimeout(timer);}
}
function createReadRpc(url,{scope,limits:overrides={}}={},fetchImpl){
 const u=endpoint(url);T.need(Array.isArray(scope)&&scope.length>0&&scope.length<=128&&scope.every(x=>E.isAddress(x)),'Explicit bounded read address scope required.');scope=[...new Set(scope.map(x=>x.toLowerCase()))];
 const state={limits:limits(overrides),started:Date.now(),requests:0,bytes:0,stopped:false};let busy=false;
 const rpc=async(method,p)=>{T.need(!busy,'Concurrent RPC calls are not supported.');validate(method,p,scope);busy=true;try{return await boundedRequest(u,method,p,state,fetchImpl);}finally{busy=false;}};
 rpc.stats=()=>({requests:state.requests,bytes:state.bytes,stopped:state.stopped});return rpc;
}
module.exports={LIMITS,limits,scopeFor,validate,createReadRpc};
