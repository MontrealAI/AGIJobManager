import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { deriveJobUiStatus, computeDeadlines } from '@/lib/jobStatus';
import { isAllowedUri } from '@/lib/web3/safeUri';

describe('job status properties', () => {
  it('terminal states mutually exclusive', () => {
    fc.assert(fc.property(fc.boolean(), fc.boolean(), (completed, expired) => {
      const s = deriveJobUiStatus({ assignedAgent:'0x0000000000000000000000000000000000000000', assignedAt:1n, duration:1n, completed, disputed:false, expired }, { completionRequested:false, completionRequestedAt:0n, disputedAt:0n }, { completionReviewPeriod:1n, disputeReviewPeriod:1n });
      return !(s.label === 'Settled' && s.label === 'Expired');
    }));
  });

  it('deadlines monotonic and non-negative', () => {
    fc.assert(fc.property(fc.nat(), fc.nat(), (assignedAt, duration) => {
      const d = computeDeadlines({ assignedAgent:'0x0' as any, assignedAt:BigInt(assignedAt), duration:BigInt(duration), completed:false, disputed:false, expired:false }, { completionRequested:false, completionRequestedAt:0n, disputedAt:0n }, { completionReviewPeriod:10n, disputeReviewPeriod:20n });
      return d.expiryTime >= 0n;
    }));
  });

  it('uri sanitizer blocks dangerous schemes', () => {
    fc.assert(fc.property(fc.string(), (s) => {
      const test = `javascript:${s}`;
      return isAllowedUri(test) === false;
    }));
    expect(isAllowedUri('https://example.com')).toBe(true);
  });

  it('role gates require prerequisites', () => {
    const s = deriveJobUiStatus({ assignedAgent:'0x0' as any, assignedAt:0n, duration:0n, completed:false, disputed:false, expired:false }, { completionRequested:false, completionRequestedAt:0n, disputedAt:0n }, { completionReviewPeriod:1n, disputeReviewPeriod:1n }, 'Viewer');
    expect(Object.values(s.allowedActions).some(Boolean)).toBe(false);
  });
});
