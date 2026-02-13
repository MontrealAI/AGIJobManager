'use client';
export const dynamic = 'force-dynamic';
import { Card } from '@/components/ui/card';
import { currentScenario } from '@/lib/demo';

export default function AdminPage() {
  const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');
  const scenario = currentScenario(typeof window !== 'undefined' ? window.location.search : '');
  const asOwner = query.get('asOwner') === '1';

  if (!asOwner) return <div className='container py-8'><Card>Not authorized (owner only).</Card></div>;

  return (
    <div className='container py-8 space-y-4'>
      <Card><h2 className='font-serif text-2xl'>Safety toggles</h2><p>pause/unpause, setSettlementPaused with typed confirmations (PAUSE / SETTLEMENT)</p></Card>
      <Card><h2 className='font-serif text-2xl'>Roles</h2><p>moderators, allowlists, blacklists, additional agents/validators</p></Card>
      <Card><h2 className='font-serif text-2xl'>Identity & treasury</h2><p>owner: {scenario.owner} · withdrawable + lock identity controls</p></Card>
    </div>
  );
}
