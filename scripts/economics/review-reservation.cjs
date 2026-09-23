'use strict';
const fs=require('node:fs');
const need=(ok,code)=>{if(!ok)throw Error('REVIEW_RESERVATION_'+code);};
const integer=(v,min=0)=>Number.isSafeInteger(v)&&v>=min;
const name=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(v);
const exact=(v,fields)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...fields].sort().join('|'),'FIELDS');

function reserveReviews(input){
 exact(input,['schema','measurementKind','now','terms','reviewers','jobs']);
 need(input.schema==='agi-review-reservation/v1'&&['synthetic','observed'].includes(input.measurementKind)&&integer(input.now,1),'HEADER');
 exact(input.terms,['minimumReviewers','challengeSeconds','reserveSeconds','requireDistinctFailureDomains']);
 const {minimumReviewers,challengeSeconds,reserveSeconds,requireDistinctFailureDomains}=input.terms;
 need(integer(minimumReviewers,1)&&integer(challengeSeconds)&&integer(reserveSeconds,1)&&typeof requireDistinctFailureDomains==='boolean','TERMS');
 need(Array.isArray(input.reviewers)&&input.reviewers.length<=10000&&Array.isArray(input.jobs)&&input.jobs.length<=10000,'SIZE');
 const ids=new Set(),controllers=new Set(),credentials=new Set(),bookings=[];
 for(const r of input.reviewers){
  exact(r,['id','controller','credential','failureDomain','availableAt','reservations']);
  need([r.id,r.controller,r.credential,r.failureDomain].every(name)&&integer(r.availableAt)&&Array.isArray(r.reservations)&&r.reservations.length<=10000,'REVIEWER');
  need(!ids.has(r.id)&&!controllers.has(r.controller)&&!credentials.has(r.credential),'INDEPENDENT_CONTROL');
  ids.add(r.id);controllers.add(r.controller);credentials.add(r.credential);
  const intervals=[];
  for(const b of r.reservations){
   exact(b,['jobId','start','finish']);
   need(name(b.jobId)&&integer(b.start,r.availableAt)&&integer(b.finish,b.start+1),'EXISTING_RESERVATION');
   intervals.push({...b});
  }
  intervals.sort((a,b)=>a.start-b.start||a.finish-b.finish);
  need(intervals.every((b,i)=>!i||intervals[i-1].finish<=b.start),'OVERLAP');
  bookings.push({reviewer:r,intervals});
 }
 const jobs=[];
 for(const job of input.jobs){
  exact(job,['id','workReadyAt','deadline','reviewSeconds','requiredReviewers']);
  need(name(job.id)&&!ids.has(job.id)&&integer(job.workReadyAt)&&integer(job.deadline,Math.max(input.now,job.workReadyAt)+1)&&integer(job.reviewSeconds,1)&&integer(job.requiredReviewers,minimumReviewers),'JOB');
  ids.add(job.id);jobs.push(job);
 }
 need(!bookings.some(b=>b.intervals.some(interval=>jobs.some(job=>job.id===interval.jobId))),'EXISTING_JOB_ID');
 jobs.sort((a,b)=>a.deadline-b.deadline||a.id.localeCompare(b.id));
 const outcomes=[];
 for(const job of jobs){
  const required=job.requiredReviewers;
  if(bookings.length<required){outcomes.push({id:job.id,admitted:false,reason:'INSUFFICIENT_REVIEWERS'});continue;}
  const options=bookings.map(b=>{
   let start=Math.max(input.now,job.workReadyAt,b.reviewer.availableAt);
   for(const taken of b.intervals){
    if(taken.finish<=start)continue;
    if(start+job.reviewSeconds<=taken.start)break;
    start=taken.finish;
   }
   return {booking:b,start,finish:start+job.reviewSeconds};
  }).sort((a,b)=>a.finish-b.finish||a.booking.reviewer.id.localeCompare(b.booking.reviewer.id));
  const selected=[],domains=new Set();
  for(const option of options){
   const domain=option.booking.reviewer.failureDomain;
   if(requireDistinctFailureDomains&&domains.has(domain))continue;
   selected.push(option);domains.add(domain);
   if(selected.length===required)break;
  }
  if(selected.length<required){outcomes.push({id:job.id,admitted:false,reason:'CORRELATED_FAILURE_DOMAINS'});continue;}
  const reviewFinish=Math.max(...selected.map(x=>x.finish));
  if(!Number.isSafeInteger(reviewFinish+challengeSeconds+reserveSeconds)||reviewFinish+challengeSeconds+reserveSeconds>job.deadline){
   outcomes.push({id:job.id,admitted:false,reason:'REVIEW_DEADLINE'});continue;
  }
  for(const option of selected){option.booking.intervals.push({jobId:job.id,start:option.start,finish:option.finish});option.booking.intervals.sort((a,b)=>a.start-b.start||a.finish-b.finish);}
  outcomes.push({id:job.id,admitted:true,reason:null,reviewFinish,reviewers:selected.map(x=>({id:x.booking.reviewer.id,start:x.start,finish:x.finish})),correlationWarning:domains.size<required});
 }
 return {schema:'agi-review-reservation-report/v1',measurementKind:input.measurementKind,authorization:'NONE',admitted:outcomes.filter(x=>x.admitted).length,rejected:outcomes.filter(x=>!x.admitted).length,outcomes,limitations:'A deterministic, deadline-ordered planning heuristic. Declared availability and failure domains are not independently verified; no allowance, Agent work, human queue, collateral or chain state is reserved. A plan never authorizes intake and must be refreshed before use.'};
}
if(require.main===module){try{need(process.argv.length===3,'USAGE');const file=process.argv[2],s=fs.lstatSync(file);need(s.isFile()&&!s.isSymbolicLink()&&s.size<=1048576,'FILE');console.log(JSON.stringify(reserveReviews(JSON.parse(fs.readFileSync(file))),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={reserveReviews};
