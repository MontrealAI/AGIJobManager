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
  return { expiryTime, completionReviewEnd, disputeReviewEnd, challengeEnd: 0n };
}

export function getActionGate(status: Status, role: 'Employer' | 'Agent' | 'Validator' | 'Moderator' | 'Owner') {
  const matrix: Record<string, Status[]> = {
    cancelJob: role === 'Employer' ? ['Open', 'Assigned'] : [],
    finalizeJob: role === 'Employer' ? ['Completion Requested'] : [],
    disputeJob: role === 'Employer' || role === 'Agent' ? ['Completion Requested'] : [],
    applyForJob: role === 'Agent' ? ['Open'] : [],
    requestJobCompletion: role === 'Agent' ? ['Assigned'] : [],
    validateJob: role === 'Validator' ? ['Completion Requested'] : [],
    disapproveJob: role === 'Validator' ? ['Completion Requested'] : [],
    resolveDisputeWithCode: role === 'Moderator' ? ['Disputed'] : [],
    lockJobENS: role === 'Owner' ? ['Settled'] : []
  };
  return Object.fromEntries(Object.entries(matrix).map(([k, allowed]) => [k, allowed.includes(status)]));
}
