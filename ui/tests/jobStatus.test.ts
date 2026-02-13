import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { deriveStatus, computeDeadlines, actionGates } from '@/lib/jobStatus';
import { isAllowedUri } from '@/lib/web3/safeUri';
import { decodeKnownErrorName, toUserFacingError } from '@/lib/web3/errors';

const zero = '0x0000000000000000000000000000000000000000' as const;

describe('job status invariants', () => {
  it('terminal states mutually exclusive', () => {
    const status = deriveStatus({ assignedAgent: zero, assignedAt: 0n, duration: 0n, completed: true, disputed: true, expired: true }, { completionRequested: true, completionRequestedAt: 1n, disputedAt: 1n });
    expect(status.status).toBe('Settled');
    expect(status.terminal).toBe(true);
  });

  it('action gating never enables completion for open jobs', () => {
    fc.assert(fc.property(fc.constantFrom<'Open' | 'Assigned' | 'Completion Requested' | 'Disputed' | 'Settled' | 'Expired'>('Open','Assigned','Completion Requested','Disputed','Settled','Expired'), (s) => {
      const gates = actionGates(s);
      if (s === 'Open') expect(gates.canRequestCompletion).toBe(false);
    }));
  });

  it('deadline math is monotonic and non-negative', () => {
    fc.assert(fc.property(fc.bigUint(), fc.bigUint(), fc.bigUint(), (assignedAt, duration, review) => {
      const d = computeDeadlines({ assignedAgent: zero, assignedAt, duration, completed: false, disputed: false, expired: false }, { completionRequested: true, completionRequestedAt: assignedAt, disputedAt: assignedAt }, { completionReviewPeriod: review, disputeReviewPeriod: review });
      expect(d.expiryTime >= 0n).toBe(true);
      expect(d.completionReviewEnd >= assignedAt).toBe(true);
    }));
  });

  it('uri sanitizer fuzz', () => {
    fc.assert(fc.property(fc.string(), (value) => {
      const allowed = isAllowedUri(value);
      if (allowed) expect(/^(https?:\/\/|ipfs:\/\/|ens:\/\/)/i.test(value.trim())).toBe(true);
    }));
  });

  it('error decode maps to user friendly messages', () => {
    expect(decodeKnownErrorName('execution reverted: NotAuthorized')).toBe('NotAuthorized');
    expect(toUserFacingError('execution reverted: InvalidState')).toContain('state');
  });
});
