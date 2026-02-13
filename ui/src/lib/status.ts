export type DerivedStatus =
  | 'open'
  | 'assigned'
  | 'completion_requested'
  | 'disputed'
  | 'settled'
  | 'expired';

export type JobCore = {
  assignedAgent: `0x${string}`;
  settled: boolean;
  disputedAt: bigint;
  completionRequestedAt: bigint;
  assignedAt: bigint;
  deadline: bigint;
};

const zero = '0x0000000000000000000000000000000000000000';

export function deriveJobStatus(job: JobCore, now: bigint): DerivedStatus {
  if (job.settled) return 'settled';
  if (job.disputedAt > 0n) return 'disputed';
  if (job.completionRequestedAt > 0n) return 'completion_requested';
  if (job.assignedAgent !== zero && job.assignedAt > 0n) {
    if (job.deadline > 0n && now > job.deadline) return 'expired';
    return 'assigned';
  }
  return 'open';
}

export type Deadlines = {
  assignmentEndsAt: bigint;
  completionReviewEndsAt: bigint;
  disputeReviewEndsAt: bigint;
  challengeEndsAt: bigint;
};

export function computeDeadlines(input: {
  assignedAt: bigint;
  duration: bigint;
  completionRequestedAt: bigint;
  completionReviewPeriod: bigint;
  disputedAt: bigint;
  disputeReviewPeriod: bigint;
  validatorApprovedAt: bigint;
  challengePeriodAfterApproval: bigint;
}): Deadlines {
  return {
    assignmentEndsAt: input.assignedAt + input.duration,
    completionReviewEndsAt: input.completionRequestedAt + input.completionReviewPeriod,
    disputeReviewEndsAt: input.disputedAt + input.disputeReviewPeriod,
    challengeEndsAt: input.validatorApprovedAt + input.challengePeriodAfterApproval
  };
}

export function canAccessAdmin(address?: string, owner?: string) {
  return Boolean(address && owner && address.toLowerCase() === owner.toLowerCase());
}
