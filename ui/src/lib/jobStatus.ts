export type JobCore = { assignedAgent: `0x${string}`; duration: bigint; assignedAt: bigint; completed: boolean; disputed: boolean; expired: boolean };
export type JobValidation = { completionRequested: boolean; completionRequestedAt: bigint; disputedAt: bigint };
export type Params = { completionReviewPeriod: bigint; disputeReviewPeriod: bigint };

export type Status = 'Open' | 'Assigned' | 'Completion Requested' | 'Disputed' | 'Settled' | 'Expired';

export function deriveStatus(core: JobCore, val: JobValidation): { status: Status; terminal: boolean } {
  if (core.completed) return { status: 'Settled', terminal: true };
  if (core.expired) return { status: 'Expired', terminal: true };
  if (core.disputed) return { status: 'Disputed', terminal: false };
  if (val.completionRequested) return { status: 'Completion Requested', terminal: false };
  if (core.assignedAgent === '0x0000000000000000000000000000000000000000') return { status: 'Open', terminal: false };
  return { status: 'Assigned', terminal: false };
}

export function computeDeadlines(core: JobCore, val: JobValidation, p: Params) {
  const expiryTime = core.assignedAt > 0n ? core.assignedAt + core.duration : 0n;
  const completionReviewEnd = val.completionRequestedAt > 0n ? val.completionRequestedAt + p.completionReviewPeriod : 0n;
  const disputeReviewEnd = val.disputedAt > 0n ? val.disputedAt + p.disputeReviewPeriod : 0n;
  return { expiryTime, completionReviewEnd, disputeReviewEnd };
}

export function canFinalize(status: Status) {
  return status === 'Completion Requested';
}
