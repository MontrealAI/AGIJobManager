'use strict';
const path=require('node:path');
const {ensure,read,sha256,stringify}=require('./io.cjs');
const C=require('../../../hardhat/scripts/check-ens-usdc-connection.cjs');
const DEC=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x);
const REF=x=>x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.reference==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(x.reference)&&/^[a-f0-9]{64}$/.test(x.sha256)&&typeof x.reviewer==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(x.reviewer);
const POLICY=require('./inspect.cjs').POLICY;
function template(){return {schema:'agijobmanager-activation-input-v1',revision:1,instance:'recorded-2026-10-10',manager:C.P.manager,chainId:1,
  observation:{file:null,sha256:null},lifecycle:{file:null,sha256:null},
  A1:{publicAdmissionAccepted:false,noGlobalCapAcknowledged:false,pauseAfterAssignmentAcknowledged:false,windowStart:null,windowEnd:null,policy:Object.fromEntries(POLICY.map(k=>[k,null])),acceptance:null},
  A2:{review:null,reviewedRecipients:null,reviewedUsdcImplementation:null,nftPolicyReview:null,witnessRelianceAccepted:false},
  A3:{employer:null,agent:null,moderator:null,successAndAdversePaths:null,eligibilityFundsAndSignerReview:null,independenceReview:null},
  A4:{approvalHistoryReview:null,activeOperatorControlReview:null,retainedPowersReview:null,keyRecoveryReview:null,fundedResponseSignerReview:null,alertResponseExercise:null},
  A5:{operatorNotice:null,feeBeneficiaryNotice:null,publicInputDataIpTerms:null,responseContacts:null,actualInterfaceAndAdmission:null},
  authorization:{status:'NOT_REQUESTED',reviewer:null,scope:null,evidenceReferences:[],approval:null}};}
function evidence(ref,base,role,inputs){
  if(!ref?.file || !ref?.sha256)return null;
  ensure(typeof ref.file==='string' && /^[a-f0-9]{64}$/.test(ref.sha256),'EVIDENCE_REFERENCE_INVALID');
  ensure(!ref.file.split(/[\\/]/).includes('..'),'EVIDENCE_PATH_TRAVERSAL');
  const r=read(path.isAbsolute(ref.file)?ref.file:path.join(base,ref.file),8*1024*1024);
  ensure(r.sha256===ref.sha256,'EVIDENCE_HASH_MISMATCH'); inputs.push({role,sha256:r.sha256,bytes:r.bytes}); return r.value;
}
function validateObservation(o,now) {
  ensure(o?.schema==='agijobmanager-current-observation-v1' && o.chainId===1 && C.eq(o.manager,C.P.manager) && C.eq(o.helper,C.P.helper) && o.namespace===C.P.root,'OBSERVATION_IDENTITY');
  ensure(o.intakeActivationAuthorized===false && o.productionReadinessCertified===false && o.publicTransactionsBroadcast===0,'OBSERVATION_AUTHORITY');
  ensure(o.snapshot&&Number.isSafeInteger(o.snapshot.number)&&/^0x[0-9a-f]{64}$/.test(o.snapshot.hash)&&DEC(o.snapshot.timestampSeconds),'OBSERVATION_BLOCK');
  const age=BigInt(now)-BigInt(o.snapshot.timestampSeconds)*1000n;
  ensure(age>=-60000n && age<=900000n,'OBSERVATION_STALE');
  const ens=o.sections?.ens?.historicalSchemaReport;
  ensure(ens?.snapshot?.number===o.snapshot.number && ens.snapshot.hash===o.snapshot.hash,'OBSERVATION_BLOCK_CONFLICT');
  ensure(o.source?.commit&&/^[a-f0-9]{40}$/.test(o.source.commit)&&o.source.worktreeChanged===false,'OBSERVATION_SOURCE_UNQUALIFIED');
}
function validateLifecycle(r){
  ensure(r?.schema==='agijobmanager-rehearsal-v1' && r.status==='PASS' && r.launcher==='COMPLETED' && r.child?.status==='PASS' &&
    r.outcome?.code===0 && r.outcome?.timedOut===false &&
    r.transport?.rejections===0 && r.transport?.upstreamFailures===0 && r.transport?.publicTransactionsBroadcast===0 &&
    r.intakeActivationAuthorized===false && r.productionReadinessCertified===false && r.simulationChainId===31337 && r.publicTransactionsBroadcast===0 &&
    Array.isArray(r.child.checks) && r.child.checks.length>=3 && r.child.isolation?.exactLauncherProxyMatched===true && r.child.fixtures?.realWalletOrIndependentParticipantEvidence===false &&
    r.source?.worktreeChanged===false && /^[a-f0-9]{40}$/.test(r.source?.commit||'') && /^[a-f0-9]{64}$/.test(r.childSha256||'') &&
    sha256(stringify(r.child))===r.childSha256,'LIFECYCLE_NOT_QUALIFIED');
}
function review(input,{base=process.cwd(),now=Date.now()}={}){
  ensure(input?.schema==='agijobmanager-activation-input-v1' && Number.isSafeInteger(input.revision)&&input.revision>0 &&
    input.instance==='recorded-2026-10-10'&&input.chainId===1&&C.eq(input.manager,C.P.manager),'ACTIVATION_INPUT_SCHEMA');
  ensure(!input.intakeActivationAuthorized&&!input.productionReadinessCertified,'ACTIVATION_AUTHORITY_REFUSED');
  const inputs=[],o=evidence(input.observation,base,'current-observation',inputs),l=evidence(input.lifecycle,base,'isolated-lifecycle',inputs);
  if(o)validateObservation(o,now); if(l)validateLifecycle(l);
  if(o&&l){
    ensure(o.source.commit===l.source.commit,'EVIDENCE_SOURCE_CONFLICT');
    ensure(l.reviewedObservationSha256===input.observation.sha256 && l.snapshot?.number===o.snapshot.number && l.snapshot?.hash===o.snapshot.hash,'LIFECYCLE_OBSERVATION_CONFLICT');
  }
  const groups=[],add=(id,items)=>{const missing=items.filter(([,ok])=>!ok).map(([name])=>name);groups.push({id,status:missing.length?'NEEDS_OPERATOR_INPUT':'PASS',missing});};
  const a=input.A1||{},b=input.A2||{},c=input.A3||{},d=input.A4||{},e=input.A5||{};
  const start=Date.parse(a.windowStart),end=Date.parse(a.windowEnd);
  add('A1',[
    ['public-admission acceptance',a.publicAdmissionAccepted===true],['no aggregate/job-count cap acknowledgement',a.noGlobalCapAcknowledged===true],
    ['pause after assignment acknowledgement',a.pauseAfterAssignmentAcknowledged===true],['finite future admission window',Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end>now],
    ['all limits, bonds and timers as integer strings',POLICY.every(k=>DEC(a.policy?.[k]))],['operator acceptance record',REF(a.acceptance)],
    ['chosen policy matches current on-chain state',!!o&&POLICY.every(k=>DEC(a.policy?.[k])&&a.policy[k]===o.sections?.core?.observed?.[k])]]);
  add('A2',[
    ['fresh coherent core and ENS report',o?.sections?.core?.status==='PASS'&&o?.sections?.ens?.status==='PASS'],['financial/policy review',REF(b.review)],
    ['reviewed recipients',Array.isArray(b.reviewedRecipients)&&b.reviewedRecipients.length===2&&!!o&&b.reviewedRecipients.every((v,i)=>C.eq(v,o.sections?.core?.observed?.[['wallet30','wallet10'][i]]))],
    ['reviewed issuer implementation',!!o&&C.eq(b.reviewedUsdcImplementation,o.sections?.core?.token?.implementation)],['complete NFT policy review',REF(b.nftPolicyReview)],['RPC witness limitations accepted',b.witnessRelianceAccepted===true]]);
  const addresses=[c.employer,c.agent,c.moderator];
  const participantEvidence=Object.create(null);
  for(const [address,flags] of Object.entries(o?.sections?.core?.participantExceptions||{})){
    ensure(/^0x[0-9a-fA-F]{40}$/.test(address)&&!Object.hasOwn(participantEvidence,address.toLowerCase()),'PARTICIPANT_OBSERVATION_CONFLICT');
    participantEvidence[address.toLowerCase()]=flags;
  }
  add('A3',[
    ['three distinct paid-work participant addresses',addresses.every(x=>typeof x==='string'&&/^0x[0-9a-fA-F]{40}$/.test(x)&&!C.eq(x,C.ZERO))&&new Set(addresses.map(x=>x?.toLowerCase())).size===3],
    ['participant observations at the review block',!!o&&addresses.every(x=>typeof x==='string'&&participantEvidence[x.toLowerCase()])],
    ['source-enforced moderator membership',!!o&&participantEvidence[c.moderator?.toLowerCase()]?.moderators===true],
    ['funded/signing/eligibility review',REF(c.eligibilityFundsAndSignerReview)],['human independence and conflicts review',REF(c.independenceReview)],
    ['success, disputes, expiry, refunds and claims review',REF(c.successAndAdversePaths)],['isolated lifecycle evidence',!!l]]);
  add('A4',[
    ['bounded approval inventory',o?.sections?.approvals?.status==='PASS'&&o.sections.approvals.coverageContiguous===true],
    ...['approvalHistoryReview','activeOperatorControlReview','retainedPowersReview','keyRecoveryReview','fundedResponseSignerReview','alertResponseExercise'].map(k=>[k,REF(d[k])])]);
  add('A5',['operatorNotice','feeBeneficiaryNotice','publicInputDataIpTerms','responseContacts','actualInterfaceAndAdmission'].map(k=>[k,REF(e[k])]));
  return {schema:'agijobmanager-activation-review-v1',revision:input.revision,reviewedAt:new Date(now).toISOString(),manager:C.P.manager,chainId:1,
    status:groups.every(g=>g.status==='PASS')?'COLLECTION_COMPLETE_REVIEW_REQUIRED':'NEEDS_OPERATOR_INPUT',groups,inputs,
    intakeActivationAuthorized:false,productionReadinessCertified:false,publicTransactionsBroadcast:0,
    authorization:{status:'NOT_ASSESSED',scope:'Approval authenticity and operator authority require a separate signed, versioned decision; this command cannot grant approval.'},
    limitations:['Reference hashes bind reviewed inputs, not the truth or legal effect of private attestations.','Software collection is neither on-chain enforcement nor participant independence proof.','The historical activation HOLD is unchanged.']};
}
module.exports={template,review,validateObservation,validateLifecycle};
