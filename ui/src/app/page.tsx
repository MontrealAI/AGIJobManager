'use client';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { usePlatformSummary } from '@/lib/web3/queries';
import { isDemoMode, useDemoRoleFlags, useDemoScenario } from '@/lib/demo';

export default function Page() {
  const scenario = useDemoScenario();
  const { actor } = useDemoRoleFlags();
  const { data, isPending, isError, refetch } = usePlatformSummary(scenario);
  const degraded = isDemoMode ? scenario.degradedRpc : isError;

  return (
    <div className="container-shell py-8 space-y-4">
      <section className="hero border border-border bg-card/80">
        <h1 className="text-5xl font-serif">AGIJobManager · Sovereign Ops Console</h1>
        <p className="text-muted-foreground mt-2">Read-only dashboard for job state, dispute deadlines and platform configuration. Use the USDC console for transactions.</p>
      </section>
      {isDemoMode && <Card>Demo mode enabled: writes disabled. Active demo actor: <strong>{actor}</strong>.</Card>}
      {degraded && <Card className="border-destructive">Degraded RPC. <button onClick={() => refetch()}>Retry</button></Card>}
      {!isError && data?.paused && <Card>Protocol paused.</Card>}
      {!isError && data?.settlementPaused && <Card>Settlement paused.</Card>}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><h3 className="font-serif text-lg">Create Job</h3><p className="text-sm text-muted-foreground">Create and manage jobs in the USDC console.</p><a className="underline" href="https://montrealai.github.io/AGIJobManager/agijobmanager-usdc.html">Open USDC console</a></Card>
        <Card><h3 className="font-serif text-lg">Browse Jobs</h3><p className="text-sm">{isPending ? 'Loading job count…' : isError || !data ? 'Job count unavailable.' : `${data.nextJobId} total ids observed`}</p><Link className="underline" href="/jobs">Open jobs ledger</Link></Card>
        <Card><h3 className="font-serif text-lg">Platform Config</h3><p className="text-xs">{isPending ? 'Loading configuration…' : isError || !data ? 'Configuration unavailable.' : `Quorum ${data.voteQuorum} · approvals ${data.requiredValidatorApprovals}`}</p><Link className="underline" href="/admin">Open ops console</Link></Card>
      </section>
    </div>
  );
}
