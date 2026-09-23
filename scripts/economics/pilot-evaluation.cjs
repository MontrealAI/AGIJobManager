'use strict';
const fs=require('node:fs');
const need=(ok,code)=>{if(!ok)throw Error('PILOT_EVALUATION_'+code);};
const whole=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const fraction=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1;
const exact=(v,fields)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...fields].sort().join('|'),'FIELDS');
const upper95=(successes,total)=>{if(!total)return null;const z=1.959963984540054,p=successes/total,z2=z*z;return (p+z2/(2*total)+z*Math.sqrt(p*(1-p)/total+z2/(4*total*total)))/(1+z2/total);};
function evaluatePilot(p){
 exact(p,['schema','measurementKind','cohort','counts','thresholds']);
 need(p.schema==='agi-pilot-evaluation/v1'&&['synthetic','observed'].includes(p.measurementKind)&&typeof p.cohort==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(p.cohort),'HEADER');
 exact(p.counts,['offered','admitted','useful','humanSeconds','agentEngagements','agentLosses','reviewerEngagements','reviewerLosses','incorrectPaid','settlementsAudited','settlementRuleDefects','independentlyScoredReviews','reviewJudgmentErrors']);
 need(Object.values(p.counts).every(x=>whole(x)),'COUNT');
 const c=p.counts;
 need(c.admitted<=c.offered&&c.useful<=c.admitted&&c.agentLosses<=c.agentEngagements&&c.reviewerLosses<=c.reviewerEngagements&&c.incorrectPaid<=c.admitted&&c.settlementsAudited<=c.admitted&&c.settlementRuleDefects<=c.settlementsAudited&&c.independentlyScoredReviews<=c.reviewerEngagements&&c.reviewJudgmentErrors<=c.independentlyScoredReviews,'COUNT_RELATION');
 exact(p.thresholds,['minimumUsefulRateExclusive','maximumHumanMinutesExclusive','maximumAgentLossRate','maximumReviewerLossRate','maximumJudgmentErrorUpper95','minimumAuditedSettlements','minimumScoredReviews']);
 need(fraction(p.thresholds.minimumUsefulRateExclusive)&&fraction(p.thresholds.maximumAgentLossRate)&&fraction(p.thresholds.maximumReviewerLossRate)&&fraction(p.thresholds.maximumJudgmentErrorUpper95)&&Number.isFinite(p.thresholds.maximumHumanMinutesExclusive)&&p.thresholds.maximumHumanMinutesExclusive>0&&whole(p.thresholds.minimumAuditedSettlements,1)&&whole(p.thresholds.minimumScoredReviews,1),'THRESHOLDS');
 const rate=(numerator,denominator)=>denominator?numerator/denominator:null;
 const metrics={usefulPerAdmitted:rate(c.useful,c.admitted),humanMinutesPerUseful:rate(c.humanSeconds,60*c.useful),agentLossRate:rate(c.agentLosses,c.agentEngagements),reviewerLossRate:rate(c.reviewerLosses,c.reviewerEngagements),judgmentErrorRate:rate(c.reviewJudgmentErrors,c.independentlyScoredReviews),judgmentErrorUpper95:upper95(c.reviewJudgmentErrors,c.independentlyScoredReviews),incorrectPaid:c.incorrectPaid,settlementRuleDefects:c.settlementRuleDefects};
 const checks={usefulRate:metrics.usefulPerAdmitted!==null&&metrics.usefulPerAdmitted>p.thresholds.minimumUsefulRateExclusive,humanTime:metrics.humanMinutesPerUseful!==null&&metrics.humanMinutesPerUseful<p.thresholds.maximumHumanMinutesExclusive,agentLosses:metrics.agentLossRate!==null&&metrics.agentLossRate<=p.thresholds.maximumAgentLossRate,reviewerLosses:metrics.reviewerLossRate!==null&&metrics.reviewerLossRate<=p.thresholds.maximumReviewerLossRate,settlementRules:c.settlementsAudited>=p.thresholds.minimumAuditedSettlements&&c.settlementRuleDefects===0,judgmentQuality:c.independentlyScoredReviews>=p.thresholds.minimumScoredReviews&&metrics.judgmentErrorUpper95<=p.thresholds.maximumJudgmentErrorUpper95};
 return {schema:'agi-pilot-evaluation-report/v1',measurementKind:p.measurementKind,cohort:p.cohort,authorization:'NONE',metrics,checks,allTargetsMet:Object.values(checks).every(Boolean),missingEvidence:[...(c.settlementsAudited?'': ['SETTLEMENT_AUDIT']),...(c.independentlyScoredReviews?'':['INDEPENDENT_REVIEW_GROUND_TRUTH'])],limitations:'Declared aggregate counts are not independently authenticated. The Wilson upper bound describes sampling variation under independent Bernoulli trials, not shared errors or uncertain ground truth. Zero recorded defects means zero among audited cases only. Synthetic results do not qualify real computers, customer outcomes, capacity, independent review or production economics. This report never authorizes admission.'};
}
if(require.main===module){try{need(process.argv.length===3,'USAGE');const file=process.argv[2],s=fs.lstatSync(file);need(s.isFile()&&!s.isSymbolicLink()&&s.size<=1048576,'FILE');console.log(JSON.stringify(evaluatePilot(JSON.parse(fs.readFileSync(file))),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={evaluatePilot};
