import { useQuery } from '@tanstack/react-query';
import { publicClient } from './publicClient';
import { CONTRACT_ADDRESS } from '../constants';
import { agiJobManagerAbi } from '@/abis/agiJobManager';
import { env } from '@/lib/env';
import { demoJobs, demoPlatform } from '@/demo/fixtures/jobs';

export function usePlatformSummary() {
  return useQuery({
    queryKey: ['platform', env.demoMode, env.simulateRpcError],
    queryFn: async () => {
      if (env.demoMode) {
        if (env.simulateRpcError) throw new Error('Simulated RPC degradation');
        return demoPlatform;
      }
      const [owner, paused, settlementPaused, nextJobId, completionReviewPeriod, disputeReviewPeriod, voteQuorum, requiredValidatorApprovals, requiredValidatorDisapprovals, withdrawableAGI, blockNumber] = await Promise.all([
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'owner' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'paused' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'settlementPaused' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'nextJobId' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'completionReviewPeriod' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'disputeReviewPeriod' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'voteQuorum' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'requiredValidatorApprovals' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'requiredValidatorDisapprovals' }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'withdrawableAGI' }),
        publicClient.getBlockNumber()
      ]);
      return { owner, paused, settlementPaused, nextJobId, completionReviewPeriod, disputeReviewPeriod, voteQuorum, requiredValidatorApprovals, requiredValidatorDisapprovals, withdrawableAGI, degradedRpc: false, lastSuccessfulBlock: blockNumber };
    }
  });
}

export function useJobs() {
  return useQuery({
    queryKey: ['jobs', env.demoMode],
    queryFn: async () => {
      if (env.demoMode) return demoJobs;
      const nextJobId = Number(await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'nextJobId' }));
      const contracts = Array.from({ length: nextJobId }, (_, i) => ({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobCore' as const, args: [BigInt(i)] }));
      const vals = Array.from({ length: nextJobId }, (_, i) => ({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobValidation' as const, args: [BigInt(i)] }));
      const [cores, validations] = await Promise.all([publicClient.multicall({ contracts, allowFailure: true }), publicClient.multicall({ contracts: vals, allowFailure: true })]);
      return cores
        .map((c, i) => ({ c, v: validations[i], i }))
        .filter((x) => x.c.status === 'success')
        .map((x) => ({ id: BigInt(x.i), core: x.c.result, val: x.v.status === 'success' ? x.v.result : [false, 0n, 0n, 0n, 0n], spec: '', completion: '', timeline: [] }));
    }
  });
}

export function useJob(jobId: bigint) {
  return useQuery({
    queryKey: ['job', String(jobId), env.demoMode],
    queryFn: async () => {
      if (env.demoMode) {
        const found = demoJobs.find((x) => x.id === jobId);
        if (!found) throw new Error('Job not found');
        return found;
      }
      const [core, val, spec, completion] = await Promise.all([
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobCore', args: [jobId] }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobValidation', args: [jobId] }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobSpecURI', args: [jobId] }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobCompletionURI', args: [jobId] })
      ]);
      return { id: jobId, core, val, spec, completion, timeline: [] };
    }
  });
}
