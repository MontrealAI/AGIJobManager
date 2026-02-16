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
  const completionRequested = bool(core.completionRequested);
  const completed = bool(core.completed);
  const cancelled = bool(core.cancelled);
  const expired = bool(core.expired);
  const assignedAgent = core.agent || core.assignedAgent || '0x0000000000000000000000000000000000000000';

  const createdAt = toBig(core.createdAt);
  const duration = toBig(core.duration);
  const completionRequestedAt = toBig(core.completionRequestedAt);

  const completionReviewPeriod = toBig(val.completionReviewPeriod);
  const disputeReviewPeriod = toBig(val.disputeReviewPeriod);
  const challengeWindow = toBig(val.challengeWindow || val.validatorChallengeWindow);

  const reviewEndsAt = completionRequestedAt > 0n ? completionRequestedAt + completionReviewPeriod : 0n;
  const challengeEndsAt = completionRequestedAt > 0n ? completionRequestedAt + challengeWindow : 0n;
  const staleDisputeAt = completionRequestedAt > 0n ? completionRequestedAt + disputeReviewPeriod : 0n;
  const expireAt = createdAt + duration;

  let state = 'OPEN';
  if (cancelled) state = 'CANCELLED';
  else if (expired) state = 'EXPIRED';
  else if (completed) state = 'COMPLETED';
  else if (disputed) state = 'DISPUTED';
  else if (completionRequested) state = 'COMPLETION_REQUESTED';
  else if (assignedAgent && assignedAgent !== '0x0000000000000000000000000000000000000000') state = 'IN_PROGRESS';

  const actions = [];
  if (state === 'OPEN') actions.push('applyForJob (eligible agent)');
  if (state === 'OPEN') actions.push('cancelJob (employer)');
  if (state === 'IN_PROGRESS') {
    actions.push('requestJobCompletion (assigned agent)');
    if (now >= expireAt) actions.push('expireJob (anyone allowed by contract policy)');
  }
  if (state === 'COMPLETION_REQUESTED') {
    if (now <= reviewEndsAt) actions.push('validateJob/disapproveJob (eligible validators)');
    actions.push('disputeJob (employer or assigned agent, if within allowed window)');
    if (now >= reviewEndsAt) actions.push('finalizeJob (may settle or open dispute depending on votes/quorum)');
  }
  if (state === 'DISPUTED') {
    actions.push('resolveDisputeWithCode (moderator)');
    if (now >= staleDisputeAt) actions.push('resolveStaleDispute (owner)');
  }

  console.log(`Job ${jobId} advisory (offline)`);
  console.log(`- Derived state: ${state}`);
  console.log(`- now: ${now}`);
  console.log(`- expireAt: ${expireAt}`);
  if (completionRequestedAt > 0n) {
    console.log(`- reviewEndsAt: ${reviewEndsAt}`);
    console.log(`- challengeEndsAt: ${challengeEndsAt}`);
    console.log(`- staleDisputeAt: ${staleDisputeAt}`);
  }
  console.log('- Valid actions now:');
  if (actions.length === 0) console.log('  - none (terminal or missing data)');
  for (const a of actions) console.log(`  - ${a}`);

  if (state === 'COMPLETION_REQUESTED') {
    const earliestFinalize = reviewEndsAt > 0n ? reviewEndsAt : challengeEndsAt;
    console.log(`- Earliest conservative finalize time: ${earliestFinalize}`);
  }
  if (state === 'IN_PROGRESS') {
    console.log(`- Earliest expire time: ${expireAt}`);
  }
  if (state === 'DISPUTED') {
    console.log(`- Earliest stale-dispute owner resolution time: ${staleDisputeAt}`);
  }
}

main();
