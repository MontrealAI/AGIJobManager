import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as E from 'ethers';
import solc from 'solc';
import runtime from '../scripts/runtime.cjs';
import P from '../scripts/core-creation-plan.cjs';
import T from '../scripts/transaction-envelope.cjs';
import A from '../scripts/actor-policy.cjs';
import S from '../scripts/deployment-session.cjs';
import F from './helpers/core-session-fixture.cjs';

const {ethers}=await runtime.getRuntime(),local=ethers.provider;
// Only this disposable EDR test adapts canonical object tags and finalized reads.
// Production continues to require genuine canonical tags and finalized consensus.
async function rpc(method,params){
 if(method==='eth_getBlockByNumber'&&params[0]==='finalized')params=['latest',params[1]];
 const at=params.at(-1);
 if(at?.requireCanonical===true){const b=await local.send('eth_getBlockByHash',[at.blockHash,false]);assert(b);assert.equal((await local.send('eth_getBlockByNumber',[b.number,false])).hash,at.blockHash);const result=await local.send(method,[...params.slice(0,-1),b.number]);assert.equal((await local.send('eth_getBlockByNumber',[b.number,false])).hash,at.blockHash);return result;}
 return local.send(method,params);
}
function callsFromTrace(trace){
 assert.deepEqual(Object.keys(trace).sort(),['failed','gas','returnValue','structLogs']);assert.equal(trace.failed,false);
 assert(Number.isSafeInteger(trace.gas)&&trace.gas>0);assert.equal(typeof trace.returnValue,'string');
 assert(Buffer.byteLength(T.canonical(trace))<=32*1024*1024,'Trace byte bound exceeded');
 assert(Array.isArray(trace.structLogs)&&trace.structLogs.length>0&&trace.structLogs.length<=100000,'Complete bounded trace required');
 assert.equal(trace.structLogs[0].depth,1);const last=trace.structLogs.at(-1);assert.equal(last.depth,1);assert(['RETURN','STOP'].includes(last.op),'Top-level trace termination missing');
 for(let i=0;i<trace.structLogs.length;i++){
  const x=trace.structLogs[i];assert(Number.isSafeInteger(x.pc)&&x.pc>=0&&Number.isSafeInteger(x.depth)&&x.depth>=1&&x.depth<=1024);assert(Number.isSafeInteger(x.gas)&&x.gas>=0&&Number.isSafeInteger(x.gasCost)&&x.gasCost>=0);
  assert(Array.isArray(x.stack)&&x.stack.length<=1024&&x.stack.every(v=>/^(?:0x)?[0-9a-f]{1,64}$/.test(v)),'Complete bounded stack required');
  assert(!['CREATE','CREATE2','SELFDESTRUCT'].includes(x.op),'Nested creation/destruction is unsupported in this narrow trace proof');
  if(i){const previous=trace.structLogs[i-1];assert(x.depth<=previous.depth+1,'Trace frame transition missing');if(x.depth===previous.depth+1)assert(['CALL','CALLCODE','DELEGATECALL','STATICCALL'].includes(previous.op),'Unexplained trace frame entry');}
 }
 return trace.structLogs.filter(x=>['CALL','CALLCODE','DELEGATECALL','STATICCALL'].includes(x.op)).map(x=>{assert(Array.isArray(x.stack)&&x.stack.length>=2);return {op:x.op,depth:x.depth,pc:x.pc,target:E.getAddress('0x'+x.stack.at(-2).replace(/^0x/,'').slice(-40).padStart(40,'0'))};});
}
async function observeCallees(transactionHash,calls){
 const receipt=await local.send('eth_getTransactionReceipt',[transactionHash]);assert(receipt&&receipt.status==='0x1');
 const canonical=async()=>assert.equal((await local.send('eth_getBlockByNumber',[receipt.blockNumber,false])).hash,receipt.blockHash);await canonical();
 const codeObservations=[];for(const address of [...new Set(calls.map(x=>x.target.toLowerCase()))].sort()){
  const code=await local.send('eth_getCode',[address,receipt.blockNumber]);assert(/^0x(?:[0-9a-f]{2})*$/.test(code));
  codeObservations.push({address:E.getAddress(address),code,codeHash:E.keccak256(code),resolvedMarkerTarget:/^0xef0100[0-9a-f]{40}$/.test(code)?E.getAddress('0x'+code.slice(8)):null});
 }
 await canonical();return {block:{number:receipt.blockNumber,hash:receipt.blockHash},codeObservations};
}
function noOriginExecution(calls,creator,target,observations){for(const call of calls){
 assert(![creator.toLowerCase(),target.toLowerCase()].includes(call.target.toLowerCase()),`Forbidden origin/marker-target execution: ${call.op} ${call.target}`);
 const observation=observations?.codeObservations.find(x=>x.address===call.target);assert(observation&&observation.codeHash===E.keccak256(observation.code),'Missing or mismatched callee runtime observation');
 // Narrow proof: reject all marker-bearing callees rather than silently following
 // an indirect code target. Real-state qualification must retain these exact reads.
 assert(!/^0xef0100[0-9a-f]{40}$/.test(observation.code)&&observation.resolvedMarkerTarget===null,'Marker-bearing callee can hide indirect code execution');
}}
const suite=(await local.getNetwork()).chainId===1n?describe:describe.skip;
suite('Marker account direct origination: actual disposable Osaka traces',function(){
 this.timeout(180000);
 it('executes nine exact signed CREATEs without invoking creator or its marker target',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'manager-direct-trace-'));
  try{
   const evidenceDirectory=process.env.MANAGER_DIRECT_TRACE_OUTPUT?path.resolve(process.env.MANAGER_DIRECT_TRACE_OUTPUT):null;
   if(evidenceDirectory)fs.mkdirSync(evidenceDirectory);
   const wallet=E.Wallet.createRandom(),target='0x5555555555555555555555555555555555555555',registry='0x2222222222222222222222222222222222222222';
   // Test-only initial state; no type-4 transaction, authorization, real key or provider.
   // INVALID would fail if executed; trace checks also reject swallowed failed calls.
   const targetCode='0xfe',marker='0xef0100'+target.slice(2).toLowerCase();
   await local.send('hardhat_setCode',[target,targetCode]);await local.send('hardhat_setCode',[wallet.address,marker]);await local.send('hardhat_setBalance',[wallet.address,E.toQuantity(E.parseEther('10'))]);await local.send('hardhat_setCode',[registry,'0x00']);
   const compiled=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'Token.sol':{content:'pragma solidity ^0.8.20; contract Token { function decimals() external pure returns(uint8){return 6;} function paused() external pure returns(bool){return false;} function isBlacklisted(address) external pure returns(bool){return false;} }'}},settings:{evmVersion:'shanghai',outputSelection:{'*':{'*':['evm.deployedBytecode.object']}}}})));
   const usdc=F.config(wallet.address).constructorArgs.usdcTokenAddress;await local.send('hardhat_setCode',[usdc,'0x'+compiled.contracts['Token.sol'].Token.evm.deployedBytecode.object]);await local.send('hardhat_mine',['0x1']);
   const qualified=F.actualCatalog(dir),block=await A.pin(rpc),config=F.config(wallet.address,{registry,nonce:await local.getTransactionCount(wallet.address),block:{number:block.number,hash:block.hash}});
   // First derive identical initcode under an empty-policy offline fixture. No chain
   // preflight accepts that policy for the marker account. All following handoffs use MARKER.
   const operations=P.makePlan(config,qualified,F.source).operations;
   const policy={mode:A.MARKER,delegationCode:marker,target,targetCodeHash:E.keccak256(targetCode),qualification:{consensusEvidenceSha256:'1'.repeat(64),directExecutionEvidenceSha256:'2'.repeat(64)}};
   const scope=A.qualificationScope(policy,wallet.address,{source:F.source,buildId:qualified.id,buildDigest:qualified.buildDigest,catalogSha256:qualified.catalogSha256,block:config.block,executionHardfork:'osaka',operations});
   const reports={consensusEvidenceSha256:{schema:'manager-direct-consensus-report-v1',disposition:'direct-type2-create-does-not-invoke-origin-code',scope,reviewReference:'SYNTHETIC DISPOSABLE TEST ONLY; NOT LIVE QUALIFICATION',artifacts:{consensusSourceSha256:'3'.repeat(64),analysisSha256:'4'.repeat(64)}},directExecutionEvidenceSha256:{schema:'manager-direct-execution-report-v1',disposition:'nine-direct-creates-no-creator-or-target-invocation',scope,reviewReference:'SYNTHETIC INPUT; REAL TRACE OUTPUT IS SEPARATE, NOT PRODUCTION EVIDENCE',artifacts:{sourceCallGraphSha256:'5'.repeat(64),initcodeCallGraphSha256:'6'.repeat(64),traceSha256:'7'.repeat(64)},invocations:{creator:0,target:0}}};
   policy.qualification=Object.fromEntries(Object.entries(reports).map(([name,report])=>[name,T.digest(report)]));config.creatorPolicy=policy;config.qualificationEvidence={schema:'manager-marker-direct-qualification-evidence-v1',scope,reports};
   const plan=P.makePlan(config,qualified,F.source),context={directory:path.join(dir,'session'),qualified,source:F.source,rpc,revalidateSource:()=>true};fs.mkdirSync(path.join(dir,'locks'));await S.initialize({...context,plan,lockDirectory:path.join(dir,'locks')});
   const evidence=[];
   for(let i=0;i<9;i++){
    const handoff=await S.handoff(context),raw=await wallet.signTransaction(T.unsignedTransaction(handoff.envelope)),decoded=E.Transaction.from(raw);assert.equal(decoded.type,2);assert.equal(decoded.to,null);assert.equal(decoded.authorizationList,null);assert.equal(decoded.from,wallet.address);
    const imported=await S.importSigned(context,raw);await S.submit(context,{acknowledgement:imported.relayAcknowledgement,transmit:r=>local.send('eth_sendRawTransaction',[r])});const result=await S.reconcile(context);assert.equal(result.index,i);
    const trace=await local.send('debug_traceTransaction',[imported.transactionHash,{disableStorage:true,disableMemory:true,disableStack:false}]);const calls=callsFromTrace(trace),calleeEvidence=await observeCallees(imported.transactionHash,calls);noOriginExecution(calls,wallet.address,target,calleeEvidence);
    assert.equal(await local.getCode(wallet.address),marker);assert.equal(await local.getCode(target),targetCode);
    if(evidenceDirectory)fs.writeFileSync(path.join(evidenceDirectory,`trace-${i}.json`),T.canonical(trace),{flag:'wx'});
    evidence.push({index:i,transactionHash:imported.transactionHash,predictedAddress:plan.operations[i].predictedAddress,envelope:handoff.envelope,initcodeKeccak256:E.keccak256(handoff.envelope.data),traceSha256:T.digest(trace),steps:trace.structLogs.length,calls,...calleeEvidence});
   }
   assert.equal(await local.getTransactionCount(wallet.address),config.nonce+9);
   const result=await S.complete(context),manager=new E.Contract(plan.operations[8].predictedAddress,qualified.records.AGIJobManager.artifact.abi,local);
   assert.equal(result.status,'CORE_CREATED_PAUSED_CONFIGURATION_SEPARATE');assert.equal(await manager.owner(),P.GOVERNOR);assert.equal(await manager.pendingOwner(),E.ZeroAddress);assert.equal(await manager.paused(),true);assert.equal(await manager.moderators(wallet.address),false);assert.equal(await manager.additionalAgents(wallet.address),false);assert.equal(await manager.additionalValidators(wallet.address),false);
   const summary={schema:'manager-disposable-direct-origin-trace-v1',scope:'LOCAL SYNTHETIC SOURCE/ACCOUNT/USDC; NOT ACTUAL 6C8, MAINNET FORK, LEDGER OR FINAL-SOURCE NATIVE QUALIFICATION',hardfork:'osaka',chainId:1,creator:wallet.address,target,marker,planSha256:plan.payloadSha256,creatorInvocations:0,targetInvocations:0,operations:evidence};
   if(evidenceDirectory){fs.writeFileSync(path.join(evidenceDirectory,'report.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});fs.copyFileSync(path.join(dir,'catalog.json'),path.join(evidenceDirectory,'synthetic-catalog.json'),fs.constants.COPYFILE_EXCL);}
   console.log('DIRECT_ORIGIN_TRACE_RESULT '+JSON.stringify({...summary,operations:evidence.map(({envelope,...rest})=>rest)}));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 });
 it('the trace assertion detects forbidden execution even if the caller could swallow its failure',()=>{
  const creator='0x1111111111111111111111111111111111111111',target='0x2222222222222222222222222222222222222222';
  for(const op of ['CALL','CALLCODE','DELEGATECALL','STATICCALL'])for(const address of [creator,target]){
   const calls=callsFromTrace({failed:false,gas:1,returnValue:'',structLogs:[{op,depth:1,pc:0,gas:10,gasCost:1,stack:[address.slice(2).padStart(64,'0'),'01']},{op:'STOP',depth:1,pc:1,gas:9,gasCost:0,stack:[]}]});assert.throws(()=>noOriginExecution(calls,creator,target),/Forbidden/);
  }
 });
 it('rejects a real indirect marker callee even when its failed target execution is swallowed',async()=>{
  const wallet=E.Wallet.createRandom(),alias='0x6666666666666666666666666666666666666666',target='0x7777777777777777777777777777777777777777';
  await local.send('hardhat_setCode',[target,'0xfe']);await local.send('hardhat_setCode',[alias,'0xef0100'+target.slice(2)]);await local.send('hardhat_setBalance',[wallet.address,E.toQuantity(E.parseEther('1'))]);
  const data='0x6000600060006000600073'+alias.slice(2)+'61fffff15060006000f3';
  const raw=await wallet.signTransaction({type:2,chainId:1,nonce:0,to:null,value:0,data,gasLimit:300000,maxFeePerGas:10000000000,maxPriorityFeePerGas:1000000000,accessList:[]});
  const hash=await local.send('eth_sendRawTransaction',[raw]),trace=await local.send('debug_traceTransaction',[hash,{disableStorage:true,disableMemory:true,disableStack:false}]);
  const calls=callsFromTrace(trace),calleeEvidence=await observeCallees(hash,calls);assert.equal(calls.length,1);assert.equal(calls[0].target,alias);assert.equal(calleeEvidence.codeObservations[0].resolvedMarkerTarget,target);assert(trace.structLogs.some(x=>x.depth===2&&x.op==='INVALID'));
  const destinationOnlyWouldAccept=calls.every(call=>![wallet.address.toLowerCase(),target.toLowerCase()].includes(call.target.toLowerCase()));assert.equal(destinationOnlyWouldAccept,true,'Retain the old destination-only proof blind spot');
  assert.throws(()=>noOriginExecution(calls,wallet.address,target,calleeEvidence),/Marker-bearing callee/);
  if(process.env.MANAGER_DIRECT_TRACE_OUTPUT){const directory=path.resolve(process.env.MANAGER_DIRECT_TRACE_OUTPUT);fs.writeFileSync(path.join(directory,'alias-negative-trace.json'),T.canonical(trace),{flag:'wx'});fs.writeFileSync(path.join(directory,'alias-negative.json'),JSON.stringify({scope:'DISPOSABLE SYNTHETIC NEGATIVE ONLY; NO SELECTED PUBLIC ACCOUNT OR TARGET',transactionHash:hash,creator:wallet.address,alias,target,traceSha256:T.digest(trace),calls,...calleeEvidence,destinationOnlyWouldAccept,rejected:true},null,2)+'\n',{flag:'wx'});}
 });
 it('refuses incomplete, unbounded, missing-stack and unsupported nested-creation traces',()=>{
  const valid={failed:false,gas:1,returnValue:'',structLogs:[{op:'STOP',depth:1,pc:0,gas:1,gasCost:0,stack:[]}]};
  for(const mutate of [x=>x.structLogs=[],x=>x.structLogs[0].op='PUSH1',x=>delete x.structLogs[0].stack,x=>x.structLogs[0].depth=2,x=>x.structLogs[0].stack=['0x'+'1'.repeat(65)],x=>x.structLogs=Array(100001).fill(x.structLogs[0]),x=>x.structLogs.unshift({...x.structLogs[0],op:'CREATE'}),x=>x.structLogs.unshift({...x.structLogs[0],op:'SELFDESTRUCT'})]){const bad=structuredClone(valid);mutate(bad);assert.throws(()=>callsFromTrace(bad));}
 });
});
