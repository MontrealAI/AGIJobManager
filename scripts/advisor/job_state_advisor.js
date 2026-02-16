#!/usr/bin/env node
const fs = require('fs');

function fail(msg){ console.error(msg); process.exit(1); }
function parseArgs(argv){ const out={}; for(let i=2;i<argv.length;i++){ const a=argv[i]; if(!a.startsWith('--')) continue; const k=a.slice(2); const v=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:'true'; out[k]=v;} return out; }

const args=parseArgs(process.argv);
if(!args.input) fail('Usage: node scripts/advisor/job_state_advisor.js --input <state.json>');
const input=JSON.parse(fs.readFileSync(args.input,'utf8'));
const core=input.getJobCore||{};
const v=input.getJobValidation||{};
const now=Number(input.nowTs);
const completionReviewPeriod=Number(input.completionReviewPeriod||0);
const challengePeriodAfterApproval=Number(input.challengePeriodAfterApproval||0);
const disputeReviewPeriod=Number(input.disputeReviewPeriod||0);
const voteQuorum=Number(input.voteQuorum||0);
if(!Number.isFinite(now)) fail('input.nowTs is required');

const approvals=Number(v.validatorApprovals||0);
const disapprovals=Number(v.validatorDisapprovals||0);
const totalVotes=approvals+disapprovals;
const completionRequested=Boolean(v.completionRequested);
const completionRequestedAt=Number(v.completionRequestedAt||0);
const assignedAt=Number(core.assignedAt||0);
const duration=Number(core.duration||0);
const disputed=Boolean(core.disputed);
const completed=Boolean(core.completed);
const expired=Boolean(core.expired);

const assignmentExpiry=assignedAt+duration;
const reviewEnds=completionRequestedAt+completionReviewPeriod;
const disputeStaleAt=Number(v.disputedAt||0)+disputeReviewPeriod;

const lines=[];
lines.push('AGIJobManager Offline Advisor');
lines.push('----------------------------');
if(completed) lines.push('State: COMPLETED (terminal)');
else if(expired) lines.push('State: EXPIRED (terminal)');
else if(disputed) lines.push('State: DISPUTED (moderator/owner path)');
else if(completionRequested) lines.push('State: COMPLETION REQUESTED');
else if(core.assignedAgent && core.assignedAgent !== '0x0000000000000000000000000000000000000000') lines.push('State: ASSIGNED / IN PROGRESS');
else lines.push('State: OPEN / UNASSIGNED');

lines.push('');
lines.push(`Earliest expireJob time: ${assignmentExpiry}`);
if(completionRequested){
  lines.push(`Completion review window ends: ${reviewEnds}`);
  if(approvals>disapprovals && Number(input.validatorApprovedAt||0)>0){
    lines.push(`Earliest finalize after early approval challenge window: ${Number(input.validatorApprovedAt)+challengePeriodAfterApproval}`);
  }
}
if(disputed){ lines.push(`Earliest stale-dispute owner resolution (resolveStaleDispute): ${disputeStaleAt}`); }

const actions=[];
if(!completed && !expired){
  if(core.assignedAgent && core.assignedAgent !== '0x0000000000000000000000000000000000000000' && !completionRequested && now>assignmentExpiry){
    actions.push('expireJob: eligible now');
  }
  if(completionRequested && !disputed){
    if(now<=reviewEnds){
      actions.push('validateJob/disapproveJob: eligible now (if not already voted)');
      actions.push('disputeJob: eligible now (employer or agent)');
    }
    if(now>reviewEnds){
      if(totalVotes===0) actions.push('finalizeJob: should settle agent-win (no-vote path)');
      else if(totalVotes<voteQuorum || approvals===disapprovals) actions.push('finalizeJob: should open dispute');
      else if(approvals>disapprovals) actions.push('finalizeJob: should settle agent-win');
      else actions.push('finalizeJob: should refund employer');
    }
  }
  if(disputed){
    actions.push('resolveDisputeWithCode: eligible for moderators while settlement not paused');
    if(now>disputeStaleAt) actions.push('resolveStaleDispute: eligible for owner');
  }
}
lines.push('');
lines.push('Likely valid actions now:');
if(actions.length===0) lines.push('- No obvious state transitions from supplied snapshot.');
else actions.forEach((a)=>lines.push(`- ${a}`));

console.log(lines.join('\n'));
