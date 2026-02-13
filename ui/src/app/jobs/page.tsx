'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { agiJobManagerAbi } from '@/abis/agiJobManager';
import { env } from '@/lib/env';
import { deriveJobStatus } from '@/lib/status';
import { Badge, Card } from '@/components/ui';

const PAGE_SIZE = 10n;

export default function JobsPage() {
  const [page, setPage] = useState(0n);
  const { data: nextJob } = useReadContract({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'nextJobId' });
  const start = nextJob && nextJob > 0n ? (nextJob - 1n) - page * PAGE_SIZE : 0n;
  const ids = useMemo(() => {
    const out: bigint[] = [];
    for (let i = 0n; i < PAGE_SIZE && start >= i; i++) out.push(start - i);
    return out;
  }, [start]);
  const { data } = useReadContracts({
    contracts: ids.map((jobId) => ({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobCore', args: [jobId] as const })),
    allowFailure: true
  });

  return (
    <main>
      <h1 className="mb-4 font-serif text-3xl">Jobs</h1>
      <Card>
        <table className="w-full text-sm">
          <thead><tr className="border-b"><th className="py-2 text-left">Job</th><th>Status</th><th>Payout</th><th>Agent</th></tr></thead>
          <tbody>
            {(data ?? []).map((row, index) => {
              if (row.status !== 'success') return null;
              const core = row.result as any;
              const status = deriveJobStatus({
                assignedAgent: core.assignedAgent,
                settled: core.settled,
                disputedAt: BigInt(core.disputedAt),
                completionRequestedAt: BigInt(core.completionRequestedAt),
                assignedAt: BigInt(core.assignedAt),
                deadline: BigInt(core.assignedAt) + BigInt(core.duration)
              }, BigInt(Math.floor(Date.now() / 1000)));
              return (
                <tr key={ids[index].toString()} className="border-b hover:bg-accent/10">
                  <td className="py-2"><Link href={`/jobs/${ids[index]}`}>#{ids[index].toString()}</Link></td>
                  <td><Badge>{status}</Badge></td>
                  <td>{core.payout.toString()}</td>
                  <td>{core.assignedAgent.slice(0, 6)}...{core.assignedAgent.slice(-4)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setPage((p) => (p > 0n ? p - 1n : p))} className="rounded border px-2 py-1">Prev</button>
          <button onClick={() => setPage((p) => p + 1n)} className="rounded border px-2 py-1">Next</button>
        </div>
      </Card>
    </main>
  );
}
