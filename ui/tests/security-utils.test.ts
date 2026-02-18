import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { sanitizeUri } from '@/lib/web3/safeUri';
import { fmtToken, fmtTime } from '@/lib/format';

describe('URI safety', () => {
  it('normalizes safe ipfs and ens links', () => {
    expect(sanitizeUri('ipfs://bafybeigdyrzt').href).toBe('https://ipfs.io/ipfs/bafybeigdyrzt');
    expect(sanitizeUri('ens://agi-job.eth').href).toBe('https://app.ens.domains/name/agi-job.eth');
  });

  it('never emits clickable href for blocked schemes', () => {
    fc.assert(
      fc.property(fc.constantFrom('javascript:', 'data:', 'blob:', 'file:'), fc.string(), (scheme, payload) => {
        const verdict = sanitizeUri(`${scheme}${payload}`);
        expect(verdict.safe).toBe(false);
        expect(verdict.href).toBeUndefined();
      })
    );
  });
});

describe('formatting robustness', () => {
  it('formats uint256-like values without throwing', () => {
    fc.assert(
      fc.property(fc.bigUintN(256), (value) => {
        expect(() => fmtToken(value, 18)).not.toThrow();
      })
    );
  });

  it('formats timestamps deterministically for large values', () => {
    expect(fmtTime(0n)).toBe('—');
    expect(fmtTime(1n)).toContain('1970-01-01T00:00:01.000Z');
  });
});
