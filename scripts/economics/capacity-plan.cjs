'use strict';
const fs=require('node:fs');
const need=(v,c)=>{if(!v)throw Error('CAPACITY_'+c);};
const int=(x,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(x);
const exact=(x,ks)=>need(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===[...ks].sort().join('|'),'FIELDS');
function projectWindow(stages,{now,deadline,maxConcurrent=2}={}){
 need(int(now,1)&&int(deadline,now+1)&&int(maxConcurrent,1,2),'CLOCK');
 need(Array.isArray(stages)&&stages.length>0&&stages.length<=64,'STAGES');
 const by=new Map();
 for(const s of stages){exact(s,['id','role','dependencies','workSeconds','deadline','complete']);need(id(s.id)&&!by.has(s.id)&&['agent','reviewer'].includes(s.role)&&Array.isArray(s.dependencies)&&new Set(s.dependencies).size===s.dependencies.length&&int(s.workSeconds,1,604800)&&int(s.deadline,1)&&typeof s.complete==='boolean','STAGE');by.set(s.id,s);}
 for(const s of stages)need(s.dependencies.every(d=>by.has(d)&&d!==s.id),'DEPENDENCY');
 const ends=new Map(),slots={agent:now,reviewer:now},schedule=[];let serial=now;
 while(ends.size<by.size){
  const ready=stages.filter(s=>!ends.has(s.id)&&s.dependencies.every(d=>ends.has(d)));
  need(ready.length>0,'CYCLE');
  const start=s=>Math.max(now,...s.dependencies.map(d=>ends.get(d)),slots[s.role],maxConcurrent===1?serial:now);
  ready.sort((a,b)=>start(a)-start(b)||a.deadline-b.deadline||a.id.localeCompare(b.id));
  const s=ready[0],begin=s.complete?now:start(s),end=s.complete?now:begin+s.workSeconds+30;
  need(s.complete||end<=Math.min(deadline,s.deadline),'PROJECT_WINDOW');
  ends.set(s.id,end);if(!s.complete){slots[s.role]=end;serial=end;}
  schedule.push({id:s.id,start:begin,finish:end,complete:s.complete});
 }
 return {authorization:'NONE',finish:Math.max(...ends.values()),schedule,assumption:'One worker per role; full declared work plus 30 seconds per unfinished stage. No repair or external handoff time is inferred.'};
}
function capacityPlan(p){
 exact(p,['schema','measurementKind','terms','agents','reviewers','human','job']);
 need(p.schema==='agi-capacity-plan/v1'&&['synthetic','observed'].includes(p.measurementKind),'SCHEMA');
 exact(p.terms,['maxActiveJobsPerAgent','requiredApprovals','requiredDisapprovals','voteQuorum','reviewSeconds','challengeSeconds']);
 need(Object.values(p.terms).every(x=>int(x,1,2592000)),'TERMS');
 need(Array.isArray(p.agents)&&p.agents.length>0&&p.agents.length<=10000&&Array.isArray(p.reviewers)&&p.reviewers.length<=10000,'ACTORS');
 const identities=new Set();let free=0;
 for(const a of p.agents){exact(a,['id','activeJobs']);need(id(a.id)&&!identities.has(a.id)&&int(a.activeJobs),'AGENT');identities.add(a.id);free+=Math.max(0,p.terms.maxActiveJobsPerAgent-a.activeJobs);}
 const controllers=new Set(),credentials=new Set();
 for(const r of p.reviewers){exact(r,['id','controller','credential','failureDomain']);need([r.id,r.controller,r.credential,r.failureDomain].every(id)&&!identities.has(r.id),'REVIEWER');identities.add(r.id);need(!controllers.has(r.controller)&&!credentials.has(r.credential),'DUPLICATE_REVIEW_CONTROL');controllers.add(r.controller);credentials.add(r.credential);}
 exact(p.human,['availableSecondsPerDay','queuedSeconds']);need(int(p.human.availableSecondsPerDay,1,86400)&&int(p.human.queuedSeconds,0,31536000),'HUMAN');
 exact(p.job,['remainingSeconds','agentSeconds','reviewSeconds','humanSeconds','queueSeconds','reserveSeconds']);need(Object.values(p.job).every(x=>int(x,0,31536000))&&p.job.agentSeconds>0&&p.job.reviewSeconds>0&&p.job.reserveSeconds>0,'JOB');
 const required=Math.max(p.terms.requiredApprovals,p.terms.requiredDisapprovals,p.terms.voteQuorum),reasons=[];
 if(p.reviewers.length<required)reasons.push('INSUFFICIENT_INDEPENDENT_REVIEWERS');
 if(!free)reasons.push('ACTIVE_JOB_CAP');
 const humanSeconds=p.human.queuedSeconds+p.job.humanSeconds;
 const humanWaitUpper=humanSeconds?Math.ceil(humanSeconds/p.human.availableSecondsPerDay)*86400:0;
 const requiredSeconds=humanWaitUpper+p.job.queueSeconds+p.job.agentSeconds+p.job.reviewSeconds+p.job.reserveSeconds;
 if(requiredSeconds>p.job.remainingSeconds)reasons.push('WORKFLOW_DEADLINE');
 const domains=new Set(p.reviewers.map(r=>r.failureDomain));
 return {schema:'agi-capacity-report/v1',measurementKind:p.measurementKind,authorization:'NONE',feasibleUnderDeclaredInputs:reasons.length===0,reasons,requiredReviewers:required,availableReviewers:p.reviewers.length,freeAgentSlots:free,humanWaitUpperSeconds:humanWaitUpper,requiredSeconds,distinctDeclaredFailureDomains:domains.size,correlationWarning:domains.size<required,ordinaryReviewedSettlementsPerDayCeiling:p.agents.length*p.terms.maxActiveJobsPerAgent*86400/Math.max(p.terms.reviewSeconds,p.terms.challengeSeconds),limitations:'Planning only. Inputs do not prove current chain state, control independence, available capacity or model quality. The slot ceiling excludes early buyer acceptance, adverse exits and all additional delays. Human wait assumes daily capacity repeats, conservatively including a full shift wait; work durations are declared bounds. This tool never changes protocol settings or authorizes spending.'};
}
if(require.main===module){try{need(process.argv.length===3,'USAGE: capacity-plan.cjs plan.json');const file=process.argv[2],s=fs.lstatSync(file);need(s.isFile()&&!s.isSymbolicLink()&&s.size<=1048576,'FILE');console.log(JSON.stringify(capacityPlan(JSON.parse(fs.readFileSync(file))),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={capacityPlan,projectWindow};
