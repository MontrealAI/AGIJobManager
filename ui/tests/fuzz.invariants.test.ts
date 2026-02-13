import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { computeDeadlines, deriveStatus, getActionGate, type JobCore, type JobValidation } from '@/lib/jobStatus';
import { sanitizeUri } from '@/lib/web3/safeUri';
import { decodeError, translateError } from '@/lib/web3/errors';

const ZERO = '0x0000000000000000000000000000000000000000' as const;

const buildCore = (overrides: Partial<JobCore> = {}): JobCore => ({
  assignedAgent: ZERO,
  duration: 1n,
  assignedAt: 1n,
  completed: false,
  disputed: false,
  expired: false,
  ...overrides
});

const buildValidation = (overrides: Partial<JobValidation> = {}): JobValidation => ({
  completionRequested: false,
  completionRequestedAt: 0n,
  disputedAt: 0n,
  ...overrides
});

describe('status/action invariants', () => {
  it('terminal statuses are not action-enabled for actors', () => {
    const roles = ['Employer', 'Agent', 'Validator', 'Moderator', 'Owner'] as const;
    const terminals = ['Settled', 'Expired'] as const;

    for (const role of roles) {
      for (const status of terminals) {
        const gate = getActionGate(status, role);
        const enabled = Object.values(gate).some(Boolean);
        if (role === 'Owner' && status === 'Settled') {
          expect(gate.lockJobENS).toBe(true);
        } else {
          expect(enabled).toBe(false);
        }
      }
    }
  });

  it('deriveStatus returns Completion Requested iff completion flag set and not terminal/disputed', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (completed, expired, disputed) => {
        const status = deriveStatus(
          buildCore({ completed, expired, disputed, assignedAgent: '0x0000000000000000000000000000000000000001' }),
          buildValidation({ completionRequested: true })
        ).status;

        if (!completed && !expired && !disputed) {
          expect(status).toBe('Completion Requested');
        }
      })
    );
  });
});

describe('deadline invariants', () => {
  it('computed windows are monotonic around boundary timestamps', () => {
    fc.assert(
      fc.property(fc.bigUint({ max: 10_000_000n }), fc.bigUint({ max: 10_000_000n }), (at, period) => {
        const deadlines = computeDeadlines(
          buildCore({ assignedAt: at, duration: period }),
          buildValidation({ completionRequestedAt: at, disputedAt: at }),
          { completionReviewPeriod: period, disputeReviewPeriod: period }
        );

        expect(deadlines.expiryTime).toBeGreaterThanOrEqual(0n);
        expect(deadlines.completionReviewEnd).toBeGreaterThanOrEqual(0n);
        expect(deadlines.disputeReviewEnd).toBeGreaterThanOrEqual(0n);

        if (period > 0n) {
          expect(deadlines.expiryTime).toBeGreaterThanOrEqual(at);
          expect(deadlines.completionReviewEnd).toBeGreaterThanOrEqual(at);
          expect(deadlines.disputeReviewEnd).toBeGreaterThanOrEqual(at);
        }
      })
    );
  });
});

describe('uri sanitizer invariants', () => {
  it('never marks blocked schemes as safe', () => {
    fc.assert(
      fc.property(fc.constantFrom('javascript:', 'data:', 'file:', 'blob:'), fc.string(), (scheme, suffix) => {
        const verdict = sanitizeUri(`${scheme}${suffix}`);
        expect(verdict.safe).toBe(false);
      })
    );
  });
});

describe('error translation invariants', () => {
  it('includes known custom error names in translated output', () => {
    for (const name of ['InvalidParameters', 'InvalidState', 'NotAuthorized', 'SettlementPaused']) {
      expect(translateError(name)).toContain(name);
    }
  });

  it('decodeError does not throw on long random payloads', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 2048 }), (msg) => {
        const decoded = decodeError(new Error(msg));
        expect(typeof decoded.name).toBe('string');
        expect(typeof decoded.human).toBe('string');
      })
    );
  });
});
