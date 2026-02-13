'use client';
export const dynamic = 'force-dynamic';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { currentScenario, isDemoMode } from '@/lib/demo';

export default function DashboardPage() {
  const scenario = currentScenario(typeof window !== "undefined" ? window.location.search : "");

  return (
    <div className='container py-8 space-y-5'>
      <Card className='rounded-[18px] border-primary/40 bg-card/60'>
        <h1 className='font-serif text-5xl'>AGIJobManager · Sovereign Ops Console</h1>
        <p className='mt-2 text-muted-foreground'>Institutional dApp for escrow lifecycle, dispute governance, and safety-first operations.</p>
      </Card>
      {isDemoMode && <Card>Demo mode enabled: writes disabled.</Card>}
      {scenario.degradedRpc && <Card className='border-destructive'>Degraded RPC banner with retry and last block metadata.</Card>}
      {scenario.paused && <Card>Protocol paused banner.</Card>}
      {scenario.settlementPaused && <Card>Settlement paused banner.</Card>}
      <section className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <Card><h3 className='font-serif text-3xl'>Create Job</h3><p className='text-muted-foreground'>Wallet required. Simulation-first.</p></Card>
        <Card><h3 className='font-serif text-3xl'>Browse Jobs</h3><p>{String(scenario.nextJobId)} total ids observed</p><Link className='underline' href={`/jobs?scenario=${scenario.key}`}>Open jobs ledger</Link></Card>
        <Card><h3 className='font-serif text-3xl'>Platform Config</h3><p>Quorum 0 · approvals 0</p><Link className='underline' href={`/admin?scenario=${scenario.key}`}>Open ops console</Link></Card>
      </section>
    </div>
  );
}
