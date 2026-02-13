export type Role = 'Employer' | 'Agent' | 'Validator' | 'Moderator' | 'Owner';

export type JobCore = {
  employer?: `0x${string}`;
  assignedAgent: `0x${string}`;
  payout?: bigint;
  duration: bigint;
  assignedAt: bigint;
  completed: boolean;
  disputed: boolean;
  expired: boolean;
  agentPayoutPct?: number;
};

export type JobValidation = {
  completionRequested: boolean;
  approvals?: number;
  disapprovals?: number;
  completionRequestedAt: bigint;
  disputedAt: bigint;
};

export type Params = {
  completionReviewPeriod: bigint;
  disputeReviewPeriod: bigint;
  challengePeriodAfterApproval?: bigint;
};

export type Status = 'Open' | 'Assigned' | 'Completion Requested' | 'Disputed' | 'Settled' | 'Expired';

export type DerivedJobStatus = {
  label: Status;
  status: Status;
  isTerminal: boolean;
  terminal: boolean;
  nextDeadline: bigint;
  allowedActions: Record<Role, string[]>;
};

const ZERO = '0x0000000000000000000000000000000000000000';

export function computeDeadlines(core: JobCore, val: JobValidation, p: Params) {
  const expiryTime = core.assignedAt > 0n && core.duration > 0n ? core.assignedAt + core.duration : 0n;
  const completionReviewEnd = val.completionRequestedAt > 0n ? val.completionRequestedAt + p.completionReviewPeriod : 0n;
  const disputeReviewEnd = val.disputedAt > 0n ? val.disputedAt + p.disputeReviewPeriod : 0n;
  const challengeEnd = 0n;
  return { expiryTime, completionReviewEnd, disputeReviewEnd, challengeEnd };
}

export function deriveStatus(core: JobCore, val: JobValidation, p: Params = { completionReviewPeriod: 0n, disputeReviewPeriod: 0n }): DerivedJobStatus {
  const deadlines = computeDeadlines(core, val, p);
  let status: Status = 'Open';

  if (core.completed) status = 'Settled';
  else if (core.expired) status = 'Expired';
  else if (core.disputed || val.disputedAt > 0n) status = 'Disputed';
  else if (val.completionRequested) status = 'Completion Requested';
  else if (core.assignedAgent !== ZERO) status = 'Assigned';

  const isTerminal = status === 'Settled' || status === 'Expired';

  const allowedActions: Record<Role, string[]> = {
    Employer: [],
    Agent: [],
    Validator: [],
    Moderator: [],
    Owner: []
  };

  if (!isTerminal) {
    if (status === 'Open') {
      allowedActions.Employer.push('cancelJob');
      allowedActions.Agent.push('applyForJob');
    }
    if (status === 'Assigned') {
      allowedActions.Agent.push('requestJobCompletion');
      allowedActions.Employer.push('disputeJob');
      allowedActions.Agent.push('disputeJob');
    }
    if (status === 'Completion Requested') {
      allowedActions.Validator.push('validateJob', 'disapproveJob');
      allowedActions.Employer.push('finalizeJob', 'disputeJob');
      allowedActions.Agent.push('disputeJob');
    }
    if (status === 'Disputed') {
      allowedActions.Moderator.push('resolveDisputeWithCode');
    }
    allowedActions.Owner.push('lockJobENS');
  }

  const nextDeadline =
    status === 'Assigned'
      ? deadlines.expiryTime
      : status === 'Completion Requested'
      ? deadlines.completionReviewEnd
      : status === 'Disputed'
      ? deadlines.disputeReviewEnd
      : 0n;

  return { label: status, status, isTerminal, terminal: isTerminal, nextDeadline, allowedActions };
}

export const deriveJobUiStatus = deriveStatus;
