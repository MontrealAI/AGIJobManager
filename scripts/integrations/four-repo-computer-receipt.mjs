// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';
import { canonical, parseStrict } from '../../site/assets/successor/safe.mjs';

export const COMPUTER_RECEIPT_DRAFT_SCHEMA = 'agijobmanager/four-repo-computer-draft/v1';
const MAX_INPUT = 4_000_000, MAX_DRAFT = 8_388_608;
const route = Object.freeze({backend:'agijobmanager',asset:'USDC',decimals:6,chainId:1,
  token:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',deployment:null});
const need = (value, code) => { if (!value) throw Object.assign(Error(code),{code}); };
const digest = raw => 'sha256:'+createHash('sha256').update(raw,'utf8').digest('hex');
const same = (a,b) => canonical(a) === canonical(b);
function read(raw, maximum=MAX_INPUT) {
  need(typeof raw === 'string' && Buffer.byteLength(raw,'utf8') <= maximum,'COMPUTER_DRAFT_SIZE');
  return parseStrict(raw,maximum);
}
function exact(value, keys, code) {
  need(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...keys].sort().join('|'),code);
}
function budget(value) {
  need(typeof value === 'string' && /^(?:0|[1-9][0-9]{0,32})(?:\.[0-9]{1,6})?$/.test(value),'COMPUTER_DRAFT_USDC');
  const [whole,fraction='']=value.split('.'), units=BigInt(whole)*1_000_000n+BigInt(fraction.padEnd(6,'0'));
  need(units>0n && units<=(1n<<128n)-1n,'COMPUTER_DRAFT_USDC');
  return {budgetUSDC:value,amountBaseUnits:units.toString(),decimals:6,status:'unfunded-proposal',reservedBaseUnits:'0'};
}

/** Share evidence validation through code installed from the exact compatibility set; select USDC independently. */
export async function createComputerReceiptDraft(supplied,{budgetUSDC,createdAt,inspectAlphaReturn,inspectComputerEvidence}={}) {
  exact(supplied,['handoffRaw','returnRaw','reportRaw'],'COMPUTER_DRAFT_INPUT_FIELDS');
  for (const raw of Object.values(supplied)) read(raw);
  need(typeof inspectAlphaReturn === 'function' && typeof inspectComputerEvidence === 'function','COMPUTER_EVIDENCE_INSPECTOR_REQUIRED');
  need(typeof createdAt==='string' && Number.isFinite(Date.parse(createdAt)) && new Date(createdAt).toISOString()===createdAt,'COMPUTER_DRAFT_CLOCK');
  const planning=budget(budgetUSDC), original=JSON.parse(canonical(supplied));
  const evidence=JSON.parse(canonical(await inspectComputerEvidence(original,{inspectAlphaReturn})));
  exact(evidence,['original','project','bindings','observationReview','report'],'COMPUTER_EVIDENCE_FIELDS');
  need(same(evidence.original,original) && evidence.observationReview?.accepted===true,'COMPUTER_EVIDENCE_BINDING');
  const handoff=read(original.handoffRaw), returned=read(original.returnRaw);
  need(evidence.bindings?.handoffRawSha256===digest(original.handoffRaw)
    && evidence.bindings?.returnRawSha256===digest(original.returnRaw)
    && evidence.bindings?.reportRawSha256===digest(original.reportRaw)
    && evidence.project?.projectSha256===handoff.projectSha256
    && evidence.bindings?.taskCommitment===returned.taskCommitment
    && evidence.bindings?.executionContext===returned.executionContext,'COMPUTER_EVIDENCE_BINDING');
  const specification={schema:'agijobmanager/computer-observation-review/v1',project:evidence.project,bindings:evidence.bindings,
    inputPolicy:'public-nonpersonal-only',requiredReview:'independent-review-required',authority:'none'};
  const specificationRaw=canonical(specification);
  const body={schema:COMPUTER_RECEIPT_DRAFT_SCHEMA,createdAt,route,project:evidence.project,bindings:evidence.bindings,original,planning,
    jobSpecification:{raw:specificationRaw,sha256:digest(specificationRaw),uri:null},
    commissioning:{method:'createJob(string,uint256,uint256,string)',payoutBaseUnits:planning.amountBaseUnits,
      specURI:null,durationSeconds:null,details:null,state:'requires-deployment-and-terms-selection',transaction:null},
    observationReview:evidence.observationReview,review:'independent-review-required',
    provenance:'untrusted-historical-observation-revalidated',trustedComputerExecution:false,independentProof:false,
    protectedQualification:false,authority:'none',settlement:'not-connected',settlementApproved:false,productionApproved:false};
  const raw=canonical({...body,sha256:digest(canonical(body))});
  need(Buffer.byteLength(raw,'utf8')<=MAX_DRAFT,'COMPUTER_DRAFT_SIZE'); return raw;
}

export async function inspectComputerReceiptDraft(raw,options={}) {
  const value=read(raw,MAX_DRAFT), rebuilt=await createComputerReceiptDraft(value.original,{...options,
    budgetUSDC:value.planning?.budgetUSDC,createdAt:value.createdAt});
  need(raw===rebuilt,'COMPUTER_DRAFT_INTEGRITY'); return value;
}
