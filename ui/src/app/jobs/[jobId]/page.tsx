'use client';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { computeDeadlines, deriveStatus, getActionGate } from '@/lib/jobStatus';
import { fmtTime, fmtToken } from '@/lib/format';
import { sanitizeUri } from '@/lib/web3/safeUri';
import { Button } from '@/components/ui/button';
import { useJobs, usePlatformSummary } from '@/lib/web3/queries';
import { isDemoMode, useDemoRoleFlags, useDemoScenario } from '@/lib/demo';

const roleFromActor: Record<string, 'Employer' | 'Agent' | 'Validator' | 'Moderator' | 'Owner'> = {
  employer: 'Employer',
  agent: 'Agent',
  validator: 'Validator',
  moderator: 'Moderator',
  owner: 'Owner'
};

export default function JobDetail() {
  const params = useParams();
  const jobId = Number(params.jobId);
  const scenario = useDemoScenario();
  const { actor } = useDemoRoleFlags();
  const { data: jobs } = useJobs(scenario);
  const { data: p } = usePlatformSummary(scenario);
  const j: any = (jobs ?? []).find((x: any) => x?.id === jobId);
  const status = j
    ? deriveStatus(
        { assignedAgent: j.agent, assignedAt: j.assignedAt, duration: j.duration, completed: j.completed, disputed: j.disputed, expired: j.expired },
        { completionRequested: j.completionRequested, completionRequestedAt: j.completionRequestedAt, disputedAt: j.disputedAt }
      )
    : null;
  const actions = useMemo(
    () =>
      status
        ? {
            Employer: getActionGate(status.status, 'Employer'),
            Agent: getActionGate(status.status, 'Agent'),
            Validator: getActionGate(status.status, 'Validator'),
            Moderator: getActionGate(status.status, 'Moderator'),
            Owner: getActionGate(status.status, 'Owner')
          }
        : { Employer: {}, Agent: {}, Validator: {}, Moderator: {}, Owner: {} },
    [status]
  );

  if (!j || !p || !status) return <div className="container-shell py-8">Loading...</div>;

  const estimate = computeDeadlines(
    { assignedAgent: j.agent, assignedAt: j.assignedAt, duration: j.duration, completed: j.completed, disputed: j.disputed, expired: j.expired },
    { completionRequested: j.completionRequested, completionRequestedAt: j.completionRequestedAt, disputedAt: j.disputedAt },
    { completionReviewPeriod: p.completionReviewPeriod, disputeReviewPeriod: p.disputeReviewPeriod }
  );
  const d = isDemoMode ? estimate : j.deadlines ? {
    expiryTime: j.deadlines[0], completionReviewEnd: j.deadlines[1], disputeReviewEnd: j.deadlines[3]
  } : null;
  const safeSpec = sanitizeUri(j.specUri);
  const activeRole = roleFromActor[actor];
  const actorActions = activeRole ? Object.entries(actions[activeRole]).filter(([, v]) => v).map(([k]) => k) : [];

  return (
    <div className="container-shell py-8 space-y-4">
      <Card>
        <h1 className="font-serif text-2xl">Job #{String(jobId)} · {status.status}</h1>
        <p>Payout {fmtToken(j.payout)}</p>
        {!d ? <p>Deadlines unavailable. Refresh before acting.</p> : p.settlementPaused ? <p>Settlement is paused. Deadlines extend until settlement resumes.</p> : <>
          <p>Submission deadline {fmtTime(d.expiryTime)}</p>
          <p>Validator review end {fmtTime(d.completionReviewEnd)}</p>
          <p>Owner arbitration available after {fmtTime(d.disputeReviewEnd)}</p>
          {!isDemoMode && <><p>Payment possible after / dispute by {fmtTime(j.deadlines[2])}</p><p>Neutral refund available after {fmtTime(j.deadlines[4])}</p></>}
        </>}
        {isDemoMode && <p>Demo deadlines are illustrative estimates.</p>}
        <p>No votes open a dispute; they do not approve payment. Buyers may explicitly accept satisfactory work. A buyer-win decision returns the full job escrow.</p>
        <p>A submission link does not prove delivery. Inspect the work against your acceptance criteria and dispute poor or inaccessible work before the displayed cutoff. Final acceptance cannot be undone. Refunds do not reimburse gas or lost time.</p>
        <p>The posted cost is total buyer escrow. At the default 8% review rate, a successful 100 USDC job allocates 8 to reviewers, 30 and 10 to the configured wallets, and at least 52 to the agent. Bonds and gas are separate.</p>
      </Card>
      <Card>
        <h2 className="font-serif">URIs (untrusted)</h2>
        <p className="break-all text-xs">{j.specUri}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(j.specUri)}>
            Copy
          </Button>
          <a aria-disabled={!safeSpec.safe} className={`text-sm underline ${safeSpec.safe ? '' : 'pointer-events-none opacity-50'}`} href={safeSpec.href} target="_blank" rel="noreferrer">
            Open link
          </a>
        </div>
      </Card>
      <Card>
        <h2 className="font-serif">Sovereign ledger timeline</h2>
        <ul className="text-sm list-disc pl-6">
          <li>JobCreated</li><li>JobApplied</li><li>JobCompletionRequested</li><li>JobValidated / JobDisapproved</li><li>JobDisputed</li><li>DisputeResolvedWithCode</li><li>JobCompleted / JobCancelled / JobExpired</li><li>NFTIssued</li>
        </ul>
      </Card>
      <Card>
        <h2 className="font-serif">Actions by role</h2>
        <p>These are possible actions for this status. Deadlines, pauses, identity checks and conflicts must also pass before a transaction can succeed.</p>
        {isDemoMode ? <p className='text-sm'>Demo actor <strong>{actor}</strong>: {actorActions.join(', ') || 'No actions'}.</p> : null}
        {Object.entries(actions).map(([role, g]) => (
          <p key={role} className="text-sm">{role}: {Object.entries(g).filter(([, v]) => v).map(([k]) => k).join(', ') || 'No actions'}</p>
        ))}
      </Card>
      {isDemoMode && <Card>Demo mode: writes disabled.</Card>}
    </div>
  );
}
