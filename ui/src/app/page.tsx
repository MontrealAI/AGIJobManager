'use client';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { usePlatformSummary } from '@/lib/web3/queries';
import { env } from '@/lib/env';

export default function Page() {
  const { data, isError, refetch } = usePlatformSummary();
  return (
    <div className='container py-10 space-y-6'>
      <div className='rounded-[18px] border border-border bg-card/80 p-8 hero-aura'>
        <h1 className='font-serif text-4xl'>AGIJobManager UI / Ops Console</h1>
        <p className='text-muted-foreground mt-3'>Institutional, simulation-first controls for AGI escrow operations.</p>
      </div>
      {(isError || data?.degradedRpc) && <Card className='border-destructive'>Degraded RPC connectivity. <button className='underline' onClick={() => refetch()}>Retry</button></Card>}
      {data?.paused && <Card>Protocol paused.</Card>}
      {data?.settlementPaused && <Card>Settlement paused.</Card>}
      {env.demoMode && <Card>Demo mode enabled: writes are disabled.</Card>}
      <section className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <Card><h3 className='font-serif text-lg'>Create Job</h3><p className='text-sm text-muted-foreground'>Wallet required. Simulation-first stepper.</p></Card>
        <Card><h3 className='font-serif text-lg'>Browse Jobs</h3><p className='text-sm'>{String(data?.nextJobId ?? 0n)} indexed job ids.</p><Link className='underline text-sm' href='/jobs'>Open Jobs</Link></Card>
        <Card><h3 className='font-serif text-lg'>Platform Config</h3><p className='text-xs'>Quorum {String(data?.voteQuorum ?? 0n)} · approvals {String(data?.requiredValidatorApprovals ?? 0n)}</p><Link className='underline text-sm' href='/admin'>Open Ops Console</Link></Card>
      </section>
    </div>
  );
}
