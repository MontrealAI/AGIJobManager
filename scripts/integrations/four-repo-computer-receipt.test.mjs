import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonical } from '../../site/assets/successor/safe.mjs';
import { createComputerReceiptDraft, inspectComputerReceiptDraft } from './four-repo-computer-receipt.mjs';

const digest=raw=>'sha256:'+createHash('sha256').update(raw).digest('hex');
const supplied={handoffRaw:canonical({projectSha256:'b'.repeat(64)}),
  returnRaw:canonical({taskCommitment:'sha256:'+'c'.repeat(64),executionContext:'sha256:'+'d'.repeat(64)}),reportRaw:'{}'};
// This boundary double tests Manager policy. Hosted compatibility exercises the installed Jobs and Alpha inspectors.
const inspectAlphaReturn=async()=>{throw Error('Only the installed evidence inspector calls Alpha');};
const inspectComputerEvidence=async original=>({original,project:{id:'public-fixture',revision:1,cycleId:null,projectSha256:'b'.repeat(64)},
  bindings:{handoffRawSha256:digest(original.handoffRaw),returnRawSha256:digest(original.returnRaw),reportRawSha256:digest(original.reportRaw),
    taskCommitment:JSON.parse(original.returnRaw).taskCommitment,executionContext:JSON.parse(original.returnRaw).executionContext},
  observationReview:{accepted:true,independentProof:false},report:{}});
const options={budgetUSDC:'25.00',createdAt:'2026-10-19T14:00:00.000Z',inspectAlphaReturn,inspectComputerEvidence};

test('USDC proposal parses exact base units without choosing a deployment or granting authority',async()=>{
  const raw=await createComputerReceiptDraft(supplied,options), value=await inspectComputerReceiptDraft(raw,options);
  assert.equal(value.route.asset,'USDC');assert.equal(value.route.decimals,6);
  assert.equal(value.planning.amountBaseUnits,'25000000');assert.equal(value.planning.reservedBaseUnits,'0');
  assert.equal(value.route.deployment,null);assert.equal(value.commissioning.transaction,null);
  assert.equal(value.commissioning.specURI,null);assert.equal(value.commissioning.durationSeconds,null);
  assert.equal(value.authority,'none');assert.equal(value.productionApproved,false);assert.equal(value.settlementApproved,false);
  assert.equal(value.jobSpecification.sha256,digest(value.jobSpecification.raw));
});
test('budgets reject rounding, exponent notation, ambiguity and integer overflow',async()=>{
  for(const budgetUSDC of ['0','00.1','01','1e6','-1','1.0000001',' 1','1.',(1n<<128n).toString(),25])
    await assert.rejects(createComputerReceiptDraft(supplied,{...options,budgetUSDC}),/COMPUTER_DRAFT_USDC/);
  const value=JSON.parse(await createComputerReceiptDraft(supplied,{...options,budgetUSDC:'0.000001'}));
  assert.equal(value.planning.amountBaseUnits,'1');
});
test('import replays policy even when outer checksum is recomputed',async()=>{
  const raw=await createComputerReceiptDraft(supplied,options);
  for(const mutate of [x=>{x.route.asset='AGIALPHA';},x=>{x.authority='live';},x=>{x.planning.reservedBaseUnits='1';},
    x=>{x.route.deployment='0x'+'1'.repeat(40);},x=>{x.productionApproved=true;}]){
    const value=JSON.parse(raw);mutate(value);const {sha256,...body}=value;
    await assert.rejects(inspectComputerReceiptDraft(canonical({...body,sha256:digest(canonical(body))}),options),/COMPUTER_DRAFT_INTEGRITY/);
  }
});
test('exact evidence hashes and accepted review are required from installed shared inspector',async()=>{
  for(const mutate of [x=>{x.original.reportRaw+=' ';},x=>{x.bindings.returnRawSha256='sha256:'+'0'.repeat(64);},
    x=>{x.project.projectSha256='0'.repeat(64);},x=>{x.observationReview.accepted=false;}]){
    const inspector=async original=>{const value=await inspectComputerEvidence(original);const cloned=structuredClone(value);mutate(cloned);return cloned;};
    await assert.rejects(createComputerReceiptDraft(supplied,{...options,inspectComputerEvidence:inspector}),/COMPUTER_EVIDENCE_BINDING/);
  }
});
test('payload cannot install code and missing native inspectors fail closed',async()=>{
  await assert.rejects(createComputerReceiptDraft({...supplied,inspector:'https://example.invalid/code.mjs'},options),/COMPUTER_DRAFT_INPUT_FIELDS/);
  for(const key of ['inspectComputerEvidence','inspectAlphaReturn'])
    await assert.rejects(createComputerReceiptDraft(supplied,{...options,[key]:undefined}),/COMPUTER_EVIDENCE_INSPECTOR_REQUIRED/);
  await assert.rejects(createComputerReceiptDraft(supplied,{...options,inspectComputerEvidence:async()=>{throw Error('native rejected');}}),/native rejected/);
});
test('bounded strict JSON and canonical timestamps reject ambiguous imports',async()=>{
  await assert.rejects(createComputerReceiptDraft({...supplied,reportRaw:'{"x":1,"x":2}'},options),/DUPLICATE_KEY/);
  await assert.rejects(createComputerReceiptDraft({...supplied,returnRaw:' '.repeat(4_000_001)},options),/COMPUTER_DRAFT_SIZE/);
  await assert.rejects(createComputerReceiptDraft(supplied,{...options,createdAt:'2026-10-19'}),/COMPUTER_DRAFT_CLOCK/);
});
