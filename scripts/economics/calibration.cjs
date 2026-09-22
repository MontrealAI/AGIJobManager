'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const { shape, text, uint, money, requireThat: ok } = require('./lifecycle.cjs');
const { formatUSDC } = require('../lib/usdc.js');
const canonical = x => x === null || typeof x !== 'object' ? JSON.stringify(x) : Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']' : '{' + Object.keys(x).sort().map(k => JSON.stringify(k)+':'+canonical(x[k])).join(',') + '}';
const digest = x => crypto.createHash('sha256').update(canonical(x)).digest('hex');
const hash = x => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);
const signed = x => { ok(typeof x === 'string' && /^-?(0|[1-9][0-9]{0,100})$/.test(x), 'CALIBRATION_SIGNED_INTEGER'); return BigInt(x); };
function scopeDigest(model) {
  return digest({terms:model.terms,participants:model.participants.map(({id,role})=>({id,role})),reviewRetainers:model.reviewRetainers??null,
    cases:model.cases.map(({weightPpm,rationale,costsUSDC,employerValueUSDC,...rest})=>rest)});
}
function validateCalibrationPolicy(p) {
  shape(p,['allowedKinds','environmentSha256','minimumEvaluationSamples','maximumProbabilityErrorPpm','minimumCaseWeightPpm','maximumObservedLossRatePpm'],'calibration policy');
  ok(Array.isArray(p.allowedKinds)&&p.allowedKinds.length>0&&p.allowedKinds.length<=2&&new Set(p.allowedKinds).size===p.allowedKinds.length&&p.allowedKinds.every(k=>['observed','simulated'].includes(k)), 'CALIBRATION_KIND_POLICY');
  ok(hash(p.environmentSha256),'CALIBRATION_ENVIRONMENT_HASH');
  uint(p.minimumEvaluationSamples,1,1000000000,'evaluation samples');
  uint(p.maximumProbabilityErrorPpm,0,100000,'probability tolerance');
  uint(p.minimumCaseWeightPpm,1,100000,'unseen-case weight');
  uint(p.maximumObservedLossRatePpm,0,1000000,'loss-rate limit');
}
function buildCalibration(model, dataset) {
  shape(dataset,['schemaVersion','measurementKind','jobClass','environmentSha256','measuredAt','records'],'calibration dataset');
  ok(dataset.schemaVersion===1&&['observed','simulated'].includes(dataset.measurementKind),'CALIBRATION_DATA_VERSION');
  text(dataset.jobClass,'job class');ok(hash(dataset.environmentSha256),'CALIBRATION_ENVIRONMENT_HASH');uint(dataset.measuredAt,1,Number.MAX_SAFE_INTEGER,'measurement time');
  ok(Array.isArray(dataset.records)&&dataset.records.length>1&&dataset.records.length<=100000,'CALIBRATION_DATA_SIZE');
  const ids=model.participants.map(x=>x.id),employer=model.participants.find(x=>x.role==='employer')?.id;
  ok(employer&&new Set(ids).size===ids.length,'CALIBRATION_PARTICIPANTS');
  const create=()=>({count:0,maximumCostsUSDC:Object.fromEntries(ids.map(id=>[id,'0'])),minimumEmployerValueUSDC:null,netSumMicro:Object.fromEntries(ids.map(id=>[id,'0'])),losses:Object.fromEntries(ids.map(id=>[id,0]))});
  const cases=Object.fromEntries(model.cases.map(row=>[row.id,{calibration:create(),evaluation:create()}]));
  const groups={calibration:new Set(),evaluation:new Set()},seen=new Set();
  for(const row of dataset.records) {
    shape(row,['id','group','partition','caseId','costsUSDC','depositsUSDC','receiptsUSDC','otherReceiptsUSDC','liabilitiesUSDC','employerValueUSDC','evidenceSha256'],'observation');
    text(row.id,'observation id');text(row.group,'observation group');ok(!seen.has(row.id),'CALIBRATION_DUPLICATE_OBSERVATION');seen.add(row.id);
    ok(['calibration','evaluation'].includes(row.partition)&&Object.hasOwn(cases,row.caseId),'CALIBRATION_CASE_OR_PARTITION');
    ok(hash(row.evidenceSha256),'CALIBRATION_EVIDENCE_HASH');groups[row.partition].add(row.group);
    for(const key of ['costsUSDC','depositsUSDC','receiptsUSDC'])shape(row[key],ids,key);
    const cost={},deposit={},receipt={};let deposits=0n,receipts=0n;
    for(const id of ids){cost[id]=money(row.costsUSDC[id],'observed cost');deposit[id]=money(row.depositsUSDC[id],'observed deposit');receipt[id]=money(row.receiptsUSDC[id],'observed receipt');deposits+=deposit[id];receipts+=receipt[id];}
    ok(deposits===receipts+money(row.otherReceiptsUSDC,'other receipts')+money(row.liabilitiesUSDC,'liabilities'),'CALIBRATION_ACCOUNTING_MISMATCH');
    const value=money(row.employerValueUSDC,'observed employer value'),s=cases[row.caseId][row.partition];s.count++;
    if(s.minimumEmployerValueUSDC===null||value<money(s.minimumEmployerValueUSDC,'value'))s.minimumEmployerValueUSDC=formatUSDC(value);
    for(const id of ids){if(cost[id]>money(s.maximumCostsUSDC[id],'cost'))s.maximumCostsUSDC[id]=formatUSDC(cost[id]);const net=receipt[id]-deposit[id]-cost[id]+(id===employer?value:0n);s.netSumMicro[id]=String(BigInt(s.netSumMicro[id])+net);if(net<0n)s.losses[id]++;}
  }
  ok(groups.calibration.size>0&&groups.evaluation.size>0&&!Array.from(groups.calibration).some(g=>groups.evaluation.has(g)),'CALIBRATION_GROUP_LEAKAGE');
  return {schemaVersion:1,measurementKind:dataset.measurementKind,jobClass:dataset.jobClass,environmentSha256:dataset.environmentSha256,measuredAt:dataset.measuredAt,
    datasetSha256:digest(dataset),economicScopeSha256:scopeDigest(model),groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,Array.from(v).sort()])),cases,
    limitations:'Input provenance and employer-value evidence require an accountable independent issuer. Disjoint groups prevent declared group overlap; they do not prove statistical independence or truthful observations. Empirical validation is not a future-profit guarantee.'};
}
function validateCalibration({model, report, policy, jobClass, now}) {
  validateCalibrationPolicy(policy);
  shape(report,['schemaVersion','measurementKind','jobClass','environmentSha256','measuredAt','datasetSha256','economicScopeSha256','groups','cases','limitations'],'calibration report');
  ok(report.schemaVersion===1&&policy.allowedKinds.includes(report.measurementKind),'CALIBRATION_SOURCE_KIND');
  ok(report.jobClass===jobClass&&report.environmentSha256===policy.environmentSha256&&report.economicScopeSha256===scopeDigest(model)&&hash(report.datasetSha256),'CALIBRATION_SCOPE');
  uint(report.measuredAt,1,now,'calibration time');text(report.limitations,'calibration limitations');
  shape(report.groups,['calibration','evaluation'],'groups');
  for(const groups of Object.values(report.groups)){ok(Array.isArray(groups)&&groups.length>0&&groups.length<=100000&&new Set(groups).size===groups.length,'CALIBRATION_GROUPS');groups.forEach(g=>text(g,'group'));}
  ok(!report.groups.calibration.some(g=>report.groups.evaluation.includes(g)),'CALIBRATION_GROUP_LEAKAGE');
  shape(report.cases,model.cases.map(x=>x.id),'calibration cases');
  const ids=model.participants.map(x=>x.id),totals={calibration:0,evaluation:0},net=Object.fromEntries(ids.map(id=>[id,0n])),losses=Object.fromEntries(ids.map(id=>[id,0]));
  for(const row of model.cases) {
    shape(report.cases[row.id],['calibration','evaluation'],'case statistics');
    for(const partition of Object.keys(totals)) {
      const s=report.cases[row.id][partition];shape(s,['count','maximumCostsUSDC','minimumEmployerValueUSDC','netSumMicro','losses'],'statistics');
      uint(s.count,0,1000000000,'case samples');totals[partition]+=s.count;
      for(const key of ['maximumCostsUSDC','netSumMicro','losses'])shape(s[key],ids,key);
      if(s.count)ok(money(row.employerValueUSDC,'forecast value')<=money(s.minimumEmployerValueUSDC,'observed value'),'CALIBRATION_VALUE_OVERSTATEMENT');
      else ok(s.minimumEmployerValueUSDC===null,'CALIBRATION_EMPTY_CASE');
      for(const id of ids){
        ok(money(row.costsUSDC[id],'forecast cost')>=money(s.maximumCostsUSDC[id],'observed maximum cost'),'CALIBRATION_COST_UNDERSTATEMENT');
        const sum=signed(s.netSumMicro[id]);uint(s.losses[id],0,s.count,'observed losses');
        if(!s.count)ok(sum===0n&&s.losses[id]===0&&money(s.maximumCostsUSDC[id],'empty cost')===0n,'CALIBRATION_EMPTY_CASE');
        if(partition==='evaluation'){net[id]+=sum;losses[id]+=s.losses[id];}
      }
    }
    ok(row.weightPpm>=policy.minimumCaseWeightPpm,'CALIBRATION_ZERO_WEIGHT_STRESS');
  }
  ok(totals.calibration>0&&totals.evaluation>=policy.minimumEvaluationSamples,'CALIBRATION_SAMPLE_FLOOR');
  for(const row of model.cases)for(const partition of Object.keys(totals)){
    const difference=BigInt(row.weightPpm)*BigInt(totals[partition])-1000000n*BigInt(report.cases[row.id][partition].count);
    ok((difference<0n?-difference:difference)<=BigInt(policy.maximumProbabilityErrorPpm)*BigInt(totals[partition]),'CALIBRATION_PROBABILITY_DRIFT');
  }
  for(const actor of model.participants){
    ok(net[actor.id]>=money(actor.minimumExpectedNetUSDC,'minimum net')*BigInt(totals.evaluation),'CALIBRATION_REALIZED_MARGIN');
    ok(BigInt(losses[actor.id])*1000000n<=BigInt(policy.maximumObservedLossRatePpm)*BigInt(totals.evaluation),'CALIBRATION_REALIZED_LOSS_RATE');
  }
  return {measurementKind:report.measurementKind,evaluationSamples:totals.evaluation,calibrationSamples:totals.calibration,datasetSha256:report.datasetSha256};
}
if(require.main===module){try{const [modelFile,dataFile,...extra]=process.argv.slice(2);ok(modelFile&&dataFile&&!extra.length,'Usage: node scripts/economics/calibration.cjs lifecycle.json observations.json');for(const file of [modelFile,dataFile]){const s=fs.lstatSync(file);ok(s.isFile()&&!s.isSymbolicLink()&&s.size<=64*1024*1024,'Use regular JSON files <=64 MiB.');}console.log(JSON.stringify(buildCalibration(JSON.parse(fs.readFileSync(modelFile)),JSON.parse(fs.readFileSync(dataFile))),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={buildCalibration,validateCalibration,validateCalibrationPolicy,scopeDigest};
