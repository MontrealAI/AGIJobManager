import { describe, it, expect } from 'vitest'
import { computeDeadlines, deriveJobStatus, roleFlags } from '../job'

const base = {
  employer: '0x0000000000000000000000000000000000000001',
  agent: '0x0000000000000000000000000000000000000000',
  payout: 100n,
  createdAt: 1n,
  assignedAt: 0n,
  duration: 100n,
  completionRequestedAt: 0n,
  validatorApprovedAt: 0n,
  disputedAt: 0n,
  completed: false,
  cancelled: false
} as const

describe('job status', () => {
  it('detects open', () => expect(deriveJobStatus(base as any, { approvals: 0, disapprovals: 0, disputed: false }, 1)).toBe('open'))
  it('detects mutually exclusive terminal states', () => {
    expect(deriveJobStatus({ ...base, cancelled: true, completed: true } as any, { approvals: 0, disapprovals: 0, disputed: true }, 1)).toBe('cancelled')
    expect(deriveJobStatus({ ...base, completed: true } as any, { approvals: 0, disapprovals: 0, disputed: true }, 1)).toBe('settled')
  })
})

describe('deadlines', () => {
  it('computes dates', () => {
    const d = computeDeadlines({ ...base, assignedAt: 10n, duration: 5n, completionRequestedAt: 20n, disputedAt: 30n, validatorApprovedAt: 40n } as any, { completionReview: 3n, disputeReview: 4n, challengeAfterApproval: 5n })
    expect(d.assignmentDeadline).toBe(15n)
    expect(d.completionReviewDeadline).toBe(23n)
    expect(d.disputeReviewDeadline).toBe(34n)
    expect(d.challengeEnd).toBe(45n)
  })
})

describe('role gating', () => {
  it('returns owner and moderator flags', () => {
    expect(roleFlags('0x0000000000000000000000000000000000000002', '0x0000000000000000000000000000000000000002', true)).toEqual({ isOwner: true, isModerator: true })
  })
})
