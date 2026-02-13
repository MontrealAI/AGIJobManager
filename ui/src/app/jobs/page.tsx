'use client';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useJobs } from '@/lib/web3/queries';
import { deriveStatus } from '@/lib/jobStatus';
import { fmtAddr, fmtToken, fmtTime } from '@/lib/format';
import { useMemo, useState } from 'react';

export default function Jobs() {
  const { data } = useJobs();
  const [search, setSearch] = useState('');
  const rows = useMemo(() => (data || []).filter((j) => { const core = (j as any).core || []; return String((j as any).id).includes(search) || String(core[0] || '').includes(search) || String(core[1] || '').includes(search); }), [data, search]);

  return <div className='container py-8 space-y-4'>
    <Card>
      <div className='flex justify-between items-center mb-3'>
        <h1 className='font-serif text-2xl'>Jobs Ledger</h1>
        <input aria-label='search jobs' className='bg-background border border-input rounded-md p-2 text-sm' placeholder='Search by id/employer/agent' value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <table className='w-full text-sm'>
        <thead><tr><th className='text-left'>Job ID</th><th>Status</th><th>Payout</th><th>Employer</th><th>Agent</th><th>Next deadline</th></tr></thead>
        <tbody>{rows.map((j: any) => {
          const s = deriveStatus({ assignedAgent: j.core[1], assignedAt: j.core[4], duration: j.core[3], completed: j.core[5], disputed: j.core[6], expired: j.core[7] }, { completionRequested: j.val[0], completionRequestedAt: j.val[3], disputedAt: j.val[4] }, { completionReviewPeriod: 86400n, disputeReviewPeriod: 172800n });
          return <tr key={String(j.id)} className='border-t border-border hover:bg-muted/30'>
            <td><Link className='underline' href={`/jobs/${j.id}`}>{String(j.id)}</Link></td>
            <td>{s.label}</td>
            <td>{fmtToken(j.core[2])}</td>
            <td>{fmtAddr(j.core[0])}</td>
            <td>{fmtAddr(j.core[1])}</td>
            <td>{fmtTime(s.nextDeadline || 0n)}</td>
          </tr>;
        })}</tbody>
      </table>
    </Card>
  </div>;
}
