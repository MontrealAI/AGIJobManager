export type Role = 'employer' | 'agent' | 'validator' | 'moderator' | 'owner';

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

export function deriveStatus(core: JobCore, val: JobValidation): { status: Status; terminal: boolean } {
  if (core.completed) return { status: 'Settled', terminal: true };
  if (core.expired) return { status: 'Expired', terminal: true };
  if (core.disputed || val.disputedAt > 0n) return { status: 'Disputed', terminal: false };
  if (val.completionRequested) return { status: 'Completion Requested', terminal: false };
  if (core.assignedAgent === '0x0000000000000000000000000000000000000000') return { status: 'Open', terminal: false };
  return { status: 'Assigned', terminal: false };
}

export function computeDeadlines(core: JobCore, val: JobValidation, p: Params) {
  const expiryTime = core.assignedAt > 0n ? core.assignedAt + core.duration : 0n;
  const completionReviewEnd = val.completionRequestedAt > 0n ? val.completionRequestedAt + p.completionReviewPeriod : 0n;
  const disputeReviewEnd = val.disputedAt > 0n ? val.disputedAt + p.disputeReviewPeriod : 0n;
  const challengeEnd = p.challengePeriodAfterApproval && val.completionRequestedAt > 0n ? val.completionRequestedAt + p.challengePeriodAfterApproval : 0n;
  return { expiryTime, completionReviewEnd, disputeReviewEnd, challengeEnd };
}

export function deriveJobView(core: JobCore, val: JobValidation, p: Params) {
  const status = deriveStatus(core, val);
  const d = computeDeadlines(core, val, p);
  const nextDeadline = [d.expiryTime, d.completionReviewEnd, d.disputeReviewEnd].filter((x) => x > 0n).sort((a, b) => Number(a - b))[0] || 0n;
  const actionsByRole: Record<Role, string[]> = {
    employer: status.status === 'Open' || status.status === 'Assigned' ? ['cancelJob'] : status.status === 'Completion Requested' ? ['finalizeJob', 'disputeJob'] : [],
    agent: status.status === 'Open' ? ['applyForJob'] : status.status === 'Assigned' ? ['requestJobCompletion'] : status.status === 'Completion Requested' ? ['disputeJob'] : [],
    validator: status.status === 'Completion Requested' ? ['validateJob', 'disapproveJob'] : [],
    moderator: status.status === 'Disputed' ? ['resolveDisputeWithCode'] : [],
    owner: ['lockJobENS']
  };
  return { label: status.status, isTerminal: status.terminal, nextDeadline, allowedActions: actionsByRole };
}

export const deriveJobUiStatus = deriveStatus;
