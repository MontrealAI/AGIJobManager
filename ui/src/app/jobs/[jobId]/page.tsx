'use client';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { computeDeadlines, deriveStatus } from '@/lib/jobStatus';
import { fmtTime, fmtToken } from '@/lib/format';
import { isAllowedUri, sanitizeOutboundUri } from '@/lib/web3/safeUri';
import { Button } from '@/components/ui/button';
import { demoTimeline } from '@/demo/fixtures/jobs';
import { useJobData, usePlatformData, isDemoMode } from '@/lib/data/source';

export default function JobDetail() {
  const params = useParams();
  const rawJobId = params?.jobId;
  const parsedJobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;
  const jobId = parsedJobId ? BigInt(parsedJobId) : 0n;
  const { data: j }: any = useJobData(jobId);
  const { data: p } = usePlatformData();
  if (!j || !p) return <div className='container py-8'>Loading...</div>;

  const status = deriveStatus(
    { assignedAgent: j.core[1], assignedAt: j.core[4], duration: j.core[3], completed: j.core[5], disputed: j.core[6], expired: j.core[7] },
    { completionRequested: j.val[0], completionRequestedAt: j.val[3], disputedAt: j.val[4] },
    { completionReviewPeriod: p.completionReviewPeriod, disputeReviewPeriod: p.disputeReviewPeriod }
  );
  const d = computeDeadlines(
    { assignedAgent: j.core[1], assignedAt: j.core[4], duration: j.core[3], completed: j.core[5], disputed: j.core[6], expired: j.core[7] },
    { completionRequested: j.val[0], completionRequestedAt: j.val[3], disputedAt: j.val[4] },
    { completionReviewPeriod: p.completionReviewPeriod, disputeReviewPeriod: p.disputeReviewPeriod }
  );

  const safeSpec = sanitizeOutboundUri(j.spec);

  return <div className='container py-8 space-y-4'>
    <Card><h1 className='font-serif text-2xl'>Job #{String(jobId)} · <span data-testid='job-status'>{status.status}</span></h1><p>Payout {fmtToken(j.core[2])}</p><p>Expiry {fmtTime(d.expiryTime)}</p><p>Completion review end {fmtTime(d.completionReviewEnd)}</p><p>Dispute review end {fmtTime(d.disputeReviewEnd)}</p></Card>
    <Card><h2 className='font-serif'>URIs (untrusted)</h2><p className='break-all text-xs'>{j.spec}</p><div className='flex gap-2'><Button variant='outline' onClick={() => navigator.clipboard.writeText(j.spec)}>Copy</Button><a className={`text-sm ${isAllowedUri(j.spec) ? '' : 'pointer-events-none opacity-50'}`} href={safeSpec ?? undefined} target='_blank'>Open link</a></div></Card>
    <Card><h2 className='font-serif'>Action gates</h2><p data-testid='actions-employer'>Employer: {status.allowedActions.Employer.join(', ') || 'none'}</p><p>Agent: {status.allowedActions.Agent.join(', ') || 'none'}</p>{isDemoMode && <p className='text-warning'>Demo mode: writes disabled.</p>}</Card>
    <Card><h2 className='font-serif'>Sovereign ledger timeline</h2><ul>{((demoTimeline as Record<number, readonly string[]>)[Number(jobId)] || []).map((e) => <li key={e}>{e}</li>)}</ul></Card>
  </div>;
}
