'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { usePlatformSummary } from '@/lib/web3/queries';
import { env } from '@/lib/env';

export default function Page() {
  const [scenario, setScenario] = useState<string | undefined>(undefined);
  useEffect(() => { setScenario(new URLSearchParams(window.location.search).get('scenario') || undefined); }, []);
  const { data, isError, refetch } = usePlatformSummary(scenario);

  return (
    <div className="container py-8 space-y-4">
      <Card className="rounded-[18px] p-8">
        <h1 className="font-serif text-5xl">AGIJobManager · Sovereign Ops Console</h1>
        <p className="text-muted-foreground">Institutional dApp for escrow lifecycle, dispute governance, and simulation-first operations.</p>
      </Card>
      {env.demoMode && <Card>Demo mode enabled: writes disabled.</Card>}
      {(isError || data?.degradedRpc) && <Card className="border-destructive">Degraded RPC. <button onClick={() => refetch()}>Retry</button></Card>}
      {data?.paused && <Card>Protocol paused.</Card>}
      {data?.settlementPaused && <Card>Settlement paused.</Card>}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><h3 className="font-serif text-lg">Create Job</h3><p className="text-sm text-muted-foreground">Wallet required. Simulation-first.</p></Card>
        <Card><h3 className="font-serif text-lg">Browse Jobs</h3><p className="text-sm">{String(data?.nextJobId ?? 0n)} total ids observed</p><Link className='underline' href={`/jobs${scenario ? `?scenario=${scenario}` : ''}`}>Open jobs ledger</Link></Card>
        <Card><h3 className="font-serif text-lg">Platform Config</h3><p className="text-xs">Quorum {String(data?.voteQuorum ?? 0n)} · approvals {String(data?.requiredValidatorApprovals ?? 0n)}</p><Link className='underline' href={`/admin${scenario ? `?scenario=${scenario}` : ''}`}>Open ops console</Link></Card>
      </section>
    </div>
  );
}
