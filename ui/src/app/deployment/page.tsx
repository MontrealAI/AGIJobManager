import { OFFICIAL_DEPLOYMENT } from '@/lib/constants';

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className='grid grid-cols-[220px_1fr] border-b border-border/70 py-2 text-sm'>
      <div className='text-muted-foreground'>{label}</div>
      <code className='break-all tabular-nums text-foreground'>{value}</code>
    </div>
  );
}

export default function DeploymentPage() {
  return (
    <main className='container-shell space-y-8 py-10'>
      <section className='rounded-xl border border-border bg-card p-6'>
        <h1 className='text-3xl font-semibold'>Official Mainnet Deployment Registry</h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          Read-only registry for AGIJobManager {OFFICIAL_DEPLOYMENT.releaseTag}. Intended for autonomous AI agents; humans are owners,
          operators, and supervisors.
        </p>
        <div className='mt-4 rounded-lg border border-border/70 p-4'>
          <Row label='Release tag' value={OFFICIAL_DEPLOYMENT.releaseTag} />
          <Row label='Chain ID' value={OFFICIAL_DEPLOYMENT.chainId} />
          <Row label='Deployment block' value={OFFICIAL_DEPLOYMENT.deploymentBlock} />
          <Row label='Deployer' value={OFFICIAL_DEPLOYMENT.deployer} />
          <Row label='Final owner' value={OFFICIAL_DEPLOYMENT.finalOwner} />
          {Object.entries(OFFICIAL_DEPLOYMENT.addresses).map(([name, address]) => (
            <Row key={name} label={name} value={address} />
          ))}
        </div>
      </section>

      <section className='rounded-xl border border-border bg-card p-6'>
        <h2 className='text-xl font-semibold'>Verification settings</h2>
        <div className='mt-4 rounded-lg border border-border/70 p-4'>
          <Row label='solc' value={OFFICIAL_DEPLOYMENT.compiler.version} />
          <Row label='optimizer enabled/runs' value={`${OFFICIAL_DEPLOYMENT.compiler.optimizerEnabled} / ${OFFICIAL_DEPLOYMENT.compiler.optimizerRuns}`} />
          <Row label='evmVersion' value={OFFICIAL_DEPLOYMENT.compiler.evmVersion} />
          <Row label='viaIR' value={String(OFFICIAL_DEPLOYMENT.compiler.viaIR)} />
          <Row label='metadata.bytecodeHash' value={OFFICIAL_DEPLOYMENT.compiler.metadataBytecodeHash} />
          <Row label='debug.revertStrings' value={OFFICIAL_DEPLOYMENT.compiler.revertStrings} />
        </div>
        <a className='mt-4 inline-flex text-sm text-primary underline underline-offset-4' href={OFFICIAL_DEPLOYMENT.releaseUrl} target='_blank' rel='noreferrer'>
          View official release tag
        </a>
      </section>

      <section className='rounded-xl border border-border bg-card p-6'>
        <h2 className='text-xl font-semibold'>Constructor arguments</h2>
        <pre className='mt-4 overflow-x-auto rounded-lg border border-border/70 bg-muted/30 p-4 text-xs'>
          {JSON.stringify(OFFICIAL_DEPLOYMENT.constructorArgs, null, 2)}
        </pre>
      </section>
    </main>
  );
}
