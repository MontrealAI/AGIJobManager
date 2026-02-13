'use client';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { useJob, usePlatformSummary } from '@/lib/web3/queries';
import { deriveJobUiStatus } from '@/lib/jobStatus';
import { fmtTime, fmtToken } from '@/lib/format';
import { isAllowedUri, toSafeHref } from '@/lib/web3/safeUri';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';
import { demoTimeline } from '@/demo/fixtures/jobs';

export default function JobDetail() {
  const params = useParams();
  const rawJobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;
  const jobId = /^\d+$/.test(String(rawJobId || '')) ? BigInt(String(rawJobId)) : 0n;
  const { data: j } = useJob(jobId); const { data: p } = usePlatformSummary();
  if (!j || !p) return <div className='container py-8'>Loading...</div>;
  const core = j.core as any[];
  const val = j.val as any[];
  const ui = deriveJobUiStatus({ assignedAgent: core[1] as `0x${string}`, assignedAt: BigInt(core[4]), duration: BigInt(core[3]), completed: Boolean(core[5]), disputed: Boolean(core[6]), expired: Boolean(core[7]) }, { completionRequested: Boolean(val[0]), completionRequestedAt: BigInt(val[3]), disputedAt: BigInt(val[4]) }, { completionReviewPeriod: p.completionReviewPeriod, disputeReviewPeriod: p.disputeReviewPeriod }, (j.role || 'Viewer') as any);
  const timeline = demoTimeline[Number(jobId)] || ['JobCreated'];
  return <div className='container py-8 space-y-4'>
    <Card><h1 className='font-serif text-2xl'>Job #{String(jobId)} · {ui.label}</h1><p>Payout {fmtToken(BigInt(core[2]))}</p><p>Next deadline {fmtTime(ui.nextDeadline)}</p></Card>
    <Card><h2 className='font-serif'>URIs (untrusted)</h2><p className='break-all text-xs'>{j.spec || '-'}</p><div className='flex gap-2'><Button variant='outline' onClick={() => navigator.clipboard.writeText(j.spec)}>Copy</Button><a className={`text-sm ${isAllowedUri(j.spec) ? '' : 'pointer-events-none opacity-50'}`} href={toSafeHref(j.spec) || undefined} target='_blank'>Open link</a></div></Card>
    <Card><h2 className='font-serif'>Sovereign ledger timeline</h2><ul className='list-disc pl-5'>{timeline.map((e) => <li key={e}>{e}</li>)}</ul></Card>
    <Card><h2 className='font-serif'>Role-gated actions</h2><p className='text-xs mb-2'>Role: {j.role || 'Viewer'}</p><div className='grid grid-cols-2 gap-2'>{Object.entries(ui.allowedActions).map(([k, v]) => <Button key={k} variant='outline' disabled={!v || env.demoMode}>{k}</Button>)}</div>{env.demoMode && <p className='text-xs mt-2'>Demo mode: writes disabled.</p>}</Card>
  </div>;
}
