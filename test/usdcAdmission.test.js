const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { lifecycle } = require('../scripts/economics/lifecycle.cjs');
const { canonical, digest, checkAdmission } = require('../scripts/economics/admission.cjs');
const sample = require('../scripts/economics/lifecycle-example.json');
const clone = x=>JSON.parse(JSON.stringify(x));
const addr = n=>'0x'+n.toString(16).padStart(40,'0');
const now=1800000000;
function fixture() {
 const keys=crypto.generateKeyPairSync('ed25519');
 const policy={schemaVersion:1,epoch:'measured-class-epoch-1',chainId:1,manager:addr(99),wallet:addr(2),role:'agent',trustedKeys:{issuer:keys.publicKey.export({type:'spki',format:'pem'})},classes:['catalog'],maxPacketAgeSeconds:600,maxEvidenceAgeSeconds:86400,minimumSamples:100,minimumHorizonDays:180,limits:{employer:{minimumExpectedNetUSDC:'100',maximumScenarioLossUSDC:'1100'},agent:{minimumExpectedNetUSDC:'100',maximumScenarioLossUSDC:'100'},reviewer:{minimumExpectedNetUSDC:'10',maximumScenarioLossUSDC:'160'}},maxOpenExposureUSDC:'1000',maxEpochCostUSDC:'1000',maxOpenJobs:10,maxGasWeiPerJob:'1000000000000000'};
 const input=clone(sample), identities=Object.fromEntries(input.participants.map((p,i)=>[p.id,{wallet:addr(i+1),controllerId:digest('independent-'+i)}]));
 const payload={schemaVersion:1,policyDigest:digest(policy),jobId:'1',participantId:'agent',jobClass:'catalog',issuedAt:now-10,expiresAt:now+500,specURI:'ipfs://example',specSha256:digest('spec'),evidence:{reportSha256:digest('actual-report'),measuredAt:now-3600,sampleCount:100,qualification:'qualified',costsIncludeFailuresAndOverhead:true},identities,lifecycle:input,gasBudgetWei:'1000000000000000',ethPriceCeilingUSDC:'4000'};
 const envelope={keyId:'issuer',payload,signature:''};
 const resign=()=>{payload.policyDigest=digest(policy);envelope.signature=crypto.sign(null,Buffer.from(canonical(payload)),keys.privateKey).toString('base64');};resign();
 return {policy,envelope,observed:{chainId:1,manager:policy.manager,wallet:policy.wallet,jobId:'1',specURI:payload.specURI,specSha256:payload.specSha256,terms:clone(input.terms),observedAt:now},portfolio:{openExposureUSDC:'0',epochCostUSDC:'0',openJobs:0},now,resign};
}
describe('Lifecycle economics and qualified admission',()=>{
 it('includes full cash-horizon collateral at risk without counting returned principal as earnings',()=>{const r=lifecycle(sample);assert.equal(r.participants.agent.expectedNetUSDC,'466.80000188');assert.equal(r.participants.reviewer1.maximumModeledLossUSDC,'154');assert.equal(r.participants.employer.maximumModeledLossUSDC,'1010');assert.equal(r.participants.agent.conservativeExposureUSDC,'70');assert.equal(r.authorization,'NONE');});
 it('models cancellation costs and non-delivery forfeiture separately',()=>{const r=lifecycle(sample);assert.equal(r.cases.find(x=>x.outcome==='cancelled').netUSDC.agent,'-20');assert.equal(r.cases.find(x=>x.outcome==='noSubmission').netUSDC.agent,'-70');assert.equal(r.cases.find(x=>x.outcome==='noSubmission').netUSDC.employer,'40');});
 it('captures dilution to 50 reviewers',()=>{const r=lifecycle(sample);assert.equal(r.cases.find(x=>x.id==='dilution').netUSDC.reviewer1,'-2.4');});
 it('requires absent, adverse, zero-review, dilution and unavailable-payment stresses even at zero weight',()=>{for(const id of ['dilution','no-review','unpaid','buyer-win']) {const x=clone(sample),row=x.cases.find(c=>c.id===id);const w=row.weightPpm;x.cases=x.cases.filter(c=>c!==row);x.cases[0].weightPpm+=w;assert.throws(()=>lifecycle(x));}});
 it('supports valid Ed25519 attestations but returns no transaction authority',()=>{const x=fixture(),r=checkAdmission(x);assert.equal(r.decision,'QUALIFIED_UNDER_ATTESTED_INPUTS');assert.equal(r.reserveExposureUSDC,'70');assert.match(r.authorization,/^NONE/);});
 it('rejects tampered, wrong-key, unsigned and malformed signatures',()=>{for(const change of [x=>x.envelope.payload.lifecycle.terms.jobCostUSDC='2',x=>x.envelope.keyId='other',x=>x.envelope.signature='',x=>x.envelope.signature='A'.repeat(86)+'==']){const x=fixture();change(x);assert.throws(()=>checkAdmission(x));}});
 it('rejects expired, future, overlong and stale attestations',()=>{for(const change of [p=>p.expiresAt=now,p=>p.issuedAt=now+1,p=>p.expiresAt=now+601,p=>p.issuedAt=now-601,p=>p.evidence.measuredAt=now-86401]){const x=fixture();change(x.envelope.payload);x.resign();assert.throws(()=>checkAdmission(x));}});
 it('requires measured class qualification, sample floor, horizon and cost inclusion',()=>{for(const change of [p=>p.jobClass='unqualified',p=>p.evidence.sampleCount=99,p=>p.evidence.qualification='hypothetical',p=>p.evidence.costsIncludeFailuresAndOverhead=false,p=>p.lifecycle.horizonDays=179]){const x=fixture();change(x.envelope.payload);x.resign();assert.throws(()=>checkAdmission(x));}});
 it('binds chain, job, wallet, manager, exact spec and live terms',()=>{for(const change of [o=>o.chainId=2,o=>o.jobId='2',o=>o.wallet=addr(8),o=>o.manager=addr(8),o=>o.specURI+='other',o=>o.specSha256=digest('other'),o=>o.terms.slashBps=9000,o=>o.observedAt=now-121]){const x=fixture();change(x.observed);assert.throws(()=>checkAdmission(x));}});
 it('uses operator limits even when the packet claims more permissive limits',()=>{const x=fixture();x.policy.limits.reviewer.minimumExpectedNetUSDC='18';for(const a of x.envelope.payload.lifecycle.participants)a.minimumExpectedNetUSDC='0';x.resign();assert.throws(()=>checkAdmission(x),/ECONOMIC_LIMITS/);});
 it('rejects common wallets or declared controllers and role impersonation',()=>{for(const change of [p=>p.identities.reviewer1.wallet=p.identities.agent.wallet,p=>p.identities.reviewer1.controllerId=p.identities.agent.controllerId,p=>p.participantId='reviewer1']){const x=fixture();change(x.envelope.payload);x.resign();assert.throws(()=>checkAdmission(x));}});
 it('enforces aggregate capital/cost, epoch spending and job count separately',()=>{for(const change of [p=>p.openExposureUSDC='931',p=>p.epochCostUSDC='981',p=>p.openJobs=10]){const x=fixture();change(x.portfolio);assert.throws(()=>checkAdmission(x));}const x=fixture();x.portfolio.openExposureUSDC='930';x.portfolio.epochCostUSDC='980';assert.equal(checkAdmission(x).reserveCostUSDC,'20');});
 it('requires positive native budget, cap and conservatively priced gas in every case',()=>{for(const change of [p=>p.gasBudgetWei='0',p=>p.gasBudgetWei='1000000000000001',p=>p.ethPriceCeilingUSDC='0',p=>p.ethPriceCeilingUSDC='20001']){const x=fixture();change(x.envelope.payload);x.resign();assert.throws(()=>checkAdmission(x));}});
 it('rejects unknown fields, unsafe integer dates, and non-Ed25519 issuers',()=>{for(const change of [x=>x.policy.extra=true,x=>x.envelope.payload.extra=true,x=>x.envelope.payload.expiresAt=Number.MAX_SAFE_INTEGER+1,x=>x.policy.maxOpenJobs=1.1]){const x=fixture();change(x);x.resign();assert.throws(()=>checkAdmission(x));}});
 it('does not mutate a callers packet and compares canonical key order consistently',()=>{const x=fixture(),before=canonical(x.envelope);checkAdmission(x);assert.equal(canonical(x.envelope),before);assert.equal(digest({a:1,b:2}),digest({b:2,a:1}));});
});

function v2(role='agent') {
 const x=fixture(),p=x.envelope.payload;x.policy.schemaVersion=2;x.policy.maxPreparationAttempts=4;p.schemaVersion=2;
 p.commitment=role==='agent'?{action:'apply',decision:null,completionURI:null,deliverySha256:null}:{action:'vote',decision:'approve',completionURI:'ipfs://delivery',deliverySha256:digest('delivery')};
 if(role==='reviewer'){x.policy.role=role;x.policy.wallet=addr(3);p.participantId='reviewer1';x.observed.wallet=addr(3);}
 x.observed.commitment=clone(p.commitment);x.resign();return x;
}
describe('Action-bound admission v2',()=>{
 it('accepts canonical job zero and rejects overflowing uint256 IDs',()=>{const x=v2();x.envelope.payload.jobId='0';x.observed.jobId='0';x.resign();assert.equal(checkAdmission(x).jobId,'0');x.envelope.payload.jobId=(2n**256n).toString();x.resign();assert.throws(()=>checkAdmission(x),/JOB_ID/);});
 it('binds an agent application while preserving legacy offline verification',()=>{assert.equal(checkAdmission(fixture()).schemaVersion,1);const r=checkAdmission(v2());assert.equal(r.schemaVersion,2);assert.equal(r.maxPreparationAttempts,4);assert.equal(r.commitment.action,'apply');});
 it('qualifies a reviewer for the exact delivered bytes and fixed approving ballot',()=>{const r=checkAdmission(v2('reviewer'));assert.equal(r.commitment.decision,'approve');assert.equal(r.reserveExposureUSDC,'154');});
 it('rejects changing the intended vote after qualification',()=>{const x=v2('reviewer');x.observed.commitment.decision='reject';assert.throws(()=>checkAdmission(x),/COMMITMENT_CHANGED/);});
 it('rejects changing completion URI or delivered bytes',()=>{for(const key of ['completionURI','deliverySha256']){const x=v2('reviewer');x.observed.commitment[key]+='changed';assert.throws(()=>checkAdmission(x),/COMMITMENT_CHANGED/);}});
 it('rejects outcome-dependent reviewer ballots even in zero-weight cases',()=>{for(const id of ['success','dilution']){const x=v2('reviewer');x.envelope.payload.lifecycle.cases.find(c=>c.id===id).ballots.reviewer1='reject';x.resign();assert.throws(()=>checkAdmission(x),/FIXED_REVIEWER_BALLOT/);}});
 it('rejects schema downgrade and missing commitments',()=>{for(const mutate of [x=>x.envelope.payload.schemaVersion=1,x=>delete x.envelope.payload.commitment,x=>delete x.observed.commitment]){const x=v2();mutate(x);x.resign();assert.throws(()=>checkAdmission(x));}});
 it('rejects votes or delivery data in an agent application packet',()=>{for(const mutate of [c=>c.action='vote',c=>c.decision='approve',c=>c.deliverySha256=digest('bytes')]){const x=v2();mutate(x.envelope.payload.commitment);x.resign();assert.throws(()=>checkAdmission(x),/AGENT_COMMITMENT/);}});
 it('requires bounded integer preparation attempts',()=>{for(const n of [0,101,1.5,'4',null]){const x=v2();x.policy.maxPreparationAttempts=n;x.resign();assert.throws(()=>checkAdmission(x));}});
 it('does not let a caller mutate the authorized commitment through the result',()=>{const x=v2('reviewer'),r=checkAdmission(x);r.commitment.decision='reject';assert.equal(x.envelope.payload.commitment.decision,'approve');});
});
