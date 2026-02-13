import { Card } from '@/components/ui/card';
import { scenarioFromSearch } from '@/lib/demo';

export default function AdminPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const raw = new URLSearchParams();
  if (typeof searchParams?.scenario === 'string') raw.set('scenario', searchParams.scenario);
  if (typeof searchParams?.asOwner === 'string') raw.set('asOwner', searchParams.asOwner);
  const scenario = scenarioFromSearch(raw.toString());
  const actingAsOwner = raw.get('asOwner') === '1';

  if (!actingAsOwner) return <div className="container py-8"><Card>Not authorized (owner only).</Card></div>;

  return (
    <div className="container py-8 space-y-3">
      <Card><h2 className="font-serif text-2xl">Safety toggles</h2><p>pause/unpause · setSettlementPaused</p><input className="mt-2 border border-border rounded-md px-2 py-1" placeholder="Type PAUSE to confirm" /></Card>
      <Card><h2 className="font-serif text-2xl">Roles</h2><p>moderators · additional agents/validators · blacklists</p></Card>
      <Card><h2 className="font-serif text-2xl">Parameters</h2><p>quorum/thresholds/periods/bonds/slash</p></Card>
      <Card><h2 className="font-serif text-2xl">Identity + treasury</h2><p>Owner {scenario.owner}; lockIdentityConfiguration; withdrawableAGI.</p></Card>
    </div>
  );
}
