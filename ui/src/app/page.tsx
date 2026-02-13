'use client';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { usePlatformSummary } from '@/lib/web3/queries';
import { env } from '@/lib/env';

export default function Page() {
  const { data, isError, refetch } = usePlatformSummary();
  return (
    <div className='container py-8 space-y-4'>
      <Card className='rounded-[18px]'>
        <h1 className='font-serif text-4xl'>Institutional AGIJobManager Console</h1>
        <p className='text-muted-foreground mt-2'>Read-only first dapp + ops console with simulation-first execution.</p>
      </Card>
      {env.demoMode && <Card data-testid='demo-banner'>Demo mode: writes disabled.</Card>}
      {isError && <Card className='border-destructive'>Degraded RPC. <button onClick={() => refetch()}>Retry</button></Card>}
      {data?.paused && <Card>Protocol paused.</Card>}
      {data?.settlementPaused && <Card>Settlement paused.</Card>}
      <section className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <Card><h3 className='font-serif text-lg'>Create Job</h3><p className='text-sm text-muted-foreground'>Wallet required. Simulation-first.</p></Card>
        <Card><h3 className='font-serif text-lg'>Browse Jobs</h3><p className='text-sm'>{String(data?.nextJobId ?? 0n)} total ids observed</p><Link href='/jobs' className='text-sm underline'>Open jobs</Link></Card>
        <Card><h3 className='font-serif text-lg'>Platform summary</h3><p className='text-xs'>Quorum {String(data?.voteQuorum ?? 0n)} · approvals {String(data?.requiredValidatorApprovals ?? 0n)} · last block {String(data?.lastSuccessfulBlock ?? 0n)}</p></Card>
      </section>
    </div>
  );
}
