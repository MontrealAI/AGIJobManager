import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { deriveStatus, computeDeadlines, deriveJobView } from '@/lib/jobStatus';
import { sanitizeUri } from '@/lib/web3/safeUri';

describe('job status properties', () => {
  it('terminal states are mutually exclusive', () => {
    fc.assert(fc.property(fc.boolean(), fc.boolean(), (completed, expired) => {
      const s = deriveStatus({ assignedAgent: '0x0000000000000000000000000000000000000000', assignedAt: 0n, duration: 0n, completed, expired, disputed: false }, { completionRequested: false, completionRequestedAt: 0n, disputedAt: 0n });
      if (completed) expect(s.status).toBe('Settled');
      if (!completed && expired) expect(s.status).toBe('Expired');
      expect(!(s.status === 'Settled' && s.status === 'Expired')).toBe(true);
    }));
  });

  it('deadlines monotonic and non-negative', () => {
    fc.assert(fc.property(fc.nat(), fc.nat(), fc.nat(), (a, b, c) => {
      const assignedAt = BigInt(a);
      const duration = BigInt(b);
      const completionRequestedAt = BigInt(c);
      const d = computeDeadlines({ assignedAgent: '0x0000000000000000000000000000000000000000', assignedAt, duration, completed: false, disputed: false, expired: false }, { completionRequested: completionRequestedAt > 0n, completionRequestedAt, disputedAt: completionRequestedAt }, { completionReviewPeriod: 10n, disputeReviewPeriod: 20n });
      expect(d.expiryTime).toBeGreaterThanOrEqual(0n);
      expect(d.completionReviewEnd).toBeGreaterThanOrEqual(completionRequestedAt);
      expect(d.disputeReviewEnd).toBeGreaterThanOrEqual(completionRequestedAt);
    }));
  });

  it('uri sanitizer blocks dangerous schemes', () => {
    fc.assert(fc.property(fc.string(), (input) => {
      const safe = sanitizeUri(input);
      const lowered = input.toLowerCase();
      if (lowered.startsWith('javascript:') || lowered.startsWith('data:') || lowered.startsWith('file:') || lowered.startsWith('blob:')) {
        expect(safe.safe).toBe(false);
      }
    }));
  });

  it('role gating prerequisites', () => {
    const view = deriveJobView({ assignedAgent: '0x0000000000000000000000000000000000000000', assignedAt: 0n, duration: 0n, completed: false, disputed: false, expired: false }, { completionRequested: false, completionRequestedAt: 0n, disputedAt: 0n }, { completionReviewPeriod: 1n, disputeReviewPeriod: 1n });
    expect(view.allowedActions.validator.includes('validateJob')).toBe(false);
  });
});
