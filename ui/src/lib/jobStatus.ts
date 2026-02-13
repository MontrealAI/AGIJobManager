export type Role = 'Employer' | 'Agent' | 'Validator' | 'Moderator' | 'Owner' | 'Viewer';
export type JobCore = {
  employer?: `0x${string}`;
  assignedAgent: `0x${string}`;
  payout?: bigint;
  duration: bigint;
  assignedAt: bigint;
  completed: boolean;
  disputed: boolean;
  expired: boolean;
};
export type JobValidation = {
  completionRequested: boolean;
  approvals?: number;
  disapprovals?: number;
  completionRequestedAt: bigint;
  disputedAt: bigint;
};
export type Params = { completionReviewPeriod: bigint; disputeReviewPeriod: bigint; challengePeriodAfterApproval?: bigint };
export type Status = 'Open' | 'Assigned' | 'Completion Requested' | 'Disputed' | 'Settled' | 'Expired';

const ZERO = '0x0000000000000000000000000000000000000000';

export function deriveStatus(core: JobCore, val: JobValidation): { status: Status; terminal: boolean } {
  if (core.completed) return { status: 'Settled', terminal: true };
  if (core.expired) return { status: 'Expired', terminal: true };
  if (core.disputed) return { status: 'Disputed', terminal: false };
  if (val.completionRequested) return { status: 'Completion Requested', terminal: false };
  if (core.assignedAgent === ZERO) return { status: 'Open', terminal: false };
  return { status: 'Assigned', terminal: false };
}

export function computeDeadlines(core: JobCore, val: JobValidation, p: Params) {
  const expiryTime = core.assignedAt > 0n && core.duration > 0n ? core.assignedAt + core.duration : 0n;
  const completionReviewEnd = val.completionRequestedAt > 0n ? val.completionRequestedAt + p.completionReviewPeriod : 0n;
  const disputeReviewEnd = val.disputedAt > 0n ? val.disputedAt + p.disputeReviewPeriod : 0n;
  const challengeEnd = 0n;
  return { expiryTime, completionReviewEnd, disputeReviewEnd, challengeEnd };
}

export function deriveJobUiStatus(core: JobCore, val: JobValidation, params: Params, role: Role = 'Viewer') {
  const { status, terminal } = deriveStatus(core, val);
  const deadlines = computeDeadlines(core, val, params);
  const allowedActions = {
    applyForJob: status === 'Open' && role === 'Agent',
    requestJobCompletion: status === 'Assigned' && role === 'Agent',
    cancelJob: (status === 'Open' || status === 'Assigned') && role === 'Employer',
    finalizeJob: status === 'Completion Requested' && role === 'Employer',
    disputeJob: (status === 'Completion Requested' || status === 'Assigned') && (role === 'Employer' || role === 'Agent'),
    validateJob: status === 'Completion Requested' && role === 'Validator',
    disapproveJob: status === 'Completion Requested' && role === 'Validator',
    resolveDisputeWithCode: status === 'Disputed' && role === 'Moderator',
    lockJobENS: role === 'Owner'
  };

  const nextDeadline = status === 'Assigned'
    ? deadlines.expiryTime
    : status === 'Completion Requested'
      ? deadlines.completionReviewEnd
      : status === 'Disputed'
        ? deadlines.disputeReviewEnd
        : 0n;

  return { label: status, isTerminal: terminal, nextDeadline, allowedActions };
}
