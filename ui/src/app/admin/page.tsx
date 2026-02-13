'use client';
import { useAccount, useReadContract } from 'wagmi';
import { agiJobManagerAbi } from '@/abis/agiJobManager';
import { env } from '@/lib/env';
import { canAccessAdmin } from '@/lib/status';
import { Card } from '@/components/ui';

export default function AdminPage() {
  const { address } = useAccount();
  const { data: owner } = useReadContract({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'owner' });
  const allowed = canAccessAdmin(address, owner);

  if (!allowed) return <main><h1 className="font-serif text-3xl">Admin</h1><p>Not authorized</p></main>;

  return (
    <main className="space-y-4">
      <h1 className="font-serif text-3xl">Ops Console</h1>
      <Card><h2 className="text-xl">Danger Operations</h2><p className="text-sm">Pause/unpause, settlement lock, treasury withdrawals.</p></Card>
      <Card><h2 className="text-xl">Roles</h2><p className="text-sm">Moderators, additional agents/validators, blacklist.</p></Card>
    </main>
  );
}
