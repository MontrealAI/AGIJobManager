import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { computeDeadlines, deriveStatus } from '@/lib/jobStatus';
import { isAllowedUri } from '@/lib/web3/safeUri';
import { mapErrorName } from '@/lib/web3/errors';

describe('job status invariants', () => {
  it('terminal states mutually exclusive', () => {
    fc.assert(fc.property(fc.boolean(), fc.boolean(), (completed, expired) => {
      const s = deriveStatus({ assignedAgent: '0x0000000000000000000000000000000000000000', duration: 0n, assignedAt: 0n, completed, disputed: false, expired }, { completionRequested: false, completionRequestedAt: 0n, disputedAt: 0n });
      if (completed) expect(s.status).toBe('Settled');
      else if (expired) expect(s.status).toBe('Expired');
    }));
  });

  it('deadline math is monotonic and non-negative', () => {
    fc.assert(fc.property(fc.nat(), fc.nat(), fc.nat(), (assignedAt, duration, review) => {
      const d = computeDeadlines(
        { assignedAgent: '0x1'.padEnd(42, '0') as `0x${string}`, duration: BigInt(duration), assignedAt: BigInt(assignedAt), completed: false, disputed: false, expired: false },
        { completionRequested: true, completionRequestedAt: BigInt(assignedAt), disputedAt: BigInt(assignedAt) },
        { completionReviewPeriod: BigInt(review), disputeReviewPeriod: BigInt(review) }
      );
      expect(d.expiryTime >= 0n).toBeTruthy();
      expect(d.completionReviewEnd >= BigInt(assignedAt)).toBeTruthy();
    }));
  });

  it('URI sanitizer only allowlists expected schemes', () => {
    fc.assert(fc.property(fc.string(), (v) => {
      const allowed = isAllowedUri(v);
      if (allowed) expect(/^(https?|ipfs|ens):/i.test(v.trim())).toBeTruthy();
    }));
  });

  it('maps contract error names', () => {
    expect(mapErrorName('InvalidState')).toContain('Action not allowed');
  });
});
