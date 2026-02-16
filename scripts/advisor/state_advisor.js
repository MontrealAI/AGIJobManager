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
  const completionRequested = bool(val.completionRequested ?? core.completionRequested);
  const disputed = bool(core.disputed ?? val.disputed);
  const completed = bool(core.completed);
  const expired = bool(core.expired);

  const employer = core.employer || '0x0000000000000000000000000000000000000000';
  const assignedAgent = core.assignedAgent || core.agent || '0x0000000000000000000000000000000000000000';

  const duration = toBig(core.duration);
  const assignedAt = toBig(core.assignedAt);
  const completionRequestedAt = toBig(val.completionRequestedAt ?? core.completionRequestedAt);
  const disputedAt = toBig(val.disputedAt ?? core.disputedAt);

  // Global protocol-level windows may be provided by user input.
  const completionReviewPeriod = toBig(data.completionReviewPeriod ?? val.completionReviewPeriod);
  const disputeReviewPeriod = toBig(data.disputeReviewPeriod ?? val.disputeReviewPeriod);
  const challengeWindow = toBig(data.challengePeriodAfterApproval ?? val.challengeWindow ?? val.validatorChallengeWindow);

  const reviewEndsAt = completionRequestedAt > 0n ? completionRequestedAt + completionReviewPeriod : 0n;
  const challengeEndsAt = completionRequestedAt > 0n ? completionRequestedAt + challengeWindow : 0n;
  const staleDisputeAt = disputedAt > 0n ? disputedAt + disputeReviewPeriod : 0n;
  const expireAt = assignedAt > 0n ? assignedAt + duration : 0n;

  let state = 'OPEN';
  if (employer === '0x0000000000000000000000000000000000000000') state = 'CANCELLED_OR_DELISTED';
  else if (expired) state = 'EXPIRED';
  else if (completed) state = 'COMPLETED';
  else if (disputed) state = 'DISPUTED';
  else if (completionRequested) state = 'COMPLETION_REQUESTED';
  else if (assignedAt > 0n || (assignedAgent && assignedAgent !== '0x0000000000000000000000000000000000000000')) state = 'IN_PROGRESS';

  const actions = [];
  if (state === 'OPEN') actions.push('applyForJob (eligible agent)');
  if (state === 'OPEN') actions.push('cancelJob (employer)');
  if (state === 'IN_PROGRESS') {
    actions.push('requestJobCompletion (assigned agent)');
    if (expireAt > 0n && now > expireAt) actions.push('expireJob (available once assignedAt + duration has strictly elapsed)');
  }
  if (state === 'COMPLETION_REQUESTED') {
    if (reviewEndsAt > 0n && now <= reviewEndsAt) actions.push('validateJob/disapproveJob (eligible validators)');
    if (reviewEndsAt > 0n && now <= reviewEndsAt) {
      actions.push('disputeJob (employer or assigned agent, while still within review window)');
    }
    if (reviewEndsAt > 0n && now > reviewEndsAt) actions.push('finalizeJob (may settle or open dispute depending on votes/quorum)');
  }
  if (state === 'DISPUTED') {
    actions.push('resolveDisputeWithCode (moderator)');
    if (staleDisputeAt > 0n && now > staleDisputeAt) actions.push('resolveStaleDispute (owner)');
  }

  console.log(`Job ${jobId} advisory (offline)`);
  console.log(`- Derived state: ${state}`);
  console.log(`- now: ${now}`);
  if (expireAt > 0n) console.log(`- expireAt (assignedAt + duration): ${expireAt}`);
  if (completionRequestedAt > 0n) {
    console.log(`- reviewEndsAt: ${reviewEndsAt}`);
    console.log(`- challengeEndsAt: ${challengeEndsAt}`);
  }
  if (disputedAt > 0n) console.log(`- staleDisputeAt (disputedAt + disputeReviewPeriod): ${staleDisputeAt}`);

  if (completionReviewPeriod === 0n || disputeReviewPeriod === 0n) {
    console.log('- Warning: completion/dispute review periods were not provided in input; timing guidance may be incomplete.');
  }

  console.log('- Valid actions now:');
  if (actions.length === 0) console.log('  - none (terminal state or missing timing inputs)');
  for (const a of actions) console.log(`  - ${a}`);

  if (state === 'COMPLETION_REQUESTED' && reviewEndsAt > 0n) {
    const earliestFinalize = (reviewEndsAt > challengeEndsAt ? reviewEndsAt : challengeEndsAt) + 1n;
    console.log(`- Earliest conservative finalize time (strict > gate): ${earliestFinalize}`);
  }
  if (state === 'IN_PROGRESS' && expireAt > 0n) {
    console.log(`- Earliest expire time (strict > gate): ${expireAt + 1n}`);
  }
  if (state === 'DISPUTED' && staleDisputeAt > 0n) {
    console.log(`- Earliest stale-dispute owner resolution time (strict > gate): ${staleDisputeAt + 1n}`);
  }
}

main();
