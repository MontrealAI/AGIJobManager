'use client';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useMemo, useState } from 'react';
import { useJobsList, usePlatformSummary } from '@/lib/web3/queries';
import { deriveJobUiStatus } from '@/lib/jobStatus';
import { fmtAddr, fmtToken, fmtTime } from '@/lib/format';

export default function Jobs() {
  const { data: p } = usePlatformSummary();
  const { data } = useJobsList();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => (data || []).filter((j: any) => String(j.id).includes(q) || j.employer.toLowerCase().includes(q.toLowerCase()) || j.agent.toLowerCase().includes(q.toLowerCase())), [data, q]);

  return <div className='container py-8 space-y-4'>
    <Card><label className='text-sm'>Filter by jobId/employer/agent</label><input className='w-full bg-transparent border border-border rounded p-2 mt-1' value={q} onChange={(e) => setQ(e.target.value)} /></Card>
    <Card><table className='w-full text-sm'><thead><tr><th>ID</th><th>Status</th><th>Payout</th><th>Employer</th><th>Agent</th><th>Next deadline</th></tr></thead><tbody>{filtered?.map((j: any) => {
      const s = deriveJobUiStatus({ assignedAgent: j.agent, assignedAt: j.assignedAt, duration: j.duration, completed: j.completed, disputed: j.disputed, expired: j.expired }, { completionRequested: j.completionRequested, completionRequestedAt: j.completionRequestedAt, disputedAt: j.disputedAt }, { completionReviewPeriod: p?.completionReviewPeriod || 0n, disputeReviewPeriod: p?.disputeReviewPeriod || 0n });
      return <tr key={j.id} className='border-t border-border hover:bg-muted/30'><td><Link href={`/jobs/${j.id}`}>{j.id}</Link></td><td>{s.label}</td><td>{fmtToken(j.payout)}</td><td>{fmtAddr(j.employer)}</td><td>{fmtAddr(j.agent)}</td><td>{fmtTime(s.nextDeadline)}</td></tr>;
    })}</tbody></table></Card>
  </div>;
}
