import { describe, expect, it } from 'vitest'
import { computeDeadlines, deriveJobUiStatus } from '../jobStatus'

describe('job status', () => {
  it('prefers settled over others', () => {
    const out = deriveJobUiStatus({ employer: '0x0000000000000000000000000000000000000001', assignedAgent: '0x0000000000000000000000000000000000000002', payout: 1n, duration: 1n, assignedAt: 1n, completed: true, disputed: true, expired: true, agentPayoutPct: 0 }, { completionRequested: true, approvals: 0, disapprovals: 0, completionRequestedAt: 1n, disputedAt: 1n })
    expect(out.status).toBe('Settled')
    expect(out.terminal).toBe(true)
  })

  it('computes deadlines with missing timestamps', () => {
    const out = computeDeadlines({ employer: '0x0000000000000000000000000000000000000001', assignedAgent: '0x0000000000000000000000000000000000000000', payout: 0n, duration: 0n, assignedAt: 0n, completed: false, disputed: false, expired: false, agentPayoutPct: 0 }, { completionRequested: false, approvals: 0, disapprovals: 0, completionRequestedAt: 0n, disputedAt: 0n }, { completionReviewPeriod: 10n, disputeReviewPeriod: 10n, challengePeriodAfterApproval: 5n })
    expect(out.expiryTime).toBe(0n)
    expect(out.challengeEnd).toBe(0n)
  })
})
