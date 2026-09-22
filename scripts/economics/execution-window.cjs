'use strict';
const {validateComputerWork,digest}=require('./computer-work.cjs');
const ok=(v,c)=>{if(!v)throw Error('EXECUTION_'+c);};
const seconds=(x,lo=0)=>Number.isSafeInteger(x)&&x>=lo&&x<=604800;
function checkExecutionWindow(spec,role,{now=Math.floor(Date.now()/1000),queueSeconds=0,reserveSeconds=30,closeAt=spec.deadline}={}) {
  validateComputerWork(spec);
  ok(['agent','reviewer'].includes(role),'ROLE');
  ok(Number.isSafeInteger(now)&&now>0&&Number.isSafeInteger(closeAt)&&closeAt>0,'CLOCK');
  ok(seconds(queueSeconds)&&seconds(reserveSeconds,1),'WINDOW');
  const workSeconds=spec.budget[role==='agent'?'maxAgentSeconds':'maxReviewSeconds'];
  const deadline=Math.min(spec.deadline,closeAt),availableSeconds=deadline-now;
  ok(availableSeconds>=queueSeconds+workSeconds+reserveSeconds,'INSUFFICIENT_TIME');
  return {specSha256:digest(spec),role,deadline,workSeconds,queueSeconds,reserveSeconds,startBy:deadline-workSeconds-reserveSeconds,authorization:'NONE'};
}
module.exports={checkExecutionWindow};
