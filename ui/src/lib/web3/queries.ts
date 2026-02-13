import { useQuery } from '@tanstack/react-query';
import { publicClient } from './publicClient';
import { CONTRACT_ADDRESS } from '../constants';
import { agiJobManagerAbi } from '@/abis/agiJobManager';
import type { DemoScenario } from '@/demo/fixtures/scenarios';
import { isDemoMode } from '@/lib/demo';

export function usePlatformSummary(scenario?: DemoScenario) {
  return useQuery({
    queryKey: ['platform', scenario?.key ?? 'live'],
    queryFn: async () => {
      if (isDemoMode && scenario) return scenario;
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

export function useJobs(scenario?: DemoScenario) {
  return useQuery({
    queryKey: ['jobs', scenario?.key ?? 'live'],
    queryFn: async () => {
      if (isDemoMode && scenario) return scenario.jobs.filter(Boolean);
      const nextJobId = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'nextJobId' });
      const n = Number(nextJobId || 0n);
      const contracts = Array.from({ length: n }, (_, i) => ({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobCore' as const, args: [BigInt(i)] }));
      const vals = Array.from({ length: n }, (_, i) => ({ address: CONTRACT_ADDRESS, abi: agiJobManagerAbi, functionName: 'getJobValidation' as const, args: [BigInt(i)] }));
      const [cores, validations] = await Promise.all([publicClient.multicall({ contracts, allowFailure: true }), publicClient.multicall({ contracts: vals, allowFailure: true })]);
      return cores.map((c, i) => ({ c, v: validations[i], i })).filter((x) => x.c.status === 'success' && x.c.result).map((x) => {
        const r = x.c.result as readonly any[];
        return {
          id: x.i,
          employer: r[0],
          agent: r[1],
          payout: r[2],
          duration: r[3],
          assignedAt: r[4],
          completed: r[5],
          disputed: r[6],
          expired: r[7],
          completionRequested: x.v.status === 'success' ? x.v.result[0] : false,
          completionRequestedAt: x.v.status === 'success' ? x.v.result[3] : 0n,
          disputedAt: x.v.status === 'success' ? x.v.result[4] : 0n,
          specUri: '',
          completionUri: ''
        };
      });
    }
  });
}
