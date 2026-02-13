import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { deriveStatus, computeDeadlines } from '@/lib/jobStatus';
import { isAllowedUri } from '@/lib/web3/safeUri';

const addr = '0x0000000000000000000000000000000000000000' as const;

describe('job status properties', () => {
  it('terminal states mutually exclusive', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (completed, expired) => {
        const s = deriveStatus(
          { assignedAgent: addr, assignedAt: 0n, duration: 0n, completed, disputed: false, expired },
          { completionRequested: false, completionRequestedAt: 0n, disputedAt: 0n }
        );
        expect(['Settled','Expired'].includes(s.status) ? s.isTerminal : !s.isTerminal).toBe(true);
      })
    );
  });

  it('deadlines are monotonic and non-negative', () => {
    fc.assert(
      fc.property(fc.nat(), fc.nat(), (assignedAt, duration) => {
        const d = computeDeadlines(
          { assignedAgent: addr, assignedAt: BigInt(assignedAt), duration: BigInt(duration), completed: false, disputed: false, expired: false },
          { completionRequested: false, completionRequestedAt: 0n, disputedAt: 0n },
          { completionReviewPeriod: 10n, disputeReviewPeriod: 20n }
        );
        expect(d.expiryTime).toBeGreaterThanOrEqual(0n);
if (duration > 0) expect(d.expiryTime).toBeGreaterThanOrEqual(BigInt(assignedAt));
      })
    );
  });

  it('uri sanitizer blocks dangerous schemes', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const blocked = ['javascript:', 'data:', 'file:', 'blob:'];
        for (const b of blocked) expect(isAllowedUri(`${b}${s}`)).toBe(false);
      })
    );
  });

  it('role gating denies actions on terminal states', () => {
    const settled = deriveStatus(
      { assignedAgent: addr, assignedAt: 0n, duration: 0n, completed: true, disputed: false, expired: false },
      { completionRequested: true, completionRequestedAt: 0n, disputedAt: 0n }
    );
    expect(Object.values(settled.allowedActions).flat().length).toBe(0);
  });
});
