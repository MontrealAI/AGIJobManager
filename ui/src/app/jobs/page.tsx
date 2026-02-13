'use client';
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useMemo, useState } from 'react';
import { currentScenario, toCsv } from '@/lib/demo';
import { deriveStatus } from '@/lib/jobStatus';

export default function JobsPage() {
  const scenario = currentScenario(typeof window !== "undefined" ? window.location.search : "");
  const [search, setSearch] = useState('');

  const jobs = useMemo(() => scenario.jobs.filter((j) => !j.deleted).filter((j) => {
    const status = deriveStatus({ assignedAgent: j.agent, assignedAt: j.assignedAt, duration: j.duration, completed: j.completed, disputed: j.disputed, expired: j.expired }, { completionRequested: j.completionRequested, completionRequestedAt: j.completionRequestedAt, disputedAt: j.disputedAt }).status;
    const q = search.toLowerCase();
    return `${j.id}${j.employer}${j.agent}${status}`.toLowerCase().includes(q);
  }), [scenario, search]);

  const csv = toCsv(jobs.map((j) => ({ id: j.id, employer: j.employer, agent: j.agent, payout: j.payout.toString() })));

  return (
    <div className='container py-8 space-y-4'>
      <Card>
        <div className='flex items-center justify-between gap-3'>
          <input aria-label='search-jobs' className='w-full rounded-md border bg-background px-3 py-2' placeholder='Search by id/employer/agent/status' value={search} onChange={(e) => setSearch(e.target.value)} />
          <button data-testid='csv-export' data-csv={csv} className='rounded-md border px-3 py-2 text-sm'>Export CSV</button>
        </div>
      </Card>
      <Card>
        <table className='w-full text-sm'>
          <thead><tr><th>Job ID</th><th>Status</th><th>Payout</th><th>Employer</th><th>Agent</th><th>Next deadline</th></tr></thead>
          <tbody>
            {jobs.map((j) => {
              const status = deriveStatus({ assignedAgent: j.agent, assignedAt: j.assignedAt, duration: j.duration, completed: j.completed, disputed: j.disputed, expired: j.expired }, { completionRequested: j.completionRequested, completionRequestedAt: j.completionRequestedAt, disputedAt: j.disputedAt }).status;
              return <tr key={j.id} className='border-t border-border/80'><td><Link className='underline' href={`/jobs/${j.id}?scenario=${scenario.key}`}>{j.id}</Link></td><td>{status}</td><td>{j.payout.toString()}</td><td>{j.employer}</td><td>{j.agent}</td><td>{(j.assignedAt + j.duration).toString()}</td></tr>;
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
