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

function toOptionalBig(v) {
  if (v === undefined || v === null || v === '') return null;
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

  // Protocol-level windows (must be supplied for time-gated guidance).
  const completionReviewPeriod = toOptionalBig(data.completionReviewPeriod ?? val.completionReviewPeriod);
  const disputeReviewPeriod = toOptionalBig(data.disputeReviewPeriod ?? val.disputeReviewPeriod);
  const challengeWindow = toOptionalBig(data.challengePeriodAfterApproval ?? val.challengeWindow ?? val.validatorChallengeWindow);

  // Challenge window is anchored to validatorApprovedAt for on-chain finalize gating.
  const validatorApprovedAt = toOptionalBig(data.validatorApprovedAt ?? val.validatorApprovedAt ?? core.validatorApprovedAt);

  const reviewEndsAt = completionRequestedAt > 0n && completionReviewPeriod !== null
    ? completionRequestedAt + completionReviewPeriod
    : null;
  const challengeEndsAt = validatorApprovedAt !== null && validatorApprovedAt > 0n && challengeWindow !== null
    ? validatorApprovedAt + challengeWindow
    : null;
  const staleDisputeAt = disputedAt > 0n && disputeReviewPeriod !== null
    ? disputedAt + disputeReviewPeriod
    : null;
  const expireAt = assignedAt > 0n ? assignedAt + duration : null;

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
    if (expireAt !== null && now > expireAt) actions.push('expireJob (available once assignedAt + duration has elapsed)');
  }
  if (state === 'COMPLETION_REQUESTED') {
    if (reviewEndsAt !== null && now <= reviewEndsAt) {
      actions.push('validateJob/disapproveJob (eligible validators)');
      actions.push('disputeJob (employer or assigned agent, if within allowed window)');
    }

    // Conservative finalize suggestion: require both known review and challenge gates.
    if (reviewEndsAt !== null && challengeEndsAt !== null && now > reviewEndsAt && now > challengeEndsAt) {
      actions.push('finalizeJob (may settle or open dispute depending on votes/quorum)');
    }
  }
  if (state === 'DISPUTED') {
    actions.push('resolveDisputeWithCode (moderator)');
    if (staleDisputeAt !== null && now > staleDisputeAt) actions.push('resolveStaleDispute (owner)');
  }

  console.log(`Job ${jobId} advisory (offline)`);
  console.log(`- Derived state: ${state}`);
  console.log(`- now: ${now}`);
  if (expireAt !== null) console.log(`- expireAt (assignedAt + duration): ${expireAt}`);
  if (reviewEndsAt !== null) console.log(`- reviewEndsAt: ${reviewEndsAt}`);
  if (challengeEndsAt !== null) console.log(`- challengeEndsAt (validatorApprovedAt + challengePeriodAfterApproval): ${challengeEndsAt}`);
  if (staleDisputeAt !== null) console.log(`- staleDisputeAt (disputedAt + disputeReviewPeriod): ${staleDisputeAt}`);

  if (completionReviewPeriod === null || disputeReviewPeriod === null) {
    console.log('- Warning: completion/dispute review periods are missing in input; suppressing affected time-gated advice.');
  }
  if (challengeWindow === null || validatorApprovedAt === null) {
    console.log('- Warning: challenge window or validatorApprovedAt missing; finalize guidance is conservative and may be withheld.');
  }

  console.log('- Valid actions now:');
  if (actions.length === 0) console.log('  - none (terminal state or missing timing inputs)');
  for (const a of actions) console.log(`  - ${a}`);

  if (state === 'COMPLETION_REQUESTED') {
    if (reviewEndsAt !== null && challengeEndsAt !== null) {
      const earliestFinalize = reviewEndsAt > challengeEndsAt ? reviewEndsAt : challengeEndsAt;
      console.log(`- Earliest conservative finalize threshold (must be strictly greater than this): ${earliestFinalize}`);
    }
  }
  if (state === 'IN_PROGRESS' && expireAt !== null) {
    console.log(`- Earliest expire threshold (must be strictly greater than this): ${expireAt}`);
  }
  if (state === 'DISPUTED' && staleDisputeAt !== null) {
    console.log(`- Earliest stale-dispute owner threshold (must be strictly greater than this): ${staleDisputeAt}`);
  }
}

main();
