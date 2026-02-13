import { useQuery } from '@tanstack/react-query';
import { publicClient } from './publicClient';
import { CONTRACT_ADDRESS } from '../constants';
import { agiJobManagerAbi } from '@/abis/agiJobManager';
import { env } from '../env';
import { getScenario } from '@/lib/demo/scenarios';
import { jobsForScenario } from '@/demo/fixtures/jobs';

export function usePlatformSummary(scenarioId?: string) {
  return useQuery({
    queryKey: ['platform', scenarioId],
    queryFn: async () => {
      if (env.demoMode) {
        const s = getScenario(scenarioId);
        return {
          owner: '0x1111111111111111111111111111111111111111',
          paused: !!s.paused,
          settlementPaused: !!s.settlementPaused,
          nextJobId: BigInt(jobsForScenario(scenarioId).length),
          completionReviewPeriod: 86400n,
          disputeReviewPeriod: 172800n,
          voteQuorum: 3n,
          requiredValidatorApprovals: 2n,
          requiredValidatorDisapprovals: 2n,
          withdrawableAGI: 100000000000000000n,
          degradedRpc: !!s.degraded
        };
      }
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
    },
    retry: 2
  });
}

export function useJobs(scenarioId?: string) {
  return useQuery({
    queryKey: ['jobs', scenarioId],
    queryFn: async () => {
      if (env.demoMode) return jobsForScenario(scenarioId);
      const nextJobId = Number(await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'nextJobId' }));
      const contracts = Array.from({ length: nextJobId }, (_, i) => ({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobCore' as const, args: [BigInt(i)] }));
      const vals = Array.from({ length: nextJobId }, (_, i) => ({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobValidation' as const, args: [BigInt(i)] }));
      const [cores, validations] = await Promise.all([publicClient.multicall({ contracts, allowFailure: true }), publicClient.multicall({ contracts: vals, allowFailure: true })]);
      return cores.map((c, i) => ({ c, v: validations[i], i })).filter((x) => x.c.status === 'success').map((x) => ({ id: x.i, core: x.c.result, val: x.v.status === 'success' ? x.v.result : [false, 0n, 0n, 0n, 0n], spec: '', completion: '' }));
    }
  });
}

export function useJob(jobId: bigint, scenarioId?: string) {
  return useQuery({
    queryKey: ['job', String(jobId), scenarioId],
    queryFn: async () => {
      if (env.demoMode) return jobsForScenario(scenarioId).find((job) => job.id === Number(jobId));
      const [core, val, spec, completion] = await Promise.all([
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobCore', args: [jobId] }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobValidation', args: [jobId] }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobSpecURI', args: [jobId] }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobCompletionURI', args: [jobId] })
      ]);
      return { id: Number(jobId), core, val, spec, completion };
    }
  });
}
