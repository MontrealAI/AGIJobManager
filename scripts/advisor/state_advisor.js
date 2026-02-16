#!/usr/bin/env node

const fs = require('fs');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const k = arg.slice(2);
      const v = argv[i + 1];
      if (!v || v.startsWith('--')) {
        out[k] = true;
      } else {
        out[k] = v;
        i += 1;
      }
    }
  }
  return out;
}

function toBig(v, fallback = 0n) {
  if (v === undefined || v === null || v === '') return fallback;
  return BigInt(String(v));
}

function bool(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function loadInput(args) {
  if (args.input) return JSON.parse(fs.readFileSync(args.input, 'utf8'));
  if (args.json) return JSON.parse(args.json);
  throw new Error('Provide --input <file.json> or --json <json-string>');
}

function main() {
  const args = parseArgs(process.argv);
  const data = loadInput(args);

  const now = toBig(data.currentTimestamp);
  const core = data.getJobCore || {};
  const val = data.getJobValidation || {};

  const jobId = core.jobId ?? data.jobId ?? '?';
  const disputed = bool(core.disputed);
  const completed = bool(core.completed);
  const cancelled = bool(core.cancelled);
  const expired = bool(core.expired);

  // completionRequested lives in getJobValidation for AGIJobManager.
  const completionRequested = bool(val.completionRequested);

  const assignedAgent =
    core.assignedAgent || core.agent || '0x0000000000000000000000000000000000000000';

  // expireJob uses assignedAt + duration in contract logic.
  const assignedAt = toBig(core.assignedAt);
  const duration = toBig(core.duration);

  const completionRequestedAt = toBig(val.completionRequestedAt);
  const disputedAt = toBig(val.disputedAt);

  const completionReviewPeriod = toBig(val.completionReviewPeriod);
  const disputeReviewPeriod = toBig(val.disputeReviewPeriod);
  const challengeWindow = toBig(val.challengeWindow || val.challengePeriodAfterApproval || 0n);

  const reviewEndsAt = completionRequestedAt > 0n ? completionRequestedAt + completionReviewPeriod : 0n;
  const challengeEndsAt = completionRequestedAt > 0n ? completionRequestedAt + challengeWindow : 0n;
  // stale dispute gate in contract: disputedAt + disputeReviewPeriod
  const staleDisputeAt = disputedAt > 0n ? disputedAt + disputeReviewPeriod : 0n;
  const expireAt = assignedAt > 0n ? assignedAt + duration : 0n;

  let state = 'OPEN';
  if (cancelled) state = 'CANCELLED';
  else if (expired) state = 'EXPIRED';
  else if (completed) state = 'COMPLETED';
  else if (disputed) state = 'DISPUTED';
  else if (completionRequested) state = 'COMPLETION_REQUESTED';
  else if (assignedAgent && assignedAgent !== '0x0000000000000000000000000000000000000000') state = 'IN_PROGRESS';

  const actions = [];
  if (state === 'OPEN') {
    actions.push('applyForJob (eligible agent)');
    actions.push('cancelJob (employer)');
  }
  if (state === 'IN_PROGRESS') {
    actions.push('requestJobCompletion (assigned agent)');
    if (expireAt > 0n && now > expireAt) actions.push('expireJob (allowed by contract policy)');
  }
  if (state === 'COMPLETION_REQUESTED') {
    if (reviewEndsAt > 0n && now <= reviewEndsAt) {
      actions.push('validateJob/disapproveJob (eligible validators)');
      actions.push('disputeJob (employer or assigned agent, within review window)');
    }
    if (reviewEndsAt > 0n && now > reviewEndsAt) {
      actions.push('finalizeJob (may settle or open dispute depending on votes/quorum)');
    }
  }
  if (state === 'DISPUTED') {
    actions.push('resolveDisputeWithCode (moderator)');
    if (staleDisputeAt > 0n && now > staleDisputeAt) actions.push('resolveStaleDispute (owner)');
  }

  console.log(`Job ${jobId} advisory (offline)`);
  console.log(`- Derived state: ${state}`);
  console.log(`- now: ${now}`);

  if (assignedAt > 0n) {
    console.log(`- expireAt (assignedAt + duration): ${expireAt}`);
  } else if (state === 'IN_PROGRESS') {
    console.log('- expireAt: unknown (missing assignedAt from getJobCore input)');
  }

  if (completionRequestedAt > 0n) {
    console.log(`- reviewEndsAt: ${reviewEndsAt}`);
    console.log(`- challengeEndsAt: ${challengeEndsAt}`);
  }

  if (disputedAt > 0n) {
    console.log(`- staleDisputeAt (disputedAt + disputeReviewPeriod): ${staleDisputeAt}`);
  } else if (state === 'DISPUTED') {
    console.log('- staleDisputeAt: unknown (missing disputedAt from getJobValidation input)');
  }

  console.log('- Valid actions now:');
  if (actions.length === 0) console.log('  - none (terminal or missing timing inputs)');
  for (const a of actions) console.log(`  - ${a}`);

  if (state === 'COMPLETION_REQUESTED' && reviewEndsAt > 0n) {
    const earliestFinalize = reviewEndsAt;
    console.log(`- Earliest conservative finalize time: ${earliestFinalize}`);
  }
  if (state === 'IN_PROGRESS' && expireAt > 0n) {
    console.log(`- Earliest expire time: ${expireAt}`);
  }
  if (state === 'DISPUTED' && staleDisputeAt > 0n) {
    console.log(`- Earliest stale-dispute owner resolution time: ${staleDisputeAt}`);
  }
}

main();
