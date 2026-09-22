'use strict';
const fs=require('node:fs');
const {digest}=require('./computer-work.cjs');
const ok=(v,c)=>{if(!v)throw Error('CAPABILITY_'+c);};
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const cash=x=>{ok(typeof x==='string'&&/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/.test(x),'CASH');const [a,b='']=x.split('.');return BigInt(a)*1000000n+BigInt(b.padEnd(6,'0'));};
const fmt=n=>(n<0n?'-':'')+String((n<0n?-n:n)/1000000n)+'.'+String((n<0n?-n:n)%1000000n).padStart(6,'0');
function interval(success,n){if(!n)return null;const z=1.959963984540054,p=success/n,d=1+z*z/n,m=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return {lower:Math.max(0,m-h),upper:Math.min(1,m+h)};}
function capabilityReport(plan,ledger) {
 ok(plan?.schemaVersion===1&&Array.isArray(plan.cases)&&plan.cases.length>0&&plan.cases.length<=100000,'PLAN');
 ok(ledger?.schemaVersion===1&&['observed','synthetic'].includes(ledger.measurementKind)&&ledger.planSha256===digest(plan),'PLAN_BINDING');
 ok(Array.isArray(ledger.engagements)&&ledger.engagements.length===plan.cases.length,'INCOMPLETE_ENGAGEMENTS');
 const expected=new Map(),groups={calibration:new Set(),evaluation:new Set()};
 for(const c of plan.cases){ok(typeof c.id==='string'&&c.id.length<=100&&!expected.has(c.id)&&['calibration','evaluation'].includes(c.partition)&&typeof c.group==='string'&&c.group.length>0&&['agent','reviewer'].includes(c.role)&&typeof c.expectedValid==='boolean'&&hash(c.specSha256)&&hash(c.runtimeSha256),'CASE');expected.set(c.id,c);groups[c.partition].add(c.group);}
 ok(groups.calibration.size>0&&groups.evaluation.size>0&&!Array.from(groups.calibration).some(g=>groups.evaluation.has(g)),'GROUP_LEAKAGE');
 const totals={};const seen=new Set();
 for(const r of ledger.engagements){
  const c=expected.get(r.caseId);ok(c&&!seen.has(r.caseId),'UNEXPECTED_OR_DUPLICATE');seen.add(r.caseId);
  ok(r.specSha256===c.specSha256&&r.runtimeSha256===c.runtimeSha256&&hash(r.evidenceSha256),'EVIDENCE_BINDING');
  ok(['complete','failed','timeout','declined','unavailable'].includes(r.status)&&['approve','reject','abstain',null].includes(r.verdict)&&typeof r.outcomeVerified==='boolean'&&typeof r.useful==='boolean','RESULT');
  ok(Number.isSafeInteger(r.elapsedMs)&&r.elapsedMs>=0&&Number.isSafeInteger(r.humanSeconds)&&r.humanSeconds>=0&&Number.isSafeInteger(r.toolCalls)&&r.toolCalls>=0,'MEASUREMENT');
  if(ledger.measurementKind==='observed')ok(r.observationSource==='runtime-and-independent-oracle'&&r.outcomeVerified&&hash(r.traceSha256),'OBSERVED_EVIDENCE_REQUIRED');
  if(c.role==='reviewer')ok(r.verdict!==null,'VERDICT_REQUIRED');
  const key=c.partition+':'+c.role,s=totals[key]??={engagements:0,completed:0,useful:0,correct:0,invalidDeliveries:0,falseAccepts:0,validDeliveries:0,falseRejects:0,abstentions:0,losses:0,unreconciledCosts:0,elapsedMs:0,humanSeconds:0,toolCalls:0,cost:0n,receipts:0n,net:0n};
  s.engagements++;s.completed+=r.status==='complete';s.useful+=r.useful&&r.outcomeVerified&&r.status==='complete';s.elapsedMs+=r.elapsedMs;s.humanSeconds+=r.humanSeconds;s.toolCalls+=r.toolCalls;
  if(c.role==='reviewer'){s.invalidDeliveries+=!c.expectedValid;s.validDeliveries+=c.expectedValid;s.falseAccepts+=!c.expectedValid&&r.verdict==='approve';s.falseRejects+=c.expectedValid&&r.verdict==='reject';s.abstentions+=r.verdict==='abstain';}
  s.correct+=r.status==='complete'&&r.outcomeVerified&&(c.role==='agent'?r.useful:r.verdict===(c.expectedValid?'approve':'reject'));
  const receipt=cash(r.receiptsUSDC),deposit=cash(r.depositsUSDC),value=cash(r.realizedValueUSDC);s.receipts+=receipt;
  if(r.costUSDC===null){s.unreconciledCosts++;continue;}
  const cost=cash(r.costUSDC),net=receipt-deposit-cost+value;s.cost+=cost;s.net+=net;s.losses+=net<0n;
 }
 for(const s of Object.values(totals)){
  s.successRate=s.correct/s.engagements;s.successInterval95=interval(s.correct,s.engagements);
  s.falseAcceptanceRate=s.invalidDeliveries?s.falseAccepts/s.invalidDeliveries:null;s.falseAcceptanceInterval95=interval(s.falseAccepts,s.invalidDeliveries);
  s.falseRejectionRate=s.validDeliveries?s.falseRejects/s.validDeliveries:null;
  s.lossRate=s.unreconciledCosts?null:s.losses/s.engagements;
  s.measuredCostUSDC=fmt(s.cost);s.receiptsUSDC=fmt(s.receipts);s.netUSDC=s.unreconciledCosts?null:fmt(s.net);delete s.cost;delete s.receipts;delete s.net;
 }
 return {schemaVersion:1,measurementKind:ledger.measurementKind,planSha256:digest(plan),ledgerSha256:digest(ledger),engagements:seen.size,totals,qualification:'NONE',limitations:'All declared engagements, including failures and abstentions, are included. Wilson intervals describe empirical Bernoulli proportions under independence assumptions; they do not account for correlated errors, benchmark selection or dishonest observations. Missing bills leave net and loss rate unknown. A runtime label or hash is provenance, not proof of outcome or independence.'};
}
if(require.main===module){try{ok(process.argv.length===4,'USAGE: capability-report.cjs plan.json ledger.json');const read=f=>{const s=fs.lstatSync(f);ok(s.isFile()&&!s.isSymbolicLink()&&s.size<=64*1024*1024,'FILE');return JSON.parse(fs.readFileSync(f));};console.log(JSON.stringify(capabilityReport(read(process.argv[2]),read(process.argv[3])),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={capabilityReport,interval};
