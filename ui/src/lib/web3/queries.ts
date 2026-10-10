import { useQuery } from '@tanstack/react-query';
import { publicClient } from './publicClient';
import { CHAIN_ID, CONTRACT_ADDRESS } from '../constants';
import type { DemoJob, DemoScenario } from '@/demo/fixtures/scenarios';
import { isDemoMode } from '@/lib/demo';
import { JOB_PAGE_SIZE, parseJobId, readJob, readJobPage, readPlatform } from './job-reader';

const target = { address: CONTRACT_ADDRESS, chainId: CHAIN_ID };
const scope = [CHAIN_ID, CONTRACT_ADDRESS.toLowerCase()];
const mode = (scenario?: DemoScenario) => isDemoMode && scenario ? scenario.key : 'live';

export function usePlatformSummary(scenario?: DemoScenario) {
  return useQuery({
    queryKey: ['platform', ...scope, mode(scenario)],
    queryFn: () => isDemoMode && scenario ? Promise.resolve(scenario) : readPlatform(publicClient, target),
  });
}

export function useJobs(scenario?: DemoScenario, before?: bigint) {
  return useQuery({
    queryKey: ['jobs', ...scope, mode(scenario), before?.toString() ?? 'newest'],
    queryFn: async () => {
      if (isDemoMode && scenario) {
        const end = before ?? scenario.nextJobId;
        const start = end > BigInt(JOB_PAGE_SIZE) ? end - BigInt(JOB_PAGE_SIZE) : 0n;
        const jobs = scenario.jobs.filter((j): j is DemoJob => !!j)
          .filter(j => BigInt(j.id) >= start && BigInt(j.id) < end)
          .sort((a, b) => b.id - a.id).map(j => ({ ...j, id: BigInt(j.id), deadlines: [] as readonly bigint[] }));
        return { jobs, total: scenario.nextJobId, start, end, blockNumber: null, olderCursor: start > 0n ? start : null };
      }
      return readJobPage(publicClient, target, before);
    },
  });
}

export function useJob(jobId: string, scenario?: DemoScenario) {
  return useQuery({
    queryKey: ['job', ...scope, mode(scenario), jobId],
    queryFn: async () => {
      const id = parseJobId(jobId);
      if (isDemoMode && scenario) {
        const j = scenario.jobs.find(j => j && BigInt(j.id) === id);
        return { job: j ? { ...j, id, deadlines: [] as readonly bigint[] } : null, platform: scenario, blockNumber: null };
      }
      return readJob(publicClient, target, jobId);
    },
  });
}
