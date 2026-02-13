'use client';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { computeDeadlines, deriveStatus, getActionGate } from '@/lib/jobStatus';
import { fmtTime, fmtToken } from '@/lib/format';
import { sanitizeUri } from '@/lib/web3/safeUri';
import { Button } from '@/components/ui/button';
import { useJobs, usePlatformSummary } from '@/lib/web3/queries';
import { isDemoMode, useDemoScenario } from '@/lib/demo';

export default function JobDetail() {
  const params = useParams();
  const jobId = Number(params.jobId);
  const scenario = useDemoScenario();
  const { data: jobs } = useJobs(scenario);
  const { data: p } = usePlatformSummary(scenario);
  const j: any = (jobs ?? []).find((x: any) => x?.id === jobId);
  const status = j ? deriveStatus({ assignedAgent: j.agent, assignedAt: j.assignedAt, duration: j.duration, completed: j.completed, disputed: j.disputed, expired: j.expired }, { completionRequested: j.completionRequested, completionRequestedAt: j.completionRequestedAt, disputedAt: j.disputedAt }) : null;
  const actions = useMemo(() => status ? ({ Employer: getActionGate(status.status, 'Employer'), Agent: getActionGate(status.status, 'Agent'), Validator: getActionGate(status.status, 'Validator'), Moderator: getActionGate(status.status, 'Moderator'), Owner: getActionGate(status.status, 'Owner') }) : ({ Employer:{}, Agent:{}, Validator:{}, Moderator:{}, Owner:{} }), [status]);
  if (!j || !p || !status) return <div className='container-shell py-8'>Loading...</div>;
  const d = computeDeadlines({ assignedAgent: j.agent, assignedAt: j.assignedAt, duration: j.duration, completed: j.completed, disputed: j.disputed, expired: j.expired }, { completionRequested: j.completionRequested, completionRequestedAt: j.completionRequestedAt, disputedAt: j.disputedAt }, { completionReviewPeriod: p.completionReviewPeriod, disputeReviewPeriod: p.disputeReviewPeriod });
  const safeSpec = sanitizeUri(j.specUri);

  return <div className='container-shell py-8 space-y-4'><Card><h1 className='font-serif text-2xl'>Job #{String(jobId)} · {status.status}</h1><p>Payout {fmtToken(j.payout)}</p><p>Expiry {fmtTime(d.expiryTime)}</p><p>Completion review end {fmtTime(d.completionReviewEnd)}</p><p>Dispute review end {fmtTime(d.disputeReviewEnd)}</p></Card>
    <Card><h2 className='font-serif'>URIs (untrusted)</h2><p className='break-all text-xs'>{j.specUri}</p><div className='flex gap-2'><Button variant='outline' onClick={() => navigator.clipboard.writeText(j.specUri)}>Copy</Button><a aria-disabled={!safeSpec.safe} className={`text-sm underline ${safeSpec.safe ? '' : 'pointer-events-none opacity-50'}`} href={safeSpec.href} target='_blank' rel='noreferrer'>Open link</a></div></Card>
    <Card><h2 className='font-serif'>Sovereign ledger timeline</h2><ul className='text-sm list-disc pl-6'><li>JobCreated</li><li>JobApplied</li><li>JobCompletionRequested</li><li>JobValidated / JobDisapproved</li><li>JobDisputed</li><li>DisputeResolvedWithCode</li><li>JobCompleted / JobCancelled / JobExpired</li><li>NFTIssued</li></ul></Card>
    <Card><h2 className='font-serif'>Role-gated actions</h2>{Object.entries(actions).map(([role, g]) => <p key={role} className='text-sm'>{role}: {Object.entries(g).filter(([, v]) => v).map(([k]) => k).join(', ') || 'No actions'}</p>)}</Card>
    {isDemoMode && <Card>Demo mode: writes disabled.</Card>}
  </div>;
}
