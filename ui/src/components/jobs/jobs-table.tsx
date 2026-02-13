'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { DemoScenario } from '@/demo/types';
import { deriveStatus, computeDeadlines } from '@/lib/jobStatus';
import { fmtAddr, fmtToken, fmtTime } from '@/lib/format';

export function JobsTable({ scenario }: { scenario: DemoScenario }) {
  const [query, setQuery] = useState('');
  const rows = useMemo(
    () =>
      scenario.jobs
        .filter(Boolean)
        .map((job) => {
          const j = job!;
          const status = deriveStatus(
            {
              assignedAgent: j.core.assignedAgent,
              assignedAt: j.core.assignedAt,
              duration: j.core.duration,
              completed: j.core.completed,
              disputed: j.core.disputed,
              expired: j.core.expired
            },
            {
              completionRequested: j.validation.completionRequested,
              completionRequestedAt: j.validation.completionRequestedAt,
              disputedAt: j.validation.disputedAt
            }
          );
          const deadlines = computeDeadlines(
            { ...j.core },
            { completionRequested: j.validation.completionRequested, completionRequestedAt: j.validation.completionRequestedAt, disputedAt: j.validation.disputedAt },
            { completionReviewPeriod: scenario.completionReviewPeriod, disputeReviewPeriod: scenario.disputeReviewPeriod }
          );
          return { ...j, status: status.status, nextDeadline: fmtTime(deadlines.expiryTime) };
        })
        .filter((row) => `${row.id} ${row.status} ${row.core.employer} ${row.core.assignedAgent}`.toLowerCase().includes(query.toLowerCase())),
    [scenario, query]
  );

  const csv = ['jobId,status,payout,employer,agent,nextDeadline', ...rows.map((r) => `${r.id},${r.status},${r.core.payout},${r.core.employer},${r.core.assignedAgent},${r.nextDeadline}`)].join('\n');

  return (
    <>
      <div className="flex items-center gap-3">
        <input aria-label="search jobs" value={query} onChange={(e) => setQuery(e.target.value)} className="bg-card border border-border rounded-md px-3 py-2" placeholder="Search by id/address/status" />
        <button className="border border-border rounded-md px-3 py-2" onClick={() => navigator.clipboard.writeText(csv)}>Copy CSV export</button>
      </div>
      <pre data-testid="csv-output" className="hidden">{csv}</pre>
      <table className="w-full text-sm mt-4">
        <thead><tr><th>Job ID</th><th>Status</th><th>Payout</th><th>Employer</th><th>Agent</th><th>Next deadline</th></tr></thead>
        <tbody>
          {rows.map((j) => (
            <tr key={j.id} className="border-t border-border">
              <td><Link className="underline" href={`/jobs/${j.id}?scenario=${scenario.id}`}>{j.id}</Link></td>
              <td>{j.status}</td>
              <td>{fmtToken(j.core.payout)}</td>
              <td>{fmtAddr(j.core.employer)}</td>
              <td>{fmtAddr(j.core.assignedAgent)}</td>
              <td>{j.nextDeadline}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
