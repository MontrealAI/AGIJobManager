export type JobCore = {
  employer: `0x${string}`
  assignedAgent: `0x${string}`
  payout: bigint
  duration: bigint
  assignedAt: bigint
  completed: boolean
  disputed: boolean
  expired: boolean
  agentPayoutPct: number
}

export type JobValidation = {
  completionRequested: boolean
  approvals: bigint
  disapprovals: bigint
  completionRequestedAt: bigint
  disputedAt: bigint
}

export type GlobalParams = {
  completionReviewPeriod: bigint
  disputeReviewPeriod: bigint
  challengePeriodAfterApproval: bigint
}

export function deriveJobStatus(core: JobCore, validation: JobValidation) {
  if (core.completed) return { label: 'Settled', terminal: true }
  if (core.expired) return { label: 'Expired', terminal: true }
  if (core.disputed || validation.disputedAt > 0n) return { label: 'Disputed', terminal: false }
  if (validation.completionRequested) return { label: 'Completion Requested', terminal: false }
  if (core.assignedAgent === '0x0000000000000000000000000000000000000000') return { label: 'Open', terminal: false }
  return { label: 'Assigned', terminal: false }
}

export function computeDeadlines(core: JobCore, validation: JobValidation, params: GlobalParams) {
  const expiryTime = core.assignedAt > 0n ? core.assignedAt + core.duration : 0n
  const completionReviewEnd = validation.completionRequestedAt > 0n ? validation.completionRequestedAt + params.completionReviewPeriod : 0n
  const disputeReviewEnd = validation.disputedAt > 0n ? validation.disputedAt + params.disputeReviewPeriod : 0n
  return { expiryTime, completionReviewEnd, disputeReviewEnd, challengeEnd: undefined as bigint | undefined }
}
