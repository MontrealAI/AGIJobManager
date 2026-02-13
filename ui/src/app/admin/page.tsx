'use client';
import { useAccount } from 'wagmi';
import { usePlatformSummary } from '@/lib/web3/queries';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { env } from '@/lib/env';

export default function Admin() {
  const { address } = useAccount(); const { data } = usePlatformSummary();
  const owner = data?.owner?.toLowerCase();
  const isOwner = (address && owner && address.toLowerCase() === owner) || env.demoMode;
  if (!isOwner) return <div className='container py-8'><Card>Not authorized (owner only).</Card></div>;
  return <div className='container py-8 space-y-3'>
    <Card><h2 className='font-serif'>Safety toggles</h2><p>Pause/unpause and settlement pause with simulation-first writes.</p><Input placeholder='Type PAUSE to confirm' /></Card>
    <Card><h2 className='font-serif'>Roles</h2><p>Manage moderators, allowlists, and blacklists.</p><Input placeholder='Type SETTLEMENT to confirm' /></Card>
    <Card><h2 className='font-serif'>Parameters</h2><p>Thresholds/quorum, periods, bond params, slash bps.</p></Card>
    <Card><h2 className='font-serif'>Identity</h2><p>ENS registry/nameWrapper/ensJobPages/merkle roots/baseIpfsUrl + lockIdentityConfiguration.</p><Input placeholder='Type LOCK to confirm' /></Card>
    <Card><h2 className='font-serif'>Treasury</h2><p>Withdraw requires paused && !settlementPaused.</p></Card>
  </div>;
}
