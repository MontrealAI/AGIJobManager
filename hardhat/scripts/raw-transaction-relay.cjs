'use strict';
// Only this separately armed entrypoint can submit. It has no signer, retry or fee-bump path.
const T=require('./transaction-envelope.cjs'),S=require('./deployment-session.cjs');
async function relayOperation(context,{endpoint,acknowledgement,fetchImpl=globalThis.fetch}){
 let url;try{url=new URL(endpoint);}catch{throw Error('Explicit relay endpoint required.');}
 T.need(url.protocol==='https:'&&!url.username&&!url.password&&!url.hash,'Relay requires HTTPS without embedded credentials or fragments.');let invoked=false;
 return S.submit(context,{acknowledgement,transmit:async raw=>{
  T.need(!invoked,'Raw relay is once-only.');invoked=true;
  const body=JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_sendRawTransaction',params:[raw]});T.need(Buffer.byteLength(body)<=256*1024,'Signed payload too large.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json','accept-encoding':'identity'},body,redirect:'error',signal:controller.signal});
   T.need(response.status===200&&(!response.headers.get('content-encoding')||response.headers.get('content-encoding')==='identity'),'Relay HTTP failure.');
   const length=response.headers.get('content-length');T.need(length===null||(/^\d+$/.test(length)&&Number(length)<=65536),'Relay response oversized.');
   T.need(response.body?.getReader,'Bounded relay response stream required.');const reader=response.body.getReader(),chunks=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;T.need(size<=65536&&!controller.signal.aborted,'Relay response exceeded limit.');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
   const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));T.exact(result,['jsonrpc','id','result']);T.need(result.jsonrpc==='2.0'&&result.id===1,'Relay response malformed.');T.hash(result.result);return result.result;
  }catch{throw Error('Raw submission outcome is ambiguous or rejected. Its hash was saved before the attempt; recover read-only and never resend.');}finally{clearTimeout(timer);}
 }});
}
module.exports={relayOperation};
