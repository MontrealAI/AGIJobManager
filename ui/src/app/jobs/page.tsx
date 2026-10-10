'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { useState } from 'react';
import { deriveStatus } from '@/lib/jobStatus';
import { fmtAddr, fmtToken } from '@/lib/format';
import { useJobs } from '@/lib/web3/queries';
import { parseJobId } from '@/lib/web3/job-reader';
import { isDemoMode, useDemoScenario } from '@/lib/demo';

export default function Jobs() {
  const scenario = useDemoScenario();
  const router = useRouter();
  const [cursors, setCursors] = useState<bigint[]>([]);
  const { data, isPending, isError, refetch } = useJobs(scenario, cursors.at(-1));
  const [q, setQ] = useState('');
  const [jobId, setJobId] = useState('');
  const [notice, setNotice] = useState('');
  const rows = (!isError ? data?.jobs ?? [] : []).map(j => ({ ...j, status: deriveStatus({ assignedAgent: j.agent, assignedAt: j.assignedAt, duration: j.duration, completed: j.completed, disputed: j.disputed, expired: j.expired }, { completionRequested: j.completionRequested, completionRequestedAt: j.completionRequestedAt, disputedAt: j.disputedAt }).status }));
  const filtered = rows.filter(r => [String(r.id), r.employer, r.agent, r.status].some(v => v.toLowerCase().includes(q.toLowerCase())));
  const csv = ['jobId,status,payout,employer,agent', ...filtered.map(j => `${j.id},${j.status},${j.payout},${j.employer},${j.agent}`)].join('\n');

  return <div className='container-shell py-8 space-y-4'>
    <h1 className='font-serif text-2xl'>Jobs ledger</h1>
    <Card><form className='flex gap-2' onSubmit={event => { event.preventDefault(); try { router.push(`/jobs/${parseJobId(jobId)}`); setNotice(''); } catch (error) { setNotice((error as Error).message); } }}><input aria-label='Job ID' className='input-shell max-w-sm' inputMode='numeric' placeholder='Open a specific job ID' value={jobId} onChange={e => setJobId(e.target.value)} /><button className='btn-outline' type='submit'>Open job</button></form></Card>
    <Card><div className='flex flex-wrap gap-2 items-center justify-between'><input aria-label='Search jobs' className='input-shell max-w-sm' placeholder='Filter this page by id/address/status' value={q} onChange={e => setQ(e.target.value)} /><button className='btn-outline' disabled={isPending || isError || !filtered.length} onClick={async () => { try { await navigator.clipboard.writeText(csv); setNotice('Copied the filtered page. Payouts use USDC base units.'); } catch { setNotice('Clipboard unavailable. Select and copy the CSV below.'); } }}>Copy CSV export</button></div><p className='text-xs mt-2'>Loads up to 50 jobs per page. Search and CSV export cover this page only; CSV payouts use USDC base units (6 decimals).</p></Card>
    <p role='status'>{notice}</p>
    {isDemoMode && <Card className='text-sm'>Scenario: {scenario.title}</Card>}
    {isPending ? <Card>Loading jobs…</Card> : isError ? <Card><p role='alert'>Jobs unavailable. Check the deployment and RPC connection before acting.</p><button className='btn-outline' onClick={() => refetch()}>Retry</button></Card> : <>
      <Card>
        <p className='text-sm mb-3'>{String(data?.total ?? 0n)} total job IDs. {data?.blockNumber != null ? `Snapshot block ${data.blockNumber}.` : 'Demo fixtures.'}</p>
        {rows.length ? <table className='w-full text-sm'><thead><tr><th>Job ID</th><th>Status</th><th>Payout</th><th>Employer</th><th>Agent</th></tr></thead>
          <tbody>{filtered.map(j => <tr key={String(j.id)} className='border-t border-border hover:bg-muted/30'><td><Link href={`/jobs/${j.id}`}>{String(j.id)}</Link></td><td>{j.status}</td><td>{fmtToken(j.payout)}</td><td>{fmtAddr(j.employer)}</td><td>{fmtAddr(j.agent)}</td></tr>)}</tbody></table> : <p>No jobs in this page.</p>}
        {!!rows.length && !filtered.length && <p>No jobs match this page filter.</p>}
        <div className='flex gap-2 mt-4'><button className='btn-outline' disabled={!cursors.length} onClick={() => setCursors(previous => previous.slice(0, -1))}>Newer jobs</button><button className='btn-outline' disabled={data?.olderCursor == null} onClick={() => { if (data?.olderCursor != null) setCursors(previous => [...previous, data.olderCursor!]); }}>Older jobs</button><button className='btn-outline' onClick={() => { setCursors([]); void refetch(); }}>Newest jobs</button></div>
      </Card>
      <pre data-testid='csv-output' className='card-shell overflow-x-auto text-xs'>{csv}</pre>
    </>}
  </div>;
}
