import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeDeadlines, deriveStatus } from '@/lib/jobStatus';
import { sanitizeUri } from '@/lib/web3/safeUri';
import { decodeError } from '@/lib/web3/errors';

const zero = '0x0000000000000000000000000000000000000000' as const;

describe('job status properties', () => {
  it('terminal states are mutually exclusive', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (completed, expired) => {
        const s = deriveStatus({ assignedAgent: zero, assignedAt: 0n, duration: 0n, completed, disputed: false, expired }, { completionRequested: false, completionRequestedAt: 0n, disputedAt: 0n });
        if (completed && expired) expect(s.label).toBe('Settled');
        expect(!(s.label === 'Settled' && s.label === 'Expired')).toBe(true);
      })
    );
  });

  it('deadline math is monotonic and non-negative', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10_000_000n }), fc.bigInt({ min: 0n, max: 10_000_000n }), (assignedAt, duration) => {
        const d = computeDeadlines({ assignedAgent: zero, assignedAt, duration, completed: false, disputed: false, expired: false }, { completionRequested: true, completionRequestedAt: assignedAt, disputedAt: assignedAt }, { completionReviewPeriod: duration, disputeReviewPeriod: duration });
        expect(d.expiryTime >= 0n).toBe(true);
        expect(d.completionReviewEnd >= assignedAt).toBe(true);
      })
    );
  });

  it('URI sanitizer blocks dangerous schemes', () => {
    fc.assert(fc.property(fc.string(), (input) => {
      const sanitized = sanitizeUri(input);
      expect(sanitized.startsWith('javascript:') || sanitized.startsWith('data:') || sanitized.startsWith('file:') || sanitized.startsWith('blob:')).toBe(false);
    }));
  });

  it('role gating never permits applyForJob outside Open', () => {
    const s = deriveStatus({ assignedAgent: zero, assignedAt: 0n, duration: 0n, completed: true, disputed: false, expired: false }, { completionRequested: false, completionRequestedAt: 0n, disputedAt: 0n });
    expect(s.allowedActions.Agent.includes('applyForJob')).toBe(false);
  });

  it('decodes custom error names', () => {
    const e = decodeError({ details: 'execution reverted with custom error NotAuthorized' } as any);
    expect(e.name).toBe('NotAuthorized');
  });
});
