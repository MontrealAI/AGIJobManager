import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { deriveStatus, computeDeadlines, getActionGate } from '@/lib/jobStatus';
import { sanitizeUri } from '@/lib/web3/safeUri';
import { decodeError } from '@/lib/web3/errors';

const Z = '0x0000000000000000000000000000000000000000' as const;

describe('status invariants', () => {
  it('terminal states are mutually exclusive', () => {
    fc.assert(fc.property(fc.boolean(), fc.boolean(), (completed, expired) => {
      const s = deriveStatus({ assignedAgent: Z, assignedAt: 0n, duration: 0n, completed, disputed: false, expired }, { completionRequested: false, completionRequestedAt: 0n, disputedAt: 0n });
      if (completed) expect(s.status).toBe('Settled');
      if (!completed && expired) expect(s.status).toBe('Expired');
    }));
  });

  it('action gating requires valid status', () => {
    const gate = getActionGate('Open', 'Agent');
    expect(gate.applyForJob).toBe(true);
    expect(gate.requestJobCompletion).toBe(false);
  });
});

describe('deadline fuzz', () => {
  it('non-negative and monotonic', () => {
    fc.assert(fc.property(fc.bigUint(), fc.bigUint(), (assignedAt, duration) => {
      const d = computeDeadlines({ assignedAgent: Z, assignedAt, duration, completed: false, disputed: false, expired: false }, { completionRequested: true, completionRequestedAt: assignedAt, disputedAt: assignedAt }, { completionReviewPeriod: duration, disputeReviewPeriod: duration });
      expect(d.expiryTime >= 0n).toBe(true);
      expect(d.completionReviewEnd >= assignedAt).toBe(true);
    }));
  });
});

describe('uri sanitizer fuzz', () => {
  it('allowlist only', () => {
    fc.assert(fc.property(fc.string(), (s) => {
      const out = sanitizeUri(s);
      if (out.safe) expect(/^(https?:|ipfs:|ens:)/.test(s.toLowerCase())).toBe(true);
    }));
  });
});

describe('error decoding', () => {
  it('maps custom errors', () => {
    const e = decodeError(new Error('execution reverted: NotAuthorized'));
    expect(e.human).toContain('lacks required role');
  });
});
