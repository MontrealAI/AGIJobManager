import { useQuery } from '@tanstack/react-query';
import { publicClient } from './publicClient';
import { CONTRACT_ADDRESS } from '../constants';
import { agiJobManagerAbi } from '@/abis/agiJobManager';
import { env } from '../env';
import { demoJobs, demoPlatform } from '@/demo/fixtures/jobs';

export function usePlatformSummary() {
  return useQuery({
    queryKey: ['platform', env.demoMode, env.demoRpcError],
    retry: 2,
    queryFn: async () => {
      if (env.demoMode) {
        if (env.demoRpcError) throw new Error('Demo degraded RPC');
        return { ...demoPlatform };
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
      return { owner, paused, settlementPaused, nextJobId, completionReviewPeriod, disputeReviewPeriod, voteQuorum, requiredValidatorApprovals, requiredValidatorDisapprovals, withdrawableAGI };
    }
  });
}

export function useJobsList() {
  return useQuery({
    queryKey: ['jobs-list', env.demoMode],
    queryFn: async () => {
      if (env.demoMode) return demoJobs;
      const nextJobId = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'nextJobId' });
      const n = Number(nextJobId);
      const contracts = Array.from({ length: n }, (_, i) => ({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobCore' as const, args: [BigInt(i)] }));
      const vals = Array.from({ length: n }, (_, i) => ({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobValidation' as const, args: [BigInt(i)] }));
      const [cores, validations] = await Promise.all([publicClient.multicall({ contracts, allowFailure: true }), publicClient.multicall({ contracts: vals, allowFailure: true })]);
      return cores.map((c, i) => ({ c, v: validations[i], i })).filter((x) => x.c.status === 'success').map((x: any) => ({
        id: x.i,
        employer: x.c.result[0],
        agent: x.c.result[1],
        payout: x.c.result[2],
        duration: x.c.result[3],
        assignedAt: x.c.result[4],
        completed: x.c.result[5],
        disputed: x.c.result[6],
        expired: x.c.result[7],
        completionRequested: x.v.status === 'success' ? x.v.result[0] : false,
        completionRequestedAt: x.v.status === 'success' ? x.v.result[3] : 0n,
        disputedAt: x.v.status === 'success' ? x.v.result[4] : 0n,
        spec: '',
        completion: '',
        role: 'Viewer'
      }));
    }
  });
}

export function useJob(jobId: bigint) {
  return useQuery({
    queryKey: ['job', String(jobId), env.demoMode],
    queryFn: async () => {
      if (env.demoMode) {
        const found = demoJobs.find((j) => j.id === Number(jobId));
        if (!found) throw new Error('Missing demo fixture');
        return {
          core: [found.employer, found.agent, found.payout, found.duration, found.assignedAt, found.completed, found.disputed, found.expired],
          val: [found.completionRequested, 0n, 0n, found.completionRequestedAt, found.disputedAt],
          spec: found.spec,
          completion: found.completion,
          role: found.role
        };
      }
      const [core, val, spec, completion] = await Promise.all([
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobCore', args: [jobId] }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobValidation', args: [jobId] }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobSpecURI', args: [jobId] }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobCompletionURI', args: [jobId] })
      ]);
      return { core, val, spec, completion, role: 'Viewer' };
    }
  });
}
