import { useQuery } from '@tanstack/react-query';
import { publicClient } from './publicClient';
import { CONTRACT_ADDRESS } from '../constants';
import { agiJobManagerAbi } from '@/abis/agiJobManager';
import { env } from '@/lib/env';
import { demoJobs, demoPlatform, demoTimeline } from '@/demo/fixtures/jobs';

export function usePlatformSummary() {
  return useQuery({
    queryKey: ['platform', env.demoMode],
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    queryFn: async () => {
      if (env.demoMode) return demoPlatform;
      const [owner, paused, settlementPaused, nextJobId, completionReviewPeriod, disputeReviewPeriod, voteQuorum, requiredValidatorApprovals, requiredValidatorDisapprovals, withdrawableAGI] = await Promise.all([
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'owner' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'paused' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'settlementPaused' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'nextJobId' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'completionReviewPeriod' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'disputeReviewPeriod' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'voteQuorum' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'requiredValidatorApprovals' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'requiredValidatorDisapprovals' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'withdrawableAGI' })
      ]);
      return { owner, paused, settlementPaused, nextJobId, completionReviewPeriod, disputeReviewPeriod, voteQuorum, requiredValidatorApprovals, requiredValidatorDisapprovals, withdrawableAGI, degradedRpc: false };
    }
  });
}

export function useJobs() {
  return useQuery({
    queryKey: ['jobs', env.demoMode],
    queryFn: async () => {
      if (env.demoMode) return demoJobs;
      const next = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'nextJobId' });
      const n = Number(next || 0n);
      const cores = await publicClient.multicall({
        contracts: Array.from({ length: n }, (_, i) => ({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobCore' as const, args: [BigInt(i)] })),
        allowFailure: true
      });
      const vals = await publicClient.multicall({
        contracts: Array.from({ length: n }, (_, i) => ({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobValidation' as const, args: [BigInt(i)] })),
        allowFailure: true
      });
      return cores
        .map((c, i) => ({ id: BigInt(i), core: c, val: vals[i] }))
        .filter((x) => x.core.status === 'success')
        .map((x) => ({ id: x.id, core: x.core.result, val: x.val.status === 'success' ? x.val.result : [false, 0n, 0n, 0n, 0n], spec: '', completion: '' }));
    }
  });
}

export function useJob(jobId: bigint) {
  return useQuery({
    queryKey: ['job', String(jobId), env.demoMode],
    queryFn: async () => {
      if (env.demoMode) {
        const found = demoJobs.find((j) => j.id === jobId);
        return {
          ...(found || demoJobs[0]),
          timeline: demoTimeline[String(jobId)] || []
        };
      }
      const [core, val, spec, completion] = await Promise.all([
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobCore', args: [jobId] }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobValidation', args: [jobId] }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobSpecURI', args: [jobId] }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobCompletionURI', args: [jobId] })
      ]);
      return { core, val, spec, completion, timeline: [] };
    }
  });
}
