'use strict';
// Sender semantics are distinct from wallet transport. No signer or delegation change exists here.
const E=require('ethers');
const {need,exact,address,integer,hash,sha,bytes,digest,canonical,validateEnvelope}=require('./transaction-envelope.cjs');
const EMPTY='empty-eoa-direct-create.v1',DELEGATED='delegated-eoa-direct-create.v1',MARKER='marker-eoa-direct-create.v1';
function validatePolicy(policy,creator){
 creator=address(creator);
 if(policy?.mode===EMPTY){exact(policy,['mode']);return policy;}
 if(policy?.mode===MARKER){
  exact(policy,['mode','delegationCode','target','targetCodeHash','qualification']);
  need(/^0xef0100[0-9a-f]{40}$/.test(policy.delegationCode),'Exact EIP-7702 delegation indicator required.');
  need(address(policy.target)===E.getAddress('0x'+policy.delegationCode.slice(8))&&address(policy.target)!==creator,'Delegate target mismatch or self delegation.');hash(policy.targetCodeHash);
  exact(policy.qualification,['consensusEvidenceSha256','directExecutionEvidenceSha256']);Object.values(policy.qualification).forEach(sha);return policy;
 }
 exact(policy,['mode','delegationCode','target','targetCodeHash','stateChecks','qualification']);
 need(policy.mode===DELEGATED,'Unsupported creator policy: factory, smart-wallet, batch and type4 paths are not supported.');
 need(/^0xef0100[0-9a-f]{40}$/.test(policy.delegationCode),'Exact EIP-7702 delegation indicator required.');
 need(address(policy.target)===E.getAddress('0x'+policy.delegationCode.slice(8))&&address(policy.target)!==creator,'Delegate target mismatch or self delegation.');hash(policy.targetCodeHash);
 need(Array.isArray(policy.stateChecks)&&policy.stateChecks.length>0&&policy.stateChecks.length<=32,'Bounded reviewed delegate state checks required.');const seen=new Set();
 for(const check of policy.stateChecks){exact(check,['to','data','resultHash']);address(check.to);bytes(check.data);need(check.data.length>=10,'State getter calldata required.');hash(check.resultHash);const key=check.to.toLowerCase()+check.data;need(!seen.has(key),'Duplicate delegate state check.');seen.add(key);}
 exact(policy.qualification,['consensusEvidenceSha256','forkEvidenceSha256','delegateReviewSha256']);Object.values(policy.qualification).forEach(sha);return policy;
}
function qualificationScope(policy,creator,context){
 if(policy?.mode===MARKER)return markerQualificationScope(policy,creator,context);
 validatePolicy(policy,creator);need(policy.mode===DELEGATED,'Delegated qualification scope requires a delegated policy.');
 exact(context,['source','buildId','buildDigest','catalogSha256','block','executionHardfork']);
 exact(context.source,['commit','tree','rootLockSha256','hardhatLockSha256']);
 need(/^[a-f0-9]{40}$/.test(context.source.commit)&&/^[a-f0-9]{40}$/.test(context.source.tree),'Qualification requires exact source revision.');
 sha(context.source.rootLockSha256);sha(context.source.hardhatLockSha256);sha(context.buildDigest);sha(context.catalogSha256);
 need(typeof context.buildId==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(context.buildId),'Qualification requires explicit build ID.');
 exact(context.block,['number','hash']);integer(context.block.number,1);hash(context.block.hash);
 need(context.executionHardfork==='osaka','Qualification requires the explicit Osaka execution fork.');
 return {schema:'manager-delegated-qualification-scope-v1',chainId:1,creator:address(creator),target:address(policy.target),targetCodeHash:policy.targetCodeHash,
  source:structuredClone(context.source),build:{id:context.buildId,digest:context.buildDigest,catalogSha256:context.catalogSha256},block:structuredClone(context.block),executionHardfork:'osaka',stateChecks:structuredClone(policy.stateChecks)};
}
function validateEvidence(policy,creator,evidence,context){
 validatePolicy(policy,creator);if(policy.mode===EMPTY){need(evidence===null,'Empty EOA policy takes no delegated evidence.');return;}
 if(policy.mode===MARKER)return validateMarkerEvidence(policy,creator,evidence,context);
 const scope=qualificationScope(policy,creator,context);
 exact(evidence,['schema','scope','reports']);need(evidence.schema==='manager-delegated-qualification-evidence-v2'&&canonical(evidence.scope)===canonical(scope),'Qualification evidence scope differs.');
 exact(evidence.reports,Object.keys(policy.qualification));
 for(const [kind,expected] of Object.entries(policy.qualification)){
  const report=evidence.reports[kind];need(report&&typeof report==='object'&&!Array.isArray(report)&&digest(report)===expected,'Missing or substituted independently reviewed evidence report.');
  need(report.disposition==='pass'&&canonical(report.scope)===canonical(scope)&&typeof report.reviewReference==='string'&&report.reviewReference.length>=8,'Evidence report is unqualified or scoped to another source/build/block/fork/state/actor.');
 }
 // Report hashes and dispositions bind operator-selected evidence; they do not certify reviewer independence or actual key custody.
}
// This profile qualifies only these exact direct CREATE transactions. It does not
// review delegate authority, establish key custody, or remove an existing marker.
// Other transactions/invocations can still change nonce, balance or authority;
// neither these checks nor no-invocation evidence resolve key-compromise risk.
function markerQualificationScope(policy,creator,context){
 validatePolicy(policy,creator);need(policy.mode===MARKER,'Marker qualification scope requires the direct-origination marker policy.');
 exact(context,['source','buildId','buildDigest','catalogSha256','block','executionHardfork','operations']);
 exact(context.source,['commit','tree','rootLockSha256','hardhatLockSha256']);
 need(/^[a-f0-9]{40}$/.test(context.source.commit)&&/^[a-f0-9]{40}$/.test(context.source.tree),'Qualification requires exact source revision.');
 sha(context.source.rootLockSha256);sha(context.source.hardhatLockSha256);sha(context.buildDigest);sha(context.catalogSha256);
 need(typeof context.buildId==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(context.buildId),'Qualification requires explicit build ID.');
 exact(context.block,['number','hash']);integer(context.block.number,1);hash(context.block.hash);
 need(context.executionHardfork==='osaka','Qualification requires the explicit Osaka execution fork.');
 need(Array.isArray(context.operations)&&context.operations.length===9,'Exactly nine direct CREATE operation commitments required.');
 creator=address(creator);const startNonce=context.operations[0]?.envelope?.nonce;integer(startNonce);need(startNonce<=Number.MAX_SAFE_INTEGER-8,'Nonce overflow.');
 const operations=context.operations.map((operation,index)=>{
  exact(operation,['id','name','qualifiedName','predictedAddress','constructorArguments','libraries','envelope']);
  need(operation.id===index,'Direct CREATE operation indexes must be exactly zero through eight.');
  const e=validateEnvelope(operation.envelope);
  need(e.from===creator&&e.nonce===startNonce+index,'Direct CREATE creator or contiguous nonce differs.');
  need(operation.predictedAddress===E.getCreateAddress({from:creator,nonce:e.nonce}),'Predicted direct CREATE address differs.');
  return {index,nonce:e.nonce,from:e.from,to:null,value:e.value,predictedAddress:operation.predictedAddress,initcodeKeccak256:E.keccak256(e.data),envelopeSha256:digest(e)};
 });
 return {schema:'manager-marker-direct-qualification-scope-v1',chainId:1,creator,delegationCode:policy.delegationCode,target:address(policy.target),targetCodeHash:policy.targetCodeHash,
  source:structuredClone(context.source),build:{id:context.buildId,digest:context.buildDigest,catalogSha256:context.catalogSha256},block:structuredClone(context.block),executionHardfork:'osaka',operations};
}
function validateMarkerEvidence(policy,creator,evidence,context){
 const scope=markerQualificationScope(policy,creator,context);
 exact(evidence,['schema','scope','reports']);need(evidence.schema==='manager-marker-direct-qualification-evidence-v1'&&canonical(evidence.scope)===canonical(scope),'Direct-origination qualification evidence scope differs.');
 exact(evidence.reports,['consensusEvidenceSha256','directExecutionEvidenceSha256']);
 for(const [kind,expected] of Object.entries(policy.qualification)){
  const report=evidence.reports[kind];need(report&&typeof report==='object'&&!Array.isArray(report)&&digest(report)===expected,'Missing or substituted direct-origination evidence report.');
  const consensus=kind==='consensusEvidenceSha256';
  exact(report,consensus?['schema','disposition','scope','reviewReference','artifacts']:['schema','disposition','scope','reviewReference','artifacts','invocations']);
  need(report.schema===(consensus?'manager-direct-consensus-report-v1':'manager-direct-execution-report-v1')&&report.disposition===(consensus?'direct-type2-create-does-not-invoke-origin-code':'nine-direct-creates-no-creator-or-target-invocation'),'Evidence does not establish the exact no-invocation proposition.');
  need(canonical(report.scope)===canonical(scope)&&typeof report.reviewReference==='string'&&report.reviewReference.length>=8&&report.reviewReference.length<=2048,'Direct-origination report is scoped to another source/build/block/fork/actor/operation.');
  exact(report.artifacts,consensus?['consensusSourceSha256','analysisSha256']:['sourceCallGraphSha256','initcodeCallGraphSha256','traceSha256']);Object.values(report.artifacts).forEach(sha);
  // Counts cover every nested CALL/CALLCODE/DELEGATECALL/STATICCALL into either
  // address, including code entered by resolving the creator's delegation marker.
  if(!consensus){exact(report.invocations,['creator','target']);need(report.invocations.creator===0&&report.invocations.target===0,'Creator or target invocation is outside this profile.');}
 }
 // These hashes bind externally reviewed report/artifact bytes; shape validation
 // cannot certify artifact truth, completeness, reviewer independence or custody.
 // No general target safety, state stability or production readiness is inferred.
}
async function pin(rpc,selector='latest'){
 const b=await rpc('eth_getBlockByNumber',[selector,false]);need(b&&/^0x[0-9a-f]+$/.test(b.number)&&/^0x[0-9a-f]{64}$/.test(b.hash),'Missing canonical block.');const number=Number(BigInt(b.number));integer(number);return {number,hash:b.hash,gasLimit:String(BigInt(b.gasLimit)),baseFeePerGas:String(BigInt(b.baseFeePerGas))};
}
async function canonicalCheck(rpc,block){const b=await pin(rpc,E.toQuantity(block.number));need(b.hash===block.hash,'Canonical block changed.');}
async function observeActor(rpc,{creator,governor,creatorPolicy},block){
 validatePolicy(creatorPolicy,creator);const at={blockHash:block.hash,requireCanonical:true};
 need(BigInt(await rpc('eth_chainId',[]))===1n,'Wrong chain.');
 const code=await rpc('eth_getCode',[creator,at]);
 if(creatorPolicy.mode===EMPTY)need(code==='0x','Empty-code EOA mode rejects delegated/contract creator.');
 else{
  need(code===creatorPolicy.delegationCode,'Creator delegation indicator changed.');
  const targetCode=await rpc('eth_getCode',[creatorPolicy.target,at]);need(targetCode!=='0x'&&E.keccak256(targetCode)===creatorPolicy.targetCodeHash,'Delegate target runtime changed.');
  if(creatorPolicy.mode===DELEGATED)for(const check of creatorPolicy.stateChecks)need(E.keccak256(await rpc('eth_call',[{to:check.to,data:check.data,from:E.ZeroAddress},at]))===check.resultHash,'Delegate authority state changed.');
 }
 // The requested d76 governor is an independently selected EOA; no signing access is inferred.
 need(await rpc('eth_getCode',[governor,at])==='0x','Requested EOA governor has unexpected code.');
 await canonicalCheck(rpc,block);return {creatorCodeHash:E.keccak256(code),governorCodeHash:E.keccak256('0x'),policySha256:digest(creatorPolicy),block};
}
module.exports={EMPTY,DELEGATED,MARKER,validatePolicy,qualificationScope,markerQualificationScope,validateEvidence,pin,canonicalCheck,observeActor};
