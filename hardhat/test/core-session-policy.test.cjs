'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),E=require('ethers');
const T=require('../scripts/transaction-envelope.cjs'),A=require('../scripts/actor-policy.cjs'),P=require('../scripts/core-creation-plan.cjs'),R=require('../scripts/deployment-rpc.cjs');
const F=require('./helpers/core-session-fixture.cjs');
const wallet=new E.Wallet('0x'+'01'.repeat(32));
const envelope=()=>({type:2,chainId:1,from:wallet.address,nonce:0,to:null,value:'0',data:'0x60006000',gasLimit:'100000',maxFeePerGas:'100',maxPriorityFeePerGas:'1',accessList:[]});
test('exact disposable signed type2 CREATE serializes, recovers and hashes without a signer in production modules',async()=>{
 const e=envelope(),raw=await wallet.signTransaction(e),checked=T.decodeSigned(raw,e);assert.equal(checked.from,wallet.address);assert.equal(checked.hash,E.keccak256(raw));assert.equal(T.unsignedTransaction(e).unsignedSerialized,E.Transaction.from(raw).unsignedSerialized);
});
for(const [key,value] of Object.entries({chainId:2,nonce:1,from:'0x2222222222222222222222222222222222222222',to:'0x2222222222222222222222222222222222222222',value:'1',data:'0x60016000',gasLimit:'100001',maxFeePerGas:'101',maxPriorityFeePerGas:'2',accessList:[{address:'0x2222222222222222222222222222222222222222',storageKeys:[]}]}))test(`signed envelope rejects changed ${key}`,async()=>{const e=envelope(),raw=await wallet.signTransaction(e);assert.throws(()=>T.decodeSigned(raw,{...e,[key]:value}));});
test('wrong signer, wrong type, unsigned, malformed, noncanonical and high-s payloads reject',async()=>{
 const e=envelope();assert.throws(()=>T.decodeSigned(T.unsignedTransaction(e).unsignedSerialized,e));assert.throws(()=>T.decodeSigned('0x00',e));
 const other=new E.Wallet('0x'+'02'.repeat(32)),raw=await other.signTransaction({...e,from:other.address});assert.throws(()=>T.decodeSigned(raw,e));
 const valid=await wallet.signTransaction(e),parts=E.decodeRlp('0x'+valid.slice(4));parts[parts.length-1]=E.toBeHex(BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141')-BigInt(parts.at(-1)),32);assert.throws(()=>T.decodeSigned('0x02'+E.encodeRlp(parts).slice(2),e));
 assert.throws(()=>T.validateEnvelope({...e,type:4,authorizationList:[]}));assert.throws(()=>T.validateEnvelope({...e,gasLimit:'16777217'}));assert.throws(()=>T.validateEnvelope({...e,gasLimit:'0100000'}));
});
test('delegated qualification reports bind exact creator, target, code and separately reviewed scopes',()=>{
 const target='0x2222222222222222222222222222222222222222',targetCodeHash=E.keccak256('0x00'),kinds=['consensusEvidenceSha256','forkEvidenceSha256','delegateReviewSha256'];
 const policy={mode:A.DELEGATED,delegationCode:'0xef0100'+target.slice(2),target,targetCodeHash,stateChecks:[{to:target,data:'0x12345678',resultHash:E.keccak256('0x')}],qualification:Object.fromEntries(kinds.map(k=>[k,'a'.repeat(64)]))};
 const context={source:F.source,buildId:'synthetic-only',buildDigest:'b'.repeat(64),catalogSha256:'c'.repeat(64),block:{number:100,hash:'0x'+'12'.repeat(32)},executionHardfork:'osaka'};
 const scope=A.qualificationScope(policy,wallet.address,context),reports=Object.fromEntries(kinds.map((k,i)=>[k,{disposition:'pass',reviewReference:'synthetic-only-test',scope,testType:i}]));
 policy.qualification=Object.fromEntries(Object.entries(reports).map(([k,v])=>[k,T.digest(v)]));
 const evidence={schema:'manager-delegated-qualification-evidence-v2',scope,reports};assert.doesNotThrow(()=>A.validateEvidence(policy,wallet.address,evidence,context));
 const changed=structuredClone(evidence);changed.reports.delegateReviewSha256.disposition='pending';assert.throws(()=>A.validateEvidence(policy,wallet.address,changed,context));assert.throws(()=>A.validateEvidence(policy,wallet.address,null,context));assert.throws(()=>A.validatePolicy({...policy,delegationCode:'0xef0100'+wallet.address.slice(2).toLowerCase()},wallet.address));
});
test('real build plan binds exact catalog, independent source, nine nonces, constructor governor and budget',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'core-policy-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const build=F.actualCatalog(dir),c=F.config(wallet.address),plan=P.makePlan(c,build,F.source);
 assert.equal(plan.operations.length,9);assert.equal(plan.operations[8].constructorArguments.at(-1),P.GOVERNOR);assert.equal(plan.catalogSha256,build.catalogSha256);assert.equal(plan.readyToBroadcast,false);
 for(let i=0;i<9;i++)assert.equal(plan.operations[i].predictedAddress,E.getCreateAddress({from:wallet.address,nonce:i}));assert.equal(P.checkPlan(plan,build,F.source),plan);
 for(const mutate of [x=>x.operations[8].constructorArguments[6]=wallet.address,x=>x.operations[0].envelope.value='1',x=>x.source.commit='f'.repeat(40),x=>x.catalogSha256='f'.repeat(64)]){const bad=structuredClone(plan);mutate(bad);assert.throws(()=>P.checkPlan(bad,build,F.source));}
 assert.throws(()=>P.checkPlan(plan,build));assert.throws(()=>P.makePlan({...c,maximumTotalFeeWei:'1'},build,F.source));assert.throws(()=>P.makePlan({...c,governor:wallet.address},build,F.source));
 assert.doesNotThrow(()=>P.makePlan({...c,creator:P.GOVERNOR},build,F.source));
});
const response=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}});
test('read adapter rejects signing/overrides/unscoped reads and permits canonical reference',async()=>{
 let count=0;const rpc=R.createReadRpc('https://example.invalid',{scope:[wallet.address]},async(url,req)=>{count++;const q=JSON.parse(req.body);return response({jsonrpc:'2.0',id:q.id,result:'0x'});});
 for(const method of ['eth_sendTransaction','eth_sendRawTransaction','eth_sign','personal_sign','wallet_sendCalls'])await assert.rejects(rpc(method,[]));
 await assert.rejects(rpc('eth_getCode',['0x2222222222222222222222222222222222222222','latest']));
 await assert.rejects(rpc('eth_call',[{to:wallet.address,from:E.ZeroAddress,data:'0x'},'latest',{}]));assert.equal(count,0);
 assert.equal(await rpc('eth_getCode',[wallet.address,{blockHash:'0x'+'12'.repeat(32),requireCanonical:true}]),'0x');assert.equal(count,1);
});
test('read adapter bounds request count, response size, errors, redirect and endpoint credentials',async()=>{
 assert.throws(()=>R.createReadRpc('https://user:password@example.invalid',{scope:[wallet.address]}));assert.throws(()=>R.createReadRpc('http://localhost',{scope:[wallet.address]}));
 let rpc=R.createReadRpc('https://example.invalid',{scope:[wallet.address],limits:{requests:1}},async(url,req)=>response({jsonrpc:'2.0',id:JSON.parse(req.body).id,result:'0x1'}));await rpc('eth_chainId',[]);await assert.rejects(rpc('eth_chainId',[]));
 rpc=R.createReadRpc('https://example.invalid',{scope:[wallet.address],limits:{responseBytes:10}},async()=>response({jsonrpc:'2.0',id:1,result:'0x1'}));await assert.rejects(rpc('eth_chainId',[]));
 rpc=R.createReadRpc('https://example.invalid',{scope:[wallet.address]},async()=>new Response('',{status:302}));await assert.rejects(rpc('eth_chainId',[]));
 rpc=R.createReadRpc('https://example.invalid',{scope:[wallet.address]},async()=>response({jsonrpc:'2.0',id:1,error:{message:'secret endpoint'}}));await assert.rejects(rpc('eth_chainId',[]),e=>!e.message.includes('secret'));
});
