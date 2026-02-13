'use client';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useMemo, useState } from 'react';
import { deriveStatus } from '@/lib/jobStatus';
import { fmtAddr, fmtToken } from '@/lib/format';
import { useJobs } from '@/lib/web3/queries';
import { isDemoMode, useDemoScenario } from '@/lib/demo';

function toCsv(rows: any[]) {
  return ['jobId,status,payout,employer,agent', ...rows.map((j) => `${j.id},${j.status},${j.payout},${j.employer},${j.agent}`)].join('\n');
}

export default function Jobs() {
  const scenario = useDemoScenario();
  const { data } = useJobs(scenario);
  const [q, setQ] = useState('');
  const rows = useMemo(() => (data ?? []).map((j: any) => ({ ...j, status: deriveStatus({ assignedAgent: j.agent, assignedAt: j.assignedAt, duration: j.duration, completed: j.completed, disputed: j.disputed, expired: j.expired }, { completionRequested: j.completionRequested, completionRequestedAt: j.completionRequestedAt, disputedAt: j.disputedAt }).status })), [data]);
  const filtered = rows.filter((r: any) => [String(r.id), r.employer, r.agent, r.status].some((v) => v.toLowerCase().includes(q.toLowerCase())));
  const csv = toCsv(filtered);

  return <div className='container-shell py-8 space-y-4'>
    <Card><div className='flex flex-wrap gap-2 items-center justify-between'><input aria-label='Search jobs' className='input-shell max-w-sm' placeholder='Filter by id/address/status' value={q} onChange={(e)=>setQ(e.target.value)} /><button className='btn-outline' onClick={() => navigator.clipboard.writeText(csv)}>Copy CSV export</button></div></Card>
    {isDemoMode && <Card className='text-sm'>Scenario: {scenario.title}</Card>}
    <Card>
      <table className='w-full text-sm'><thead><tr><th>Job ID</th><th>Status</th><th>Payout</th><th>Employer</th><th>Agent</th></tr></thead>
      <tbody>{filtered.map((j:any)=><tr key={j.id} className='border-t border-border hover:bg-muted/30'><td><Link href={`/jobs/${j.id}`}>{j.id}</Link></td><td>{j.status}</td><td>{fmtToken(j.payout)}</td><td>{fmtAddr(j.employer)}</td><td>{fmtAddr(j.agent)}</td></tr>)}</tbody></table>
    </Card>
    <pre data-testid='csv-output' className='card-shell overflow-x-auto text-xs'>{csv}</pre>
  </div>;
}
