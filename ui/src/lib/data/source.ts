import { useQuery } from '@tanstack/react-query';
import { demoJobs, demoPlatform } from '@/demo/fixtures/jobs';
import { useJob, usePlatformSummary } from '@/lib/web3/queries';

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === '1';

export function usePlatformData() {
  const live = usePlatformSummary();
  const demo = useQuery({ queryKey: ['demo-platform'], queryFn: async () => demoPlatform, enabled: isDemoMode });
  return isDemoMode ? demo : live;
}

export function useJobData(jobId: bigint) {
  const live = useJob(jobId);
  const demo = useQuery({
    queryKey: ['demo-job', String(jobId)],
    queryFn: async () => demoJobs.find((j) => j.id === jobId),
    enabled: isDemoMode
  });
  return isDemoMode ? demo : live;
}

export function useJobsData() {
  return useQuery({
    queryKey: ['jobs-data', isDemoMode],
    queryFn: async () => (isDemoMode ? demoJobs : [])
  });
}
