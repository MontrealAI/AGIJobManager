export type Role = 'Employer' | 'Agent' | 'Validator' | 'Moderator' | 'Owner';

export type JobCore = {
  assignedAgent: `0x${string}`;
  duration: bigint;
  assignedAt: bigint;
  completed: boolean;
  disputed: boolean;
  expired: boolean;
};

export type JobValidation = {
  completionRequested: boolean;
  completionRequestedAt: bigint;
  disputedAt: bigint;
};

export type Params = {
  completionReviewPeriod: bigint;
  disputeReviewPeriod: bigint;
};

export type JobStatusLabel = 'Open' | 'Assigned' | 'Completion Requested' | 'Disputed' | 'Settled' | 'Expired';

export type DerivedStatus = {
  label: JobStatusLabel;
  isTerminal: boolean;
  nextDeadline?: bigint;
  allowedActions: Record<Role, string[]>;
};

const ZERO = '0x0000000000000000000000000000000000000000';

export function computeDeadlines(core: JobCore, val: JobValidation, p: Params) {
  const expiryTime = core.assignedAt > 0n && core.duration > 0n ? core.assignedAt + core.duration : 0n;
  const completionReviewEnd = val.completionRequestedAt > 0n ? val.completionRequestedAt + p.completionReviewPeriod : 0n;
  const disputeReviewEnd = val.disputedAt > 0n ? val.disputedAt + p.disputeReviewPeriod : 0n;
  return {
    expiryTime,
    completionReviewEnd,
    disputeReviewEnd,
    challengeEnd: completionReviewEnd
  };
}

function emptyActions(): Record<Role, string[]> {
  return { Employer: [], Agent: [], Validator: [], Moderator: [], Owner: [] };
}

export function deriveStatus(core: JobCore, val: JobValidation, params?: Params): DerivedStatus {
  const actions = emptyActions();
  let label: JobStatusLabel = 'Open';
  let isTerminal = false;

  if (core.completed) {
    label = 'Settled';
    isTerminal = true;
  } else if (core.expired) {
    label = 'Expired';
    isTerminal = true;
  } else if (core.disputed) {
    label = 'Disputed';
  } else if (val.completionRequested) {
    label = 'Completion Requested';
  } else if (core.assignedAgent === ZERO) {
    label = 'Open';
  } else {
    label = 'Assigned';
  }

  if (!isTerminal) {
    if (label === 'Open') {
      actions.Employer.push('cancelJob');
      actions.Agent.push('applyForJob');
    }
    if (label === 'Assigned') {
      actions.Agent.push('requestJobCompletion');
      actions.Employer.push('cancelJob');
      actions.Employer.push('disputeJob');
      actions.Agent.push('disputeJob');
    }
    if (label === 'Completion Requested') {
      actions.Validator.push('validateJob', 'disapproveJob');
      actions.Employer.push('finalizeJob', 'disputeJob');
      actions.Agent.push('disputeJob');
      actions.Moderator.push('resolveDisputeWithCode');
    }
    if (label === 'Disputed') {
      actions.Moderator.push('resolveDisputeWithCode');
      actions.Owner.push('lockJobENS');
    }
  }

  const nextDeadline = params
    ? label === 'Assigned'
      ? computeDeadlines(core, val, params).expiryTime
      : label === 'Completion Requested'
        ? computeDeadlines(core, val, params).completionReviewEnd
        : label === 'Disputed'
          ? computeDeadlines(core, val, params).disputeReviewEnd
          : undefined
    : undefined;

  return { label, isTerminal, nextDeadline, allowedActions: actions };
}

export const deriveJobUiStatus = deriveStatus;
