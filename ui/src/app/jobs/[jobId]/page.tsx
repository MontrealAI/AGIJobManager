'use client';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { useJob, usePlatformSummary } from '@/lib/web3/queries';
import { computeDeadlines, deriveStatus, type Role } from '@/lib/jobStatus';
import { fmtTime, fmtToken } from '@/lib/format';
import { sanitizeUri } from '@/lib/web3/safeUri';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';
import { demoJobs, demoPlatform, demoTimeline } from '@/demo/fixtures/jobs';

const roles: Role[] = ['Employer', 'Agent', 'Validator', 'Moderator', 'Owner'];

export default function JobDetail() {
  const params = useParams();
  const rawJobId = Array.isArray((params as any).jobId) ? (params as any).jobId[0] : (params as any).jobId;
  const jobId = rawJobId && /^\d+$/.test(String(rawJobId)) ? BigInt(String(rawJobId)) : 0n;
  const { data: queriedJob } = useJob(jobId); const { data: queriedPlatform } = usePlatformSummary();
  const j = env.demoMode ? demoJobs.find((x) => x.id === jobId) || demoJobs[0] : queriedJob;
  const p = env.demoMode ? demoPlatform : queriedPlatform;
  if (!j || !p) return <div className='container py-8'>Loading...</div>;

  const status = deriveStatus({ assignedAgent: j.core[1], assignedAt: j.core[4], duration: j.core[3], completed: j.core[5], disputed: j.core[6], expired: j.core[7] }, { completionRequested: j.val[0], completionRequestedAt: j.val[3], disputedAt: j.val[4] }, { completionReviewPeriod: p.completionReviewPeriod, disputeReviewPeriod: p.disputeReviewPeriod });
  const d = computeDeadlines({ assignedAgent: j.core[1], assignedAt: j.core[4], duration: j.core[3], completed: j.core[5], disputed: j.core[6], expired: j.core[7] }, { completionRequested: j.val[0], completionRequestedAt: j.val[3], disputedAt: j.val[4] }, { completionReviewPeriod: p.completionReviewPeriod, disputeReviewPeriod: p.disputeReviewPeriod });
  const safeSpec = sanitizeUri(j.spec);

  return <div className='container py-8 space-y-4'>
    <Card><h1 className='font-serif text-2xl'>Job #{String(jobId)} · {status.label}</h1><p>Payout {fmtToken(j.core[2])}</p><p>Expiry {fmtTime(d.expiryTime)}</p><p>Completion review end {fmtTime(d.completionReviewEnd)}</p><p>Dispute review end {fmtTime(d.disputeReviewEnd)}</p></Card>
    <Card>
      <h2 className='font-serif'>Role-gated actions</h2>
      {roles.map((role) => <div key={role} className='mt-2'><strong>{role}:</strong> {(status.allowedActions[role].join(', ') || 'No actions')}</div>)}
      {env.demoMode && <p className='text-sm'>Demo mode: writes disabled.</p>}
    </Card>
    <Card><h2 className='font-serif'>URIs (untrusted)</h2><p className='break-all text-xs'>{j.spec}</p><div className='flex gap-2'><Button variant='outline' onClick={() => navigator.clipboard.writeText(j.spec)}>Copy</Button><a className={`text-sm underline ${safeSpec ? '' : 'pointer-events-none text-muted-foreground'}`} href={safeSpec || undefined} target='_blank'>Open link</a></div></Card>
    <Card><h2 className='font-serif'>Sovereign ledger timeline</h2>{(env.demoMode ? (demoTimeline[String(jobId)] || []) : ((queriedJob as any)?.timeline || [])).map((ev: any) => <div key={`${ev.ts}-${ev.event}`} className='border-l pl-3 ml-1 py-1'><p className='text-xs text-muted-foreground'>{ev.ts}</p><p>{ev.event}</p><p className='text-sm text-muted-foreground'>{ev.note}</p></div>)}</Card>
  </div>;
}
