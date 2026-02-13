import { Card } from '@/components/ui/card';
import { scenarioFromSearch, isDemoMode } from '@/lib/demo';
import { JobsTable } from '@/components/jobs/jobs-table';

export default function JobsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const raw = new URLSearchParams();
  if (typeof searchParams?.scenario === 'string') raw.set('scenario', searchParams.scenario);
  const scenario = scenarioFromSearch(raw.toString());

  return (
    <div className="container py-8">
      <Card>
        <h1 className="font-serif text-3xl mb-2">Jobs ledger</h1>
        {isDemoMode ? <p className="text-sm text-muted-foreground">Deterministic demo fixtures with deleted slot handling.</p> : <p className="text-sm text-muted-foreground">On-chain multicall reads.</p>}
        <JobsTable scenario={scenario} />
      </Card>
    </div>
  );
}
