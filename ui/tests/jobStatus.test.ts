import { describe, it, expect } from 'vitest';
import { deriveStatus, computeDeadlines } from '@/lib/jobStatus';
import { isAllowedUri } from '@/lib/web3/safeUri';
import { fmtAddr } from '@/lib/format';

describe('status',()=>{
  it('terminal mutually exclusive',()=>{
    const settled=deriveStatus({assignedAgent:'0x0000000000000000000000000000000000000000',assignedAt:0n,duration:0n,completed:true,disputed:true,expired:true},{completionRequested:true,completionRequestedAt:0n,disputedAt:0n});
    expect(settled.status).toBe('Settled'); expect(settled.terminal).toBe(true);
  });
  it('deadline zero edge',()=>{const d=computeDeadlines({assignedAgent:'0x0000000000000000000000000000000000000000',assignedAt:0n,duration:0n,completed:false,disputed:false,expired:false},{completionRequested:false,completionRequestedAt:0n,disputedAt:0n},{completionReviewPeriod:0n,disputeReviewPeriod:0n}); expect(d.expiryTime).toBe(0n);});
  it('uri allowlist',()=>{expect(isAllowedUri('https://x.com')).toBe(true); expect(isAllowedUri('javascript:alert(1)')).toBe(false);});
  it('format helpers',()=>{expect(fmtAddr('0x1234567890123456789012345678901234567890')).toBe('0x1234...7890');});
});
