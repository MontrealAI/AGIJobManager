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
export type Params = { completionReviewPeriod: bigint; disputeReviewPeriod: bigint };
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
  const expiryTime = core.assignedAt + core.duration;
  const completionReviewEnd = val.completionRequested ? val.completionRequestedAt + p.completionReviewPeriod : 0n;
  const disputeReviewEnd = val.disputedAt > 0n ? val.disputedAt + p.disputeReviewPeriod : 0n;
  return { expiryTime, completionReviewEnd, disputeReviewEnd, challengeEnd: 0n };
}
