'use client';
import { useAccount } from 'wagmi';
import { usePlatformData, isDemoMode } from '@/lib/data/source';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function Admin() {
  const { address } = useAccount();
  const { data } = usePlatformData();
  const owner = data?.owner?.toLowerCase();
  const isOwner = !!address && !!owner && address.toLowerCase() === owner;
  if (!isOwner && !isDemoMode) return <div className='container py-8'><Card>Not authorized (owner only).</Card></div>;

  return <div className='container py-8 space-y-3'>
    {!isOwner && <Card data-testid='admin-not-authorized'>Not authorized (owner only). Demo owner view shown.</Card>}
    <Card><h2 className='font-serif'>Safety toggles</h2><p>Pause/unpause and settlement pause with simulation-first writes.</p><Input placeholder='Type PAUSE to confirm' /></Card>
    <Card><h2 className='font-serif'>Roles</h2><p>Manage moderators and allowlists / blacklists.</p></Card>
    <Card><h2 className='font-serif'>Parameters</h2><p>Thresholds, periods, bonds, slash BPS.</p></Card>
    <Card><h2 className='font-serif'>Treasury</h2><p>Withdraw requires paused && !settlementPaused.</p></Card>
  </div>;
}
