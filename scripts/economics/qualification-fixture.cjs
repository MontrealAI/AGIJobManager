'use strict';
// Public synthetic fixture only. This key and these observations have no production authority.
const crypto=require('node:crypto');
const {canonical,digest}=require('./admission.cjs');
const {lifecycle}=require('./lifecycle.cjs');
const {buildCalibration}=require('./calibration.cjs');
const {parseUSDC,formatUSDC}=require('../lib/usdc.js');
const cash=x=>BigInt(parseUSDC(x));
const addr=n=>'0x'+n.toString(16).padStart(40,'0');
function qualificationFixture({role='agent',now=Math.floor(Date.now()/1000),measurementKind='simulated'}={}) {
 const model=JSON.parse(JSON.stringify(require('./lifecycle-example.json')));
 model.schemaVersion=2;model.assumptionSource='Synthetic test fixture; not observed economics.';
 const ids=model.participants.map(x=>x.id),reviewers=model.participants.filter(x=>x.role==='reviewer').map(x=>x.id);
 model.reviewRetainers=Object.fromEntries(reviewers.map(id=>[id,'8']));
 for(const actor of model.participants){actor.minimumExpectedNetUSDC='0';actor.maximumScenarioLossUSDC='2000';}
 for(const row of model.cases){row.weightPpm=row.id==='success'?920000:10000;row.retainerStates=Object.fromEntries(reviewers.map(id=>[id,['noSubmission','cancelled'].includes(row.outcome)?'unfunded':row.outcome==='paymentUnavailable'?'unavailable':'paid']));}
 const assessed=lifecycle(model),records=[];
 for(const partition of ['calibration','evaluation'])for(let i=0;i<100;i++){
  const index=i<92?0:i-91,row=model.cases[index],result=assessed.cases[index],receipts={},deposits=result.capitalCommittedUSDC;
  for(const id of ids){const rawNet=result.netUSDC[id],net=rawNet.startsWith('-')?-cash(rawNet.slice(1)):cash(rawNet);receipts[id]=formatUSDC(net+cash(deposits[id])+cash(row.costsUSDC[id])-(id==='employer'?cash(row.employerValueUSDC):0n));}
  const total=Object.values(deposits).reduce((n,v)=>n+cash(v),0n),paid=Object.values(receipts).reduce((n,v)=>n+cash(v),0n),liabilities=row.outcome==='paymentUnavailable'?total:0n;
  records.push({id:partition+'-'+i,group:partition+'-run',partition,caseId:row.id,costsUSDC:row.costsUSDC,depositsUSDC:deposits,receiptsUSDC:receipts,otherReceiptsUSDC:formatUSDC(total-paid-liabilities),liabilitiesUSDC:formatUSDC(liabilities),employerValueUSDC:row.employerValueUSDC,evidenceSha256:digest('synthetic-'+partition+'-'+i)});
 }
 const dataset={schemaVersion:1,measurementKind,jobClass:'bounded-json',environmentSha256:digest('synthetic-runtime'),measuredAt:now,records};
 const report=buildCalibration(model,dataset),evidenceReport=JSON.stringify(report),reportSha256=crypto.createHash('sha256').update(evidenceReport).digest('hex');
 const privateKey=crypto.createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),crypto.createHash('sha256').update('PUBLIC AGI JOBS TEST FIXTURE KEY').digest()]),format:'der',type:'pkcs8'});
 const participantId=role==='reviewer'?'reviewer1':role,identities=Object.fromEntries(ids.map((id,i)=>[id,{wallet:addr(i+1),controllerId:digest('synthetic-controller-'+id)}]));
 const policy={schemaVersion:4,maxPreparationAttempts:2,epoch:'synthetic-epoch',chainId:31337,manager:addr(10),wallet:identities[participantId].wallet,role,trustedKeys:{fixture:crypto.createPublicKey(privateKey).export({format:'pem',type:'spki'})},classes:['bounded-json'],maxPacketAgeSeconds:600,maxEvidenceAgeSeconds:86400,minimumSamples:100,minimumHorizonDays:180,limits:Object.fromEntries(['employer','agent','reviewer'].map(r=>[r,{minimumExpectedNetUSDC:'0',maximumScenarioLossUSDC:'2000'}])),maxOpenExposureUSDC:'100000',maxEpochCostUSDC:'100000',maxOpenJobs:10,maxGasWeiPerJob:'1000000000000000',calibration:{allowedKinds:[measurementKind],environmentSha256:dataset.environmentSha256,minimumEvaluationSamples:100,maximumProbabilityErrorPpm:10000,minimumCaseWeightPpm:1000,maximumObservedLossRatePpm:100000}};
 const commitment=role==='reviewer'?{action:'vote',decision:'approve',completionURI:'ipfs://delivery',deliverySha256:digest('delivery')}:{action:'apply',decision:null,completionURI:null,deliverySha256:null};
 const payload={schemaVersion:4,policyDigest:digest(policy),jobId:'0',participantId,jobClass:'bounded-json',issuedAt:now,expiresAt:now+600,specURI:'ipfs://spec',specSha256:digest('spec'),evidence:{reportSha256,measuredAt:now,sampleCount:100,qualification:'qualified',costsIncludeFailuresAndOverhead:true},identities,lifecycle:model,gasBudgetWei:'1000000000000000',ethPriceCeilingUSDC:'3000',commitment};
 const envelope={keyId:'fixture',payload,signature:''},observed={chainId:policy.chainId,manager:policy.manager,wallet:policy.wallet,jobId:'0',specURI:payload.specURI,specSha256:payload.specSha256,terms:model.terms,observedAt:now,commitment};
 const result={policy,envelope,observed,portfolio:{openExposureUSDC:'0',epochCostUSDC:'0',openJobs:0},evidenceReport,now,model,dataset,report};
 result.resign=()=>{payload.policyDigest=digest(policy);envelope.signature=crypto.sign(null,Buffer.from(canonical(payload)),privateKey).toString('base64');};result.resign();return result;
}
module.exports={qualificationFixture};
