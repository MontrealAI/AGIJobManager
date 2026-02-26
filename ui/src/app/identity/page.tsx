'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useJobs } from '@/lib/web3/queries';
import { useDemoScenario } from '@/lib/demo';
import { sanitizeUri } from '@/lib/web3/safeUri';

const ENS_ROOT = 'jobs.agi.eth';

function deriveJobEnsName(jobId: number) {
  return `job-${jobId}.${ENS_ROOT}`;
}

export default function IdentityPage() {
  const scenario = useDemoScenario();
  const { data } = useJobs(scenario);
  const [jobId, setJobId] = useState('0');

  const job = useMemo(() => {
    const id = Number(jobId);
    if (!Number.isFinite(id)) return undefined;
    return (data ?? []).find((entry: any) => entry.id === id);
  }, [data, jobId]);

  const ensName = deriveJobEnsName(Number(jobId || 0));
  const spec = sanitizeUri(job?.specUri || '');
  const completion = sanitizeUri(job?.completionUri || '');

  return (
    <div className="container-shell py-8 space-y-4" data-testid="identity-console">
      <Card>
        <h1 className="text-3xl font-serif">Identity Layer Console</h1>
        <p className="mt-2 text-sm text-muted-foreground">Derived ENS identity view for Job ENS Pages with copy-first rendering.</p>
      </Card>
      <Card>
        <label className="text-sm block">Job ID</label>
        <input
          className="input-shell mt-2 max-w-xs"
          aria-label="Identity job id"
          value={jobId}
          onChange={(event) => setJobId(event.target.value)}
        />
        <p className="mt-2 text-sm">Derived ENS name: <code>{ensName}</code></p>
      </Card>
      <Card>
        <h2 className="font-semibold">Record snapshot</h2>
        {!job && <p className="text-sm text-muted-foreground mt-2">No job found for this id in the current data source.</p>}
        {job && (
          <div className="mt-2 space-y-2 text-sm">
            <p>Spec URI: <code>{job.specUri || '(none)'}</code></p>
            <p>Completion URI: <code>{job.completionUri || '(none)'}</code></p>
            <p>Spec link status: {spec.safe ? 'allowlisted' : `blocked (${spec.reason})`}</p>
            <p>Completion link status: {completion.safe ? 'allowlisted' : `blocked (${completion.reason})`}</p>
            <button
              className="btn-outline"
              onClick={() => navigator.clipboard.writeText(JSON.stringify({ jobId: job.id, ensName, spec: job.specUri, completion: job.completionUri }, null, 2))}
            >
              Copy JSON
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
