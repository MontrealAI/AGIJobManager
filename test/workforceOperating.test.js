const assert=require('node:assert/strict');
const {fixture}=require('./workforceQualification.test.js');
const {qualifyWorkforce,validatePolicy}=require('../scripts/economics/workforce.cjs');
const {digest}=require('../scripts/economics/computer-work.cjs');
const {capacityPlan,projectWindow}=require('../scripts/economics/capacity-plan.cjs');
function operating(){
 const f=fixture();f.policy.schema='agi-workforce-policy/v2';
 f.policy.operatingLimits={minimumNetUSDCByRole:{agent:'0',reviewer:'0'},maximumHumanSecondsPerUsefulJob:5,minimumUsefulRateLower95:.3,minimumCorrectReviewRateLower95:.3,minimumCasesPerCohort:2,maximumCohortFalseAcceptanceRate:.1,maximumLossRate:.2,cohorts:['held-out']};
 for(const c of f.payloads.validation.plan.cases)if(c.partition==='evaluation')c.group='held-out';
 f.payloads.validation.ledger.planSha256=digest(f.payloads.validation.plan);f.resign();return f;
}
function planned(){return {schema:'agi-capacity-plan/v1',measurementKind:'synthetic',terms:{maxActiveJobsPerAgent:3,requiredApprovals:3,requiredDisapprovals:3,voteQuorum:3,reviewSeconds:604800,challengeSeconds:86400},agents:[{id:'agent',activeJobs:0}],reviewers:[0,1,2].map(i=>({id:'node'+i,controller:'controller'+i,credential:'key'+i,failureDomain:'model'+i})),human:{availableSecondsPerDay:7200,queuedSeconds:0},job:{remainingSeconds:172800,agentSeconds:600,reviewSeconds:600,humanSeconds:60,queueSeconds:0,reserveSeconds:60}};}
describe('Simulation-informed operating qualification',function(){
 it('accepts complete signed V2 fixtures without conferring real operational evidence',()=>{const f=operating();assert.equal(qualifyWorkforce(f.policy,f.evidence,{now:f.now}).eligible,true);});
 for(const [name,mutate,code] of [
  ['profitable Agents masking losing Nodes',f=>{for(const r of f.payloads.validation.ledger.engagements)if(r.caseId.includes('reviewer'))r.costUSDC='3';else r.receiptsUSDC='100';},'ROLE_ECONOMICS_LIMIT'],
  ['reviewer abstention masking false-approval rate',f=>{for(const r of f.payloads.validation.ledger.engagements)if(r.caseId.startsWith('evaluation-reviewer'))r.verdict='abstain';},'COHORT_REVIEW_LIMIT'],
  ['human effort divided by failures',f=>{f.payloads.validation.ledger.engagements.find(r=>r.caseId.startsWith('evaluation-reviewer')).humanSeconds=11;},'USEFUL_SUPERVISION_LIMIT'],
  ['missing declared cohort',f=>f.policy.operatingLimits.cohorts.push('missing'),'COHORT_SAMPLE_LIMIT'],
  ['untested authorized specification',f=>f.policy.allowedSpecSha256.push('f'.repeat(64)),'UNTESTED_JOB_SCOPE'],
  ['undeclared evaluation cohort',f=>{f.payloads.validation.plan.cases.find(c=>c.partition==='evaluation').group='unscoped';f.payloads.validation.ledger.planSha256=digest(f.payloads.validation.plan);},'UNDECLARED_EVALUATION_COHORT'],
  ['failed work hidden by completion volume',f=>{const r=f.payloads.validation.ledger.engagements.find(r=>r.caseId.startsWith('evaluation-agent'));r.status='failed';r.useful=false;f.policy.limits.minimumUsefulJobs=1;f.policy.limits.minimumSettledJobs=1;},'COHORT_USEFUL_LIMIT'],
  ['cohort shared false approvals',f=>{for(const r of f.payloads.validation.ledger.engagements.filter(r=>r.caseId.startsWith('evaluation-reviewer')&&r.verdict==='reject').slice(0,2))r.verdict='approve';f.policy.limits.maximumFalseAcceptanceUpper95=.8;},'COHORT_FALSE_ACCEPTANCE_LIMIT']
 ])it('rejects '+name,()=>{const f=operating();mutate(f);f.resign();const r=qualifyWorkforce(f.policy,f.evidence,{now:f.now});assert.equal(r.eligible,false);assert(r.reasons.some(x=>x.code==='WORKFORCE_'+code),JSON.stringify(r.reasons));});
 it('binds operating thresholds to the signature',()=>{const f=operating();f.policy.operatingLimits.maximumLossRate=1;assert.equal(qualifyWorkforce(f.policy,f.evidence,{now:f.now}).eligible,false);});
 it('rejects unbounded or malformed operating limits',()=>{for(const value of [NaN,Infinity,-1,1.1]){const f=operating();f.policy.operatingLimits.maximumLossRate=value;assert.throws(()=>validatePolicy(f.policy));}});
});
describe('Fleet capacity and whole-project planning',function(){
 it('explains the default slot ceiling without changing settings',()=>{const p=planned(),before=JSON.stringify(p),r=capacityPlan(p);assert.equal(r.freeAgentSlots,3);assert.equal(r.ordinaryReviewedSettlementsPerDayCeiling,3/7);assert.equal(r.authorization,'NONE');assert.equal(JSON.stringify(p),before);});
 it('blocks the one-Node default-quorum setup',()=>{const p=planned();p.reviewers=p.reviewers.slice(0,1);assert(capacityPlan(p).reasons.includes('INSUFFICIENT_INDEPENDENT_REVIEWERS'));});
 it('rejects duplicate reviewer control despite distinct wallets',()=>{const p=planned();p.reviewers[1].controller=p.reviewers[0].controller;assert.throws(()=>capacityPlan(p),/DUPLICATE_REVIEW_CONTROL/);});
 it('reports correlated provider domains without claiming independence',()=>{const p=planned();for(const r of p.reviewers)r.failureDomain='shared';assert.equal(capacityPlan(p).correlationWarning,true);});
 it('accounts for human queue time before execution',()=>{const p=planned();p.human.queuedSeconds=14400;assert(capacityPlan(p).reasons.includes('WORKFLOW_DEADLINE'));});
 it('accounts for occupied Agent slots',()=>{const p=planned();p.agents[0].activeJobs=3;assert(capacityPlan(p).reasons.includes('ACTIVE_JOB_CAP'));});
 const stages=()=>[{id:'work',role:'agent',dependencies:[],workSeconds:60,deadline:1000,complete:false},{id:'review',role:'reviewer',dependencies:['work'],workSeconds:60,deadline:1000,complete:false}];
 it('rejects a job that fits one stage but cannot complete its review',()=>assert.throws(()=>projectWindow(stages(),{now:850,deadline:1000}),/PROJECT_WINDOW/));
 it('reserves both work and dependent review time',()=>assert.equal(projectWindow(stages(),{now:800,deadline:1000}).finish,980));
 it('retains completed stages on restart',()=>{const s=stages();s[0].complete=true;assert.equal(projectWindow(s,{now:900,deadline:1000}).finish,990);});
 it('rejects dependency cycles',()=>{const s=stages();s[0].dependencies=['review'];assert.throws(()=>projectWindow(s,{now:100,deadline:1000}),/CYCLE/);});
 it('does not assume two jobs can share the same role machine concurrently',()=>{const s=stages();s[1].role='agent';s[1].dependencies=[];assert.throws(()=>projectWindow(s,{now:850,deadline:1000}),/PROJECT_WINDOW/);});
});
