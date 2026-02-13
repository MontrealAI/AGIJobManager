'use client';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { useJob, usePlatformSummary } from '@/lib/web3/queries';
import { deriveJobView } from '@/lib/jobStatus';
import { fmtTime, fmtToken } from '@/lib/format';
import { sanitizeUri } from '@/lib/web3/safeUri';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';

export default function JobDetail() {
  const params = useParams(); const jobId = BigInt(String(params.jobId));
  const { data: j } = useJob(jobId); const { data: p } = usePlatformSummary();
  if (!j || !p) return <div className='container py-8'>Loading...</div>;
  const view = deriveJobView(
    { assignedAgent: j.core[1], assignedAt: j.core[4], duration: j.core[3], completed: j.core[5], disputed: j.core[6], expired: j.core[7] },
    { completionRequested: j.val[0], completionRequestedAt: j.val[3], disputedAt: j.val[4] },
    { completionReviewPeriod: p.completionReviewPeriod, disputeReviewPeriod: p.disputeReviewPeriod }
  );
  const spec = sanitizeUri(j.spec);

  return <div className='container py-8 space-y-4'>
    <Card><h1 className='font-serif text-2xl'>Job #{String(jobId)} · <span data-testid='job-status'>{view.label}</span></h1><p>Payout {fmtToken(j.core[2])}</p><p>Next deadline {fmtTime(view.nextDeadline)}</p></Card>
    <Card><h2 className='font-serif'>Actions by role</h2><p className='text-xs text-muted-foreground'>Demo mode renders role gates while writes stay disabled.</p><pre className='text-xs'>{JSON.stringify(view.allowedActions, null, 2)}</pre>{env.demoMode && <p>Demo mode: writes disabled</p>}</Card>
    <Card><h2 className='font-serif'>URIs (untrusted)</h2><p className='break-all text-xs'>{j.spec}</p><div className='flex gap-2'><Button variant='outline' onClick={() => navigator.clipboard.writeText(j.spec)}>Copy</Button><a className={`text-sm ${spec.safe ? '' : 'pointer-events-none opacity-50'}`} href={spec.normalized} target='_blank'>Open link</a></div><p className='text-xs'>{spec.reason}</p></Card>
    <Card><h2 className='font-serif'>Sovereign ledger timeline</h2><ol className='text-sm'>{j.timeline.map((e:any)=><li key={`${e.block}-${e.event}`}>#{e.block} {e.event} · {new Date(e.at*1000).toISOString()} · {e.detail}</li>)}</ol></Card>
  </div>;
}
