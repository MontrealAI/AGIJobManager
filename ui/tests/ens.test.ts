import { describe, expect, it } from 'vitest';
import { deriveJobEnsName, deriveJobIdentitySnapshot } from '@/lib/ens';

describe('ENS identity derivation', () => {
  it('derives a deterministic default ENS name', () => {
    expect(deriveJobEnsName(42)).toBe('job-42.jobs.agi.eth');
  });

  it('normalizes namespace casing and whitespace', () => {
    expect(deriveJobEnsName('7', ' Jobs.AGI.ETH ')).toBe('job-7.jobs.agi.eth');
  });

  it('creates read-only snapshot payloads for agent mode export', () => {
    expect(deriveJobIdentitySnapshot(3)).toEqual({
      jobId: '3',
      ensName: 'job-3.jobs.agi.eth',
      profileUri: 'ens://job-3.jobs.agi.eth',
      records: {
        textDescription: 'AGIJobManager job 3',
        contentHash: null
      }
    });
  });
});
