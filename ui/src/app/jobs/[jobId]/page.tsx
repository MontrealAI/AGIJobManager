'use client';

import { useMemo } from 'react';
import { useParams, useSearchParams, notFound } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { scenarioFromSearch, isDemoMode } from '@/lib/demo';
import { deriveStatus, computeDeadlines, actionGates } from '@/lib/jobStatus';
import { fmtTime, fmtToken } from '@/lib/format';
import { isAllowedUri, toSafeHref } from '@/lib/web3/safeUri';

function UriRow({ value }: { value: string }) {
  const href = toSafeHref(value);
  return (
    <div>
      <p className="break-all text-xs">{value || '—'}</p>
      <div className="flex gap-2">
        <button className="border border-border rounded-md px-2 py-1" onClick={() => navigator.clipboard.writeText(value)}>Copy</button>
        <a aria-disabled={!href} className={!href ? 'opacity-50 pointer-events-none underline' : 'underline'} href={href ?? undefined} target="_blank" rel="noreferrer">Open link</a>
      </div>
    </div>
  );
}

export default function JobDetail() {
  const params = useParams<{ jobId: string }>();
  const search = useSearchParams();
  const scenario = useMemo(() => scenarioFromSearch(search.toString()), [search]);
  const job = scenario.jobs[Number(params.jobId)];
  if (!job) return notFound();

  const status = deriveStatus({ ...job.core }, { completionRequested: job.validation.completionRequested, completionRequestedAt: job.validation.completionRequestedAt, disputedAt: job.validation.disputedAt });
  const deadlines = computeDeadlines({ ...job.core }, { completionRequested: job.validation.completionRequested, completionRequestedAt: job.validation.completionRequestedAt, disputedAt: job.validation.disputedAt }, { completionReviewPeriod: scenario.completionReviewPeriod, disputeReviewPeriod: scenario.disputeReviewPeriod });
  const gates = actionGates(status.status);

  return (
    <div className="container py-8 space-y-4">
      {isDemoMode && <Card>Demo mode: writes disabled.</Card>}
      <Card>
        <h1 className="font-serif text-3xl">Job #{params.jobId} · {status.status}</h1>
        <p>Payout {fmtToken(job.core.payout)}</p>
        <p>Assignment deadline {fmtTime(deadlines.expiryTime)}</p>
        <p>Completion review end {fmtTime(deadlines.completionReviewEnd)}</p>
        <p>Dispute review end {fmtTime(deadlines.disputeReviewEnd)}</p>
      </Card>
      <Card>
        <h2 className="font-serif text-2xl">URIs (untrusted)</h2>
        <UriRow value={job.specUri} />
        <UriRow value={job.completionUri} />
        {!isAllowedUri(job.specUri) && <p className="text-xs text-destructive">Blocked non-allowlisted scheme.</p>}
      </Card>
      <Card>
        <h2 className="font-serif text-2xl">Action panels (role gated)</h2>
        <p className="text-xs">Enabled now → apply:{String(gates.canApply)} completion:{String(gates.canRequestCompletion)} dispute:{String(gates.canDispute)} finalize:{String(gates.canFinalize)}</p>
      </Card>
      <Card>
        <h2 className="font-serif text-2xl">Sovereign ledger timeline</h2>
        <p className="text-sm">JobCreated → JobApplied → JobCompletionRequested → JobValidated/JobDisapproved → JobDisputed → DisputeResolvedWithCode → JobCompleted/JobCancelled/JobExpired → NFTIssued</p>
      </Card>
    </div>
  );
}
