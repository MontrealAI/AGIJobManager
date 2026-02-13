'use client';
import { useAccount } from 'wagmi';
import { useState } from 'react';
import { usePlatformSummary } from '@/lib/web3/queries';
import { Card } from '@/components/ui/card';
import { useDemoScenario, isDemoMode } from '@/lib/demo';

const confirms = ['PAUSE', 'SETTLEMENT', 'LOCK', 'WITHDRAW'] as const;

export default function Admin() {
  const { address } = useAccount();
  const scenario = useDemoScenario();
  const { data } = usePlatformSummary(scenario);
  const [typed, setTyped] = useState('');
  const owner = data?.owner?.toLowerCase();
  const demoOwner = isDemoMode;
  if ((!address || !owner || address.toLowerCase() !== owner) && !demoOwner) return <div className='container-shell py-8'><Card>Not authorized (owner only).</Card></div>;
  return <div className='container-shell py-8 space-y-3'>
    <Card><h2 className='font-serif'>Safety toggles</h2><p>Pause/unpause and settlement pause with simulation-first writes.</p></Card>
    <Card><h2 className='font-serif'>Roles</h2><p>Manage moderators and allowlists / blacklists.</p></Card>
    <Card><h2 className='font-serif'>Parameters & identity</h2><p>Thresholds, review periods, ENS wiring and lockIdentityConfiguration.</p></Card>
    <Card><h2 className='font-serif'>Treasury</h2><p>Withdraw requires paused && !settlementPaused.</p><input className='input-shell mt-2' placeholder='Type PAUSE / SETTLEMENT / LOCK / WITHDRAW' value={typed} onChange={(e) => setTyped(e.target.value)} /><p className='text-xs mt-2'>Valid tokens: {confirms.join(', ')}. {confirms.includes(typed as any) ? 'Confirmed token recognized.' : 'No dangerous action armed.'}</p></Card>
  </div>;
}
