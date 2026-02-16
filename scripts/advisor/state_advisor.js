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

function hasValue(v) {
  return !(v === undefined || v === null || v === '');
}

function toBig(v, fallback = 0n) {
  if (!hasValue(v)) return fallback;
  return BigInt(String(v));
}

function toBigOrNull(v) {
  if (!hasValue(v)) return null;
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
  const validatorApproved = (val.validatorApproved ?? data.validatorApproved ?? core.validatorApproved);


  // Global protocol-level windows and validator approval timestamp may be provided by user input.
  const completionReviewPeriod = toBigOrNull(data.completionReviewPeriod ?? val.completionReviewPeriod);
  const disputeReviewPeriod = toBigOrNull(data.disputeReviewPeriod ?? val.disputeReviewPeriod);
  const challengeWindow = toBigOrNull(data.challengePeriodAfterApproval ?? val.challengeWindow ?? val.validatorChallengeWindow);
  const validatorApprovedAt = toBigOrNull(data.validatorApprovedAt ?? val.validatorApprovedAt ?? core.validatorApprovedAt);

  const reviewEndsAt = (completionRequestedAt > 0n && completionReviewPeriod !== null)
    ? completionRequestedAt + completionReviewPeriod
    : null;
  const challengeEndsAt = (validatorApprovedAt !== null && validatorApprovedAt > 0n && challengeWindow !== null)
    ? validatorApprovedAt + challengeWindow
    : null;
  const staleDisputeAt = (disputedAt > 0n && disputeReviewPeriod !== null)
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
    const completionStillInWindow = !disputed && (expireAt === null || now <= expireAt);
    if (completionStillInWindow) {
      actions.push('requestJobCompletion (assigned agent)');
    }
    if (expireAt !== null && now > expireAt) actions.push('expireJob (available once assignedAt + duration has elapsed)');
  }
  if (state === 'COMPLETION_REQUESTED') {
    if (reviewEndsAt !== null && now <= reviewEndsAt) actions.push('validateJob/disapproveJob (eligible validators)');
    if (reviewEndsAt !== null && now <= reviewEndsAt) actions.push('disputeJob (employer or assigned agent, if within allowed window)');

    // finalizeJob requires review window elapsed and, when validator-approved path is active,
    // challenge period elapsed from validatorApprovedAt.
    const validatorApprovedKnown = validatorApproved === true || validatorApproved === false || validatorApproved === 'true' || validatorApproved === 'false' || validatorApproved === 1 || validatorApproved === 0;
    const validatorApprovedBool = bool(validatorApproved);
    const reviewElapsed = reviewEndsAt !== null && now > reviewEndsAt;
    const challengeElapsed = challengeEndsAt !== null && now > challengeEndsAt;

    if (reviewElapsed) {
      if (validatorApprovedKnown) {
        if (!validatorApprovedBool || challengeElapsed) {
          actions.push('finalizeJob (may settle or open dispute depending on votes/quorum)');
        }
      } else if (challengeEndsAt !== null) {
        if (challengeElapsed) {
          actions.push('finalizeJob (may settle or open dispute depending on votes/quorum)');
        }
      }
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
  if (challengeEndsAt !== null) {
    console.log(`- challengeEndsAt (validatorApprovedAt + challengePeriodAfterApproval): ${challengeEndsAt}`);
  }
  if (staleDisputeAt !== null) console.log(`- staleDisputeAt (disputedAt + disputeReviewPeriod): ${staleDisputeAt}`);

  const missingTiming = [];
  if (completionReviewPeriod === null) missingTiming.push('completionReviewPeriod');
  if (disputeReviewPeriod === null) missingTiming.push('disputeReviewPeriod');
  if (challengeWindow === null) missingTiming.push('challengePeriodAfterApproval');
  if (missingTiming.length > 0) {
    console.log(`- Warning: missing timing inputs (${missingTiming.join(', ')}); advisor suppresses dependent time-gated actions.`);
  }
  if (!hasValue(validatorApproved) && challengeWindow !== null) {
    console.log('- Warning: validatorApproved is unknown; finalize advice is conservatively suppressed unless challenge-gate state is provably satisfied from provided inputs.');
  }
  if (state === 'IN_PROGRESS' && !disputed && expireAt !== null && now > expireAt) {
    console.log('- Warning: requestJobCompletion is no longer callable after duration elapses for non-disputed jobs. Use expireJob if eligible.');
  }

  console.log('- Valid actions now:');
  if (actions.length === 0) console.log('  - none (terminal state or missing timing inputs)');
  for (const a of actions) console.log(`  - ${a}`);

  if (state === 'COMPLETION_REQUESTED' && reviewEndsAt !== null) {
    const finalizeGate = challengeEndsAt === null || reviewEndsAt > challengeEndsAt ? reviewEndsAt : challengeEndsAt;
    console.log(`- Earliest conservative finalize threshold (must be strictly greater than this): ${finalizeGate}`);
    console.log('- Note: finalize is only suggested when challenge-gate status is known-safe (or explicitly not validator-approved).');
  }
  if (state === 'IN_PROGRESS' && expireAt !== null) {
    console.log(`- Earliest expire threshold (must be strictly greater than this): ${expireAt}`);
  }
  if (state === 'DISPUTED' && staleDisputeAt !== null) {
    console.log(`- Earliest stale-dispute owner threshold (must be strictly greater than this): ${staleDisputeAt}`);
  }
}

main();
