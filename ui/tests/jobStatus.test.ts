import { describe, it, expect } from 'vitest'
import { computeDeadlines, deriveJobStatus } from '@/lib/jobStatus'

const baseCore = { employer: '0x0000000000000000000000000000000000000001', assignedAgent: '0x0000000000000000000000000000000000000000', payout: 0n, duration: 0n, assignedAt: 0n, completed: false, disputed: false, expired: false, agentPayoutPct: 100 }
const baseVal = { completionRequested: false, approvals: 0n, disapprovals: 0n, completionRequestedAt: 0n, disputedAt: 0n }

describe('jobStatus', () => {
  it('uses mutually exclusive terminal states', () => {
    expect(deriveJobStatus({ ...baseCore, completed: true, expired: true }, baseVal).label).toBe('Settled')
  })

  it('computes deadline edges', () => {
    const d = computeDeadlines(baseCore, baseVal, { completionReviewPeriod: 0n, disputeReviewPeriod: 0n, challengePeriodAfterApproval: 0n })
    expect(d.expiryTime).toBe(0n)
    expect(d.completionReviewEnd).toBe(0n)
  })
})
