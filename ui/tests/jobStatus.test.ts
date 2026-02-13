import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeDeadlines, deriveStatus } from '@/lib/jobStatus';
import { isAllowedUri } from '@/lib/web3/safeUri';
import { decodeError } from '@/lib/web3/errors';

const ZERO = '0x0000000000000000000000000000000000000000' as const;

describe('job state invariants', () => {
  it('terminal states are mutually exclusive in derivation precedence', () => {
    const result = deriveStatus({ assignedAgent: ZERO, assignedAt: 1n, duration: 2n, completed: true, disputed: true, expired: true }, { completionRequested: true, completionRequestedAt: 1n, disputedAt: 1n });
    expect(result.status).toBe('Settled');
    expect(result.terminal).toBe(true);
  });

  it('deadline math remains monotonic and non-negative', () => {
    fc.assert(fc.property(fc.bigUintN(32), fc.bigUintN(32), fc.bigUintN(32), (assignedAt, duration, review) => {
      const d = computeDeadlines({ assignedAgent: ZERO, assignedAt, duration, completed: false, disputed: false, expired: false }, { completionRequested: true, completionRequestedAt: assignedAt, disputedAt: assignedAt }, { completionReviewPeriod: review, disputeReviewPeriod: review });
      expect(d.expiryTime >= assignedAt).toBe(true);
      expect(d.completionReviewEnd >= assignedAt).toBe(true);
      expect(d.disputeReviewEnd >= assignedAt).toBe(true);
    }));
  });

  it('URI allowlist fuzzing only accepts allowed schemes', () => {
    fc.assert(fc.property(fc.string(), (raw) => {
      const safe = isAllowedUri(raw);
      if (safe) {
        expect(/^(https|http|ipfs|ens):/i.test(raw.trim())).toBe(true);
      }
    }));
  });

  it('error decoder maps to human messages', () => {
    const decoded = decodeError({ name: 'NotAuthorized', shortMessage: 'reverted' } as never);
    expect(decoded.human.toLowerCase()).toContain('authorized');
  });
});
