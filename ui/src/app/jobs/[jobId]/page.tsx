'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { useJob, usePlatformSummary } from '@/lib/web3/queries';
import { computeDeadlines, deriveStatus } from '@/lib/jobStatus';
import { fmtTime, fmtToken } from '@/lib/format';
import { isAllowedUri, toSafeHref } from '@/lib/web3/safeUri';
import { Button } from '@/components/ui/button';

export default function JobDetail() {
  const params = useParams();
  const [scenario, setScenario] = useState<string | undefined>(undefined);
  useEffect(() => { setScenario(new URLSearchParams(window.location.search).get('scenario') || undefined); }, []);
  const jobId = BigInt(String(params.jobId));
  const { data: j } = useJob(jobId, scenario);
  const { data: p } = usePlatformSummary(scenario);
  if (!j || !p) return <div className="container py-8">Loading...</div>;
  const assignedAgent = j.core[1] as `0x${string}`;
  const status = deriveStatus({ assignedAgent, assignedAt: j.core[4], duration: j.core[3], completed: j.core[5], disputed: j.core[6], expired: j.core[7] }, { completionRequested: j.val[0], completionRequestedAt: j.val[3], disputedAt: j.val[4] });
  const d = computeDeadlines({ assignedAgent, assignedAt: j.core[4], duration: j.core[3], completed: j.core[5], disputed: j.core[6], expired: j.core[7] }, { completionRequested: j.val[0], completionRequestedAt: j.val[3], disputedAt: j.val[4] }, { completionReviewPeriod: p.completionReviewPeriod, disputeReviewPeriod: p.disputeReviewPeriod });
  const safeHref = toSafeHref(j.spec);

  return <div className="container py-8 space-y-4"><Card><h1 className="font-serif text-2xl">Job #{String(jobId)} · {status.status}</h1><p>Payout {fmtToken(j.core[2])}</p><p>Expiry {fmtTime(d.expiryTime)}</p><p>Completion review end {fmtTime(d.completionReviewEnd)}</p><p>Dispute review end {fmtTime(d.disputeReviewEnd)}</p></Card>
    <Card><h2 className="font-serif">URIs (untrusted)</h2><p className="break-all text-xs">{j.spec || '—'}</p><div className="flex gap-2"><Button variant="outline" onClick={() => navigator.clipboard.writeText(j.spec)}>Copy</Button><a data-testid='safe-link' className={`text-sm ${isAllowedUri(j.spec) ? '' : 'pointer-events-none opacity-50'}`} href={safeHref} rel='noreferrer' target="_blank">Open link</a></div></Card>
    <Card><h2 className="font-serif">Sovereign ledger timeline</h2><ul className='text-sm list-disc pl-5'><li>JobCreated</li><li>JobApplied</li><li>JobCompletionRequested</li><li>JobValidated / JobDisapproved</li><li>JobDisputed</li><li>DisputeResolvedWithCode</li><li>JobCompleted / JobCancelled / JobExpired / NFTIssued</li></ul></Card></div>;
}
