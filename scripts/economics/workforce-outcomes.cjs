'use strict';
const {interval}=require('./capability-report.cjs');
const need=(v,c)=>{if(!v)throw Error('WORKFORCE_'+c);};
const exact=(x,ks)=>need(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===[...ks].sort().join('|'),'OPERATING_FIELDS');
const fraction=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
const cash=x=>{need(typeof x==='string'&&/^-?(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/.test(x),'OPERATING_CASH');const negative=x[0]==='-', [a,b='']=(negative?x.slice(1):x).split('.');return (negative?-1n:1n)*(BigInt(a)*1000000n+BigInt(b.padEnd(6,'0')));};
const cashText=x=>`${x<0n?'-':''}${(x<0n?-x:x)/1000000n}.${((x<0n?-x:x)%1000000n).toString().padStart(6,'0')}`;
function validateOperatingLimits(l){
 exact(l,['minimumNetUSDCByRole','maximumHumanSecondsPerUsefulJob','minimumUsefulRateLower95','minimumCorrectReviewRateLower95','minimumCasesPerCohort','maximumCohortFalseAcceptanceRate','maximumLossRate','cohorts']);
 exact(l.minimumNetUSDCByRole,['agent','reviewer']);
 need(Object.values(l.minimumNetUSDCByRole).every(x=>cash(x)>=0n),'OPERATING_NET_FLOOR');
 need(Number.isSafeInteger(l.maximumHumanSecondsPerUsefulJob)&&l.maximumHumanSecondsPerUsefulJob>=0,'OPERATING_SUPERVISION');
 need(['minimumUsefulRateLower95','minimumCorrectReviewRateLower95','maximumCohortFalseAcceptanceRate','maximumLossRate'].every(k=>fraction(l[k]))&&l.minimumUsefulRateLower95>0&&l.minimumCorrectReviewRateLower95>0,'OPERATING_RATE');
 need(Number.isSafeInteger(l.minimumCasesPerCohort)&&l.minimumCasesPerCohort>=2&&l.minimumCasesPerCohort<=100000,'OPERATING_SAMPLE');
 need(Array.isArray(l.cohorts)&&l.cohorts.length>0&&l.cohorts.length<=1024&&l.cohorts.every(x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(x))&&new Set(l.cohorts).size===l.cohorts.length,'OPERATING_COHORTS');
 return l;
}
function checkOperatingOutcomes(l,plan,ledger,report){
 validateOperatingLimits(l);
 const cases=new Map(plan.cases.map(c=>[c.id,c]));
 const groups=new Map(l.cohorts.map(g=>[g,{agent:[],reviewer:[]}]));
 for(const row of ledger.engagements){const c=cases.get(row.caseId);if(c.partition!=='evaluation')continue;need(groups.has(c.group),'UNDECLARED_EVALUATION_COHORT');groups.get(c.group)[c.role].push({c,row});}
 const net=rows=>rows.reduce((n,{row:r})=>n+cash(r.receiptsUSDC)-cash(r.depositsUSDC)-cash(r.costUSDC),0n);
 for(const role of ['agent','reviewer']){
  const rows=ledger.engagements.filter(r=>cases.get(r.caseId).role===role).map(row=>({row}));
  need(net(rows)>=cash(l.minimumNetUSDCByRole[role]),'ROLE_ECONOMICS_LIMIT');
  need(rows.filter(x=>net([x])<0n).length/rows.length<=l.maximumLossRate,'ROLE_LOSS_LIMIT');
 }
 const a=report.totals['evaluation:agent'],n=report.totals['evaluation:reviewer'];
 need(a.useful>0&&(a.humanSeconds+n.humanSeconds)/a.useful<=l.maximumHumanSecondsPerUsefulJob,'USEFUL_SUPERVISION_LIMIT');
 const result=[];
 for(const [group,rows] of groups){
  const agents=rows.agent,reviewers=rows.reviewer,invalid=reviewers.filter(x=>!x.c.expectedValid),valid=reviewers.filter(x=>x.c.expectedValid);
  need(agents.length>=l.minimumCasesPerCohort&&invalid.length>=l.minimumCasesPerCohort&&valid.length>=l.minimumCasesPerCohort,'COHORT_SAMPLE_LIMIT');
  const useful=agents.filter(x=>x.row.status==='complete'&&x.row.useful&&x.row.outcomeVerified).length;
  const correct=reviewers.filter(x=>x.row.status==='complete'&&x.row.outcomeVerified&&x.row.verdict===(x.c.expectedValid?'approve':'reject')).length;
  const falseAccepts=invalid.filter(x=>x.row.verdict==='approve').length;
  need(interval(useful,agents.length).lower>=l.minimumUsefulRateLower95,'COHORT_USEFUL_LIMIT');
  need(interval(correct,reviewers.length).lower>=l.minimumCorrectReviewRateLower95,'COHORT_REVIEW_LIMIT');
  need(falseAccepts/invalid.length<=l.maximumCohortFalseAcceptanceRate,'COHORT_FALSE_ACCEPTANCE_LIMIT');
  const economics={};
  for(const role of ['agent','reviewer']){
   const total=net(rows[role]),losses=rows[role].filter(x=>net([x])<0n).length;
   need(total>=cash(l.minimumNetUSDCByRole[role]),'COHORT_ECONOMICS_LIMIT');
   need(losses/rows[role].length<=l.maximumLossRate,'COHORT_LOSS_LIMIT');
   economics[role]={netUSDC:cashText(total),lossEngagements:losses,engagements:rows[role].length,lossRate:losses/rows[role].length};
  }
  const humanSeconds=[...agents,...reviewers].reduce((n,x)=>n+x.row.humanSeconds,0);
  need(useful>0&&humanSeconds/useful<=l.maximumHumanSecondsPerUsefulJob,'COHORT_SUPERVISION_LIMIT');
  result.push({group,agentEngagements:agents.length,reviewEngagements:reviewers.length,useful,correct,falseAccepts,invalid:invalid.length,economics,humanSecondsPerUsefulJob:humanSeconds/useful});
 }
 return {cohorts:result,humanSecondsPerUsefulJob:(a.humanSeconds+n.humanSeconds)/a.useful,limitations:'Declared held-out cohorts constrain pooled masking. Cohort names, signatures and Wilson bounds do not establish independence or account for all correlated errors.'};
}
module.exports={validateOperatingLimits,checkOperatingOutcomes};
