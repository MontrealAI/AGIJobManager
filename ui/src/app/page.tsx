'use client';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { usePlatformSummary } from '@/lib/web3/queries';
import { isDemoMode, useDemoRoleFlags, useDemoScenario } from '@/lib/demo';

export default function Page() {
  const scenario = useDemoScenario();
  const { actor } = useDemoRoleFlags();
  const { data, isError, refetch } = usePlatformSummary(scenario);
  const degraded = isDemoMode ? scenario.degradedRpc : isError;

  return (
    <div className="container-shell py-8 space-y-4">
      <section className="hero border border-border bg-card/80">
        <h1 className="text-5xl font-serif">AGIJobManager · Sovereign Ops Console</h1>
        <p className="text-muted-foreground mt-2">Institutional dApp for escrow lifecycle, dispute governance, and safety-first operations.</p>
      </section>
      {isDemoMode && <Card>Demo mode enabled: writes disabled. Active demo actor: <strong>{actor}</strong>.</Card>}
      {degraded && <Card className="border-destructive">Degraded RPC. <button onClick={() => refetch()}>Retry</button></Card>}
      {data?.paused && <Card>Protocol paused.</Card>}
      {data?.settlementPaused && <Card>Settlement paused.</Card>}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><h3 className="font-serif text-lg">Create Job</h3><p className="text-sm text-muted-foreground">Wallet required. Simulation-first.</p></Card>
        <Card><h3 className="font-serif text-lg">Browse Jobs</h3><p className="text-sm">{String(data?.nextJobId ?? 0n)} total ids observed</p><Link className="underline" href="/jobs">Open jobs ledger</Link></Card>
        <Card><h3 className="font-serif text-lg">Platform Config</h3><p className="text-xs">Quorum {String(data?.voteQuorum ?? 0n)} · approvals {String(data?.requiredValidatorApprovals ?? 0n)}</p><Link className="underline" href="/admin">Open ops console</Link></Card>
      </section>
    </div>
  );
}
