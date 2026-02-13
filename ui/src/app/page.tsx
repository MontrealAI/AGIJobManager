'use client';
import { AlertTriangle } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import Link from 'next/link';
import { usePlatform } from '@/hooks/use-platform';
import { env } from '@/lib/env';

export default function DashboardPage() {
  const { data } = usePlatform();
  const paused = data?.[0]?.result as boolean | undefined;
  const settlementPaused = data?.[1]?.result as boolean | undefined;
  const nextJobId = data?.[3]?.result as bigint | undefined;

  return (
    <main className="space-y-6">
      <section className="rounded-xl border bg-card p-8">
        <h1 className="font-serif text-4xl leading-[44px]">ASI Sovereign Operations Console</h1>
        <p className="mt-2 text-muted-foreground">Mainnet-grade oversight for AGI job lifecycle, validation and settlement.</p>
      </section>
      {!env.hasPrivateRpc && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-600/40 bg-yellow-500/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4" /> Degraded RPC mode: using public fallback endpoints.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Card><h2 className="mb-2 text-xl">Create Job</h2><p className="text-sm text-muted-foreground">Wallet required. Disabled if paused.</p><Button disabled={paused || settlementPaused} className="mt-4">Create</Button></Card>
        <Card><h2 className="mb-2 text-xl">Browse Jobs</h2><p className="text-sm text-muted-foreground">Inspect status, deadlines, disputes.</p><Link href="/jobs" className="mt-4 inline-block text-accent underline">Open jobs list</Link></Card>
        <Card><h2 className="mb-2 text-xl">Platform Config</h2><p className="text-sm text-muted-foreground">Paused: {String(paused ?? '...')} / Settlement: {String(settlementPaused ?? '...')}</p><p className="mt-1 text-sm">nextJobId: {nextJobId?.toString() ?? '...'}</p></Card>
      </div>
    </main>
  );
}
