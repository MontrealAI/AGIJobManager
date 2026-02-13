'use client';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useReadContracts } from 'wagmi';
import { agiJobManagerAbi } from '@/abis/agiJobManager';
import { env } from '@/lib/env';
import { Card, Badge } from '@/components/ui';
import { computeDeadlines, deriveJobStatus } from '@/lib/status';
import { safeUri } from '@/lib/utils';

export default function JobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = BigInt(params.jobId ?? '0');
  const { data } = useReadContracts({
    contracts: [
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobCore', args: [jobId] as const },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobValidation', args: [jobId] as const },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobSpecURI', args: [jobId] as const },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobCompletionURI', args: [jobId] as const }
    ],
    allowFailure: true
  });

  const core = data?.[0]?.status === 'success' ? (data[0].result as any) : undefined;
  const status = core
    ? deriveJobStatus(
        {
          assignedAgent: core.assignedAgent,
          settled: core.settled,
          disputedAt: BigInt(core.disputedAt),
          completionRequestedAt: BigInt(core.completionRequestedAt),
          assignedAt: BigInt(core.assignedAt),
          deadline: BigInt(core.assignedAt) + BigInt(core.duration)
        },
        BigInt(Math.floor(Date.now() / 1000))
      )
    : undefined;

  const deadlines = useMemo(() => {
    if (!core) return null;
    return computeDeadlines({
      assignedAt: BigInt(core.assignedAt),
      duration: BigInt(core.duration),
      completionRequestedAt: BigInt(core.completionRequestedAt),
      completionReviewPeriod: 0n,
      disputedAt: BigInt(core.disputedAt),
      disputeReviewPeriod: 0n,
      validatorApprovedAt: BigInt(core.validatorApprovedAt),
      challengePeriodAfterApproval: 0n
    });
  }, [core]);

  const specUri = data?.[2]?.status === 'success' ? data[2].result : '';
  const completionUri = data?.[3]?.status === 'success' ? data[3].result : '';

  return (
    <main className="space-y-4">
      <h1 className="font-serif text-3xl">Job #{jobId.toString()}</h1>
      <Card>
        <p>Status: <Badge>{status ?? 'unknown'}</Badge></p>
        <p className="text-sm">Employer: {core?.employer ?? '—'}</p>
        <p className="text-sm">Agent: {core?.assignedAgent ?? '—'}</p>
      </Card>
      <Card>
        <h2 className="mb-2 text-xl">Deadlines</h2>
        <p>Assignment end: {deadlines?.assignmentEndsAt.toString() ?? '—'}</p>
        <p>Review end: {deadlines?.completionReviewEndsAt.toString() ?? '—'}</p>
      </Card>
      <Card>
        <h2 className="mb-2 text-xl">URIs</h2>
        <p>Spec: {specUri || '—'}</p>
        {safeUri(specUri) && <a className="text-accent underline" target="_blank" href={specUri} rel="noreferrer">Open safe link</a>}
        <p className="mt-2">Completion: {completionUri || '—'}</p>
      </Card>
      {env.ensJobPagesAddress && <Card><h2 className="text-xl">ENS job page</h2><p>Contract: {env.ensJobPagesAddress}</p><p>URI: ens://job-{jobId.toString()}</p></Card>}
    </main>
  );
}
