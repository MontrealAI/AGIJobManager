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
  approvals: number
  disapprovals: number
  completionRequestedAt: bigint
  disputedAt: bigint
}

export type GlobalParams = {
  completionReviewPeriod: bigint
  disputeReviewPeriod: bigint
  challengePeriodAfterApproval: bigint
}

export type JobUiStatus = 'Open' | 'Assigned' | 'Completion Requested' | 'Disputed' | 'Settled' | 'Expired'

const zeroAddress = '0x0000000000000000000000000000000000000000'

export function deriveJobUiStatus(core: JobCore, validation: JobValidation): { status: JobUiStatus; terminal: boolean } {
  if (core.completed) return { status: 'Settled', terminal: true }
  if (core.expired) return { status: 'Expired', terminal: true }
  if (core.disputed || validation.disputedAt > 0n) return { status: 'Disputed', terminal: false }
  if (validation.completionRequested || validation.completionRequestedAt > 0n) return { status: 'Completion Requested', terminal: false }
  if (core.assignedAgent.toLowerCase() !== zeroAddress) return { status: 'Assigned', terminal: false }
  return { status: 'Open', terminal: false }
}

export function computeDeadlines(core: JobCore, validation: JobValidation, params: GlobalParams) {
  const expiryTime = core.assignedAt > 0n && core.duration > 0n ? core.assignedAt + core.duration : 0n
  return {
    expiryTime,
    completionReviewEnd:
      validation.completionRequestedAt > 0n ? validation.completionRequestedAt + params.completionReviewPeriod : 0n,
    disputeReviewEnd: validation.disputedAt > 0n ? validation.disputedAt + params.disputeReviewPeriod : 0n,
    challengeEnd: 0n
  }
}
