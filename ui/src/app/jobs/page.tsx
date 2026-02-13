'use client';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useJobs, usePlatformSummary } from '@/lib/web3/queries';
import { deriveJobView } from '@/lib/jobStatus';
import { fmtAddr, fmtToken, fmtTime } from '@/lib/format';

export default function Jobs() {
  const { data: p } = usePlatformSummary();
  const { data } = useJobs();
  return (
    <div className='container py-8'>
      <Card>
        <table className='w-full text-sm'>
          <thead><tr><th>ID</th><th>Status</th><th>Payout</th><th>Employer</th><th>Agent</th><th>Next deadline</th></tr></thead>
          <tbody>
            {data?.map((j: any) => {
              const s = deriveJobView(
                { assignedAgent: j.core[1], assignedAt: j.core[4], duration: j.core[3], completed: j.core[5], disputed: j.core[6], expired: j.core[7] },
                { completionRequested: j.val[0], completionRequestedAt: j.val[3], disputedAt: j.val[4] },
                { completionReviewPeriod: p?.completionReviewPeriod ?? 0n, disputeReviewPeriod: p?.disputeReviewPeriod ?? 0n }
              );
              return <tr key={String(j.id)} className='border-t border-border hover:bg-muted/30'><td><Link href={`/jobs/${j.id}`}>{String(j.id)}</Link></td><td><span data-testid={`status-${String(j.id)}`}>{s.label}</span></td><td>{fmtToken(j.core[2])}</td><td>{fmtAddr(j.core[0])}</td><td>{fmtAddr(j.core[1])}</td><td>{fmtTime(s.nextDeadline)}</td></tr>;
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
