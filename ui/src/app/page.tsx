import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { scenarioFromSearch, isDemoMode } from '@/lib/demo';
import { ScenarioSwitcher } from '@/components/common/scenario-switcher';

export default function Dashboard({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const raw = new URLSearchParams();
  if (typeof searchParams?.scenario === 'string') raw.set('scenario', searchParams.scenario);
  const scenario = scenarioFromSearch(raw.toString());

  return (
    <div className="container py-8 space-y-5">
      <div className="flex justify-end">{isDemoMode && <ScenarioSwitcher />}</div>
      <section className="rounded-[18px] border border-border bg-card/80 p-8 hero-aura">
        <h1 className="text-5xl font-serif">AGIJobManager · Sovereign Ops Console</h1>
        <p className="text-muted-foreground mt-2">Institutional dApp for escrow lifecycle, dispute governance, and safety-first operations.</p>
      </section>
      {isDemoMode && <Card>Demo mode enabled: writes disabled.</Card>}
      {scenario.degradedRpc && <Card className="border-destructive">Degraded RPC. Retry reads or switch scenario.</Card>}
      {scenario.paused && <Card>Protocol paused.</Card>}
      {scenario.settlementPaused && <Card>Settlement paused.</Card>}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><h3 className="font-serif text-2xl">Create Job</h3><p className="text-sm text-muted-foreground">Wallet required. Simulation-first.</p></Card>
        <Card><h3 className="font-serif text-2xl">Browse Jobs</h3><p>{String(scenario.nextJobId)} total ids observed</p><Link className="underline" href={`/jobs?scenario=${scenario.id}`}>Open jobs ledger</Link></Card>
        <Card><h3 className="font-serif text-2xl">Platform Config</h3><p className="text-xs">Quorum placeholder · approvals placeholder</p><Link className="underline" href={`/admin?scenario=${scenario.id}`}>Open ops console</Link></Card>
      </section>
    </div>
  );
}
