const assert=require('node:assert/strict');
const {checkNewWork,checkAdmission}=require('../scripts/economics/admission.cjs');
const {qualificationFixture}=require('../scripts/economics/qualification-fixture.cjs');
const {checkExecutionWindow}=require('../scripts/economics/execution-window.cjs');
const fs=require('node:fs');
describe('No-retainer operating boundary and feasible work windows',()=>{
 it('admits calibrated operator-budget work with no retainer income',()=>{assert.equal(checkNewWork(qualificationFixture({reviewPayment:'operator-budget'})).decision,'QUALIFIED_UNDER_ATTESTED_INPUTS');});
 it('rejects legacy and explicit retainers for new work while retaining historical analysis',()=>{const f=qualificationFixture();assert.throws(()=>checkNewWork(f),/NEW_WORK_REQUIRES_OPERATOR_BUDGET/);assert.equal(checkAdmission(f).decision,'QUALIFIED_UNDER_ATTESTED_INPUTS');f.policy.schemaVersion=6;f.policy.reviewPayment='retainer';assert.throws(()=>checkNewWork(f),/NEW_WORK_REQUIRES_OPERATOR_BUDGET/);});
 it('reserves a complete work budget and completion margin, including queued time',()=>{const s=JSON.parse(fs.readFileSync('examples/computer-work-v2.json'));s.deadline=1000;assert.equal(checkExecutionWindow(s,'reviewer',{now:360,queueSeconds:10}).startBy,370);assert.throws(()=>checkExecutionWindow(s,'reviewer',{now:361,queueSeconds:10}),/INSUFFICIENT_TIME/);});
 it('uses the earlier chain deadline and rejects invalid clocks or zero recovery margin',()=>{const s=JSON.parse(fs.readFileSync('examples/computer-work-v2.json'));for(const options of [{now:100,closeAt:700},{now:NaN},{now:100,reserveSeconds:0},{now:100,queueSeconds:-1}])assert.throws(()=>checkExecutionWindow(s,'agent',options));});
 it('publishes a complete synthetic CLI input that the current boundary accepts',()=>{const {execFileSync}=require('node:child_process');for(const role of ['agent','reviewer']){const input=JSON.parse(execFileSync(process.execPath,['scripts/economics/admission-example.cjs',role],{encoding:'utf8'}));assert.equal(input.policy.role,role);assert.equal(typeof input.evidenceReport,'string');assert.equal(checkNewWork(input).decision,'QUALIFIED_UNDER_ATTESTED_INPUTS');}});
 it('documents the required calibration-report bytes in CLI help',()=>{const {execFileSync}=require('node:child_process');const help=execFileSync(process.execPath,['scripts/economics/admission.cjs','--help'],{encoding:'utf8'});assert.match(help,/evidenceReport/);assert.match(help,/schema 6/);assert.match(help,/operator-budget/);});
});
