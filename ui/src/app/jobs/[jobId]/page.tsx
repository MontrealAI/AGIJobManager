'use client';
export const dynamic = 'force-dynamic';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { currentScenario } from '@/lib/demo';
import { computeDeadlines, deriveStatus } from '@/lib/jobStatus';
import { sanitizeUri } from '@/lib/web3/safeUri';

export default function JobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const scenario = currentScenario(typeof window !== "undefined" ? window.location.search : "");
  const job = scenario.jobs.find((j) => j.id === Number(params.jobId));

  if (!job || job.deleted) return <div className='container py-8'><Card>Job slot deleted or not found.</Card></div>;

  const status = deriveStatus({ assignedAgent: job.agent, assignedAt: job.assignedAt, duration: job.duration, completed: job.completed, disputed: job.disputed, expired: job.expired }, { completionRequested: job.completionRequested, completionRequestedAt: job.completionRequestedAt, disputedAt: job.disputedAt });
  const deadlines = computeDeadlines({ assignedAgent: job.agent, assignedAt: job.assignedAt, duration: job.duration, completed: job.completed, disputed: job.disputed, expired: job.expired }, { completionRequested: job.completionRequested, completionRequestedAt: job.completionRequestedAt, disputedAt: job.disputedAt }, { completionReviewPeriod: scenario.completionReviewPeriod, disputeReviewPeriod: scenario.disputeReviewPeriod });
  const safeSpec = sanitizeUri(job.specURI);

  return (
    <div className='container py-8 space-y-4'>
      <Card><h1 className='font-serif text-3xl'>Job #{job.id} · {status.status}</h1><p>Expiry: {deadlines.expiryTime.toString()}</p><p>Completion review end: {deadlines.completionReviewEnd.toString()}</p><p>Dispute review end: {deadlines.disputeReviewEnd.toString()}</p></Card>
      <Card>
        <h2 className='font-serif text-xl'>URIs (untrusted)</h2>
        <p className='text-xs break-all'>{job.specURI}</p>
        <div className='mt-2 flex gap-2'>
          <button className='rounded border px-3 py-1 text-sm'>Copy</button>
          <a data-testid='safe-link' className={`rounded border px-3 py-1 text-sm ${safeSpec.safe ? '' : 'pointer-events-none opacity-50'}`} href={safeSpec.safe ? job.specURI : undefined} target='_blank'>Open link</a>
        </div>
      </Card>
      <Card><h2 className='font-serif text-xl'>Sovereign ledger timeline</h2><ul className='list-disc pl-5 text-sm'><li>JobCreated</li><li>JobApplied</li><li>JobCompletionRequested</li><li>JobValidated / JobDisapproved</li><li>JobDisputed / DisputeResolvedWithCode</li><li>JobCompleted / JobCancelled / JobExpired / NFTIssued</li></ul></Card>
      <Card><h2 className='font-serif text-xl'>Action Panels</h2><p className='text-sm'>Employer/Agent/Validator/Moderator/Owner actions are role-gated and simulation-first. Demo mode disables writes.</p></Card>
    </div>
  );
}
