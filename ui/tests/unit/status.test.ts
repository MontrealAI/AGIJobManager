import { describe, expect, it } from 'vitest';
import { canAccessAdmin, computeDeadlines, deriveJobStatus } from '@/lib/status';
import { isAllowedUri } from '@/lib/utils';

describe('status derivation', () => {
  it('returns mutually exclusive terminal settled state', () => {
    const status = deriveJobStatus({
      assignedAgent: '0x0000000000000000000000000000000000000001',
      settled: true,
      disputedAt: 1n,
      completionRequestedAt: 1n,
      assignedAt: 1n,
      deadline: 2n
    }, 3n);
    expect(status).toBe('settled');
  });

  it('returns expired when deadline passed', () => {
    const status = deriveJobStatus({
      assignedAgent: '0x0000000000000000000000000000000000000001',
      settled: false,
      disputedAt: 0n,
      completionRequestedAt: 0n,
      assignedAt: 1n,
      deadline: 2n
    }, 3n);
    expect(status).toBe('expired');
  });
});

describe('deadline calculations', () => {
  it('computes all windows correctly', () => {
    const d = computeDeadlines({
      assignedAt: 100n,
      duration: 10n,
      completionRequestedAt: 150n,
      completionReviewPeriod: 5n,
      disputedAt: 200n,
      disputeReviewPeriod: 9n,
      validatorApprovedAt: 220n,
      challengePeriodAfterApproval: 11n
    });
    expect(d.assignmentEndsAt).toBe(110n);
    expect(d.completionReviewEndsAt).toBe(155n);
    expect(d.disputeReviewEndsAt).toBe(209n);
    expect(d.challengeEndsAt).toBe(231n);
  });
});

describe('URI allowlist + role gating', () => {
  it('allows only safe schemes', () => {
    expect(isAllowedUri('ipfs://hash')).toBe(true);
    expect(isAllowedUri('javascript:alert(1)')).toBe(false);
  });

  it('gates admin to owner', () => {
    expect(canAccessAdmin('0xabc', '0xAbC')).toBe(true);
    expect(canAccessAdmin('0xabc', '0xdef')).toBe(false);
  });
});
