'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { usePlatformData, isDemoMode } from '@/lib/data/source';

export default function Page() {
  const { data, isError, refetch } = usePlatformData();

  return (
    <div className='container max-w-6xl py-8 space-y-6'>
      <section className='rounded-[18px] border border-border bg-card/80 p-8 hero-aura'>
        <p className='text-sm text-muted-foreground'>Institutional DApp + Ops Console</p>
        <h1 className='font-serif text-4xl'>AGIJobManager Sovereign Console</h1>
        <p className='text-muted-foreground mt-2'>Read-only first, simulation-first writes, deterministic demo mode.</p>
      </section>
      {isDemoMode && <Card data-testid='demo-banner'>Demo mode active: writes disabled.</Card>}
      {isError && <Card className='border-destructive'>Degraded RPC. <button onClick={() => refetch()}>Retry</button></Card>}
      {data?.paused && <Card>Protocol paused.</Card>}
      {data?.settlementPaused && <Card>Settlement paused.</Card>}
      <section className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <Card><h3 className='font-serif text-lg'>Create Job</h3><p className='text-sm text-muted-foreground'>Wallet required. Simulation-first.</p></Card>
        <Card><h3 className='font-serif text-lg'>Browse Jobs</h3><p className='text-sm'>{String(data?.nextJobId ?? 0n)} total ids observed</p><Link href='/jobs' className='text-accent'>Open jobs →</Link></Card>
        <Card><h3 className='font-serif text-lg'>Platform Config</h3><p className='text-xs'>Quorum {String(data?.voteQuorum ?? 0n)} · approvals {String(data?.requiredValidatorApprovals ?? 0n)}</p></Card>
      </section>
    </div>
  );
}
