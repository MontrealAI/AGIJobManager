export type JobCore = {
  employer: `0x${string}`
  agent: `0x${string}`
  payout: bigint
  createdAt: bigint
  assignedAt: bigint
  duration: bigint
  completionRequestedAt: bigint
  validatorApprovedAt: bigint
  disputedAt: bigint
  completed: boolean
  cancelled: boolean
}

export type JobValidation = { approvals: number; disapprovals: number; disputed: boolean }

export function deriveJobStatus(core: JobCore, validation: JobValidation, nowSec: number) {
  if (core.cancelled) return 'cancelled'
  if (core.completed) return 'settled'
  if (validation.disputed || core.disputedAt > 0n) return 'disputed'
  if (core.completionRequestedAt > 0n) return 'completion requested'
  if (core.agent !== '0x0000000000000000000000000000000000000000') return nowSec > Number(core.assignedAt + core.duration) ? 'expired' : 'assigned'
  return 'open'
}

export function computeDeadlines(core: JobCore, periods: { completionReview: bigint; disputeReview: bigint; challengeAfterApproval: bigint }) {
  return {
    assignmentDeadline: core.assignedAt + core.duration,
    completionReviewDeadline: core.completionRequestedAt + periods.completionReview,
    disputeReviewDeadline: core.disputedAt + periods.disputeReview,
    challengeEnd: core.validatorApprovedAt + periods.challengeAfterApproval
  }
}

export function roleFlags(account: `0x${string}` | undefined, owner: `0x${string}` | undefined, moderator = false) {
  const normalized = account?.toLowerCase()
  return {
    isOwner: !!normalized && !!owner && normalized === owner.toLowerCase(),
    isModerator: moderator
  }
}
