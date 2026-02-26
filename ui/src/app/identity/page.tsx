'use client';

import { Card } from '@/components/ui/card';
import { useDemoScenario } from '@/lib/demo';
import { deriveJobIdentitySnapshot } from '@/lib/ens';
import { OFFICIAL_DEPLOYMENTS } from '@/generated/deployments';

export default function IdentityPage() {
  const scenario = useDemoScenario();
  const snapshots = (scenario.jobs ?? [])
    .filter((job): job is NonNullable<typeof job> => job !== null)
    .map((job) => deriveJobIdentitySnapshot(job.id));

  return (
    <div className='container-shell py-8 space-y-4' data-testid='identity-console'>
      <Card>
        <h1 className='font-serif text-3xl'>ENS Identity Layer</h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          Deterministic job ENS names and read-only identity snapshots for ENSJobPages.
        </p>
      </Card>
      <Card>
        <h2 className='text-lg font-semibold'>Deployment</h2>
        <p className='mt-2 text-sm'>
          ENSJobPages address: <span className='font-mono'>{OFFICIAL_DEPLOYMENTS.ensJobPages.addresses.ENSJobPages}</span>
        </p>
      </Card>
      <Card>
        <h2 className='text-lg font-semibold'>Derived job identities</h2>
        <ul className='mt-3 space-y-2 text-sm'>
          {snapshots.map((snapshot) => (
            <li key={snapshot.jobId} className='rounded border border-border p-2'>
              <p>
                Job {snapshot.jobId}: <span className='font-mono'>{snapshot.ensName}</span>
              </p>
              <p className='text-muted-foreground'>Profile URI: {snapshot.profileUri}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
