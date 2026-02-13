'use client';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { usePlatformSummary } from '@/lib/web3/queries';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function Admin() {
  const [scenario, setScenario] = useState<string | undefined>(undefined);
  useEffect(() => { setScenario(new URLSearchParams(window.location.search).get('scenario') || undefined); }, []);
  const { address } = useAccount();
  const { data } = usePlatformSummary(scenario);
  const owner = data?.owner?.toLowerCase();
  if (!address || !owner || address.toLowerCase() !== owner) return <div className="container py-8"><Card>Not authorized (owner only).</Card></div>;
  return <div className="container py-8 space-y-3">
    <Card><h2 className="font-serif">Safety toggles</h2><p>Pause/unpause and settlement pause with typed confirmation.</p><Input placeholder="Type PAUSE to confirm"/></Card>
    <Card><h2 className="font-serif">Roles</h2><p>Manage moderators and allowlists / blacklists.</p></Card>
    <Card><h2 className="font-serif">Treasury</h2><p>Withdraw requires paused && !settlementPaused.</p><Input placeholder='Type WITHDRAW to confirm'/></Card>
  </div>;
}
