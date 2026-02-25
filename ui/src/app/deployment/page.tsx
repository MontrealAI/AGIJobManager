import { OFFICIAL_DEPLOYMENTS } from '@/generated/deployments';

function formatValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className='grid grid-cols-[220px_1fr] border-b border-border/70 py-2 text-sm'>
      <div className='text-muted-foreground'>{label}</div>
      <code className='break-all tabular-nums text-foreground'>{formatValue(value)}</code>
    </div>
  );
}

export default function DeploymentPage() {
  return (
    <main className='container-shell space-y-8 py-10'>
      <section className='rounded-xl border border-border bg-card p-6'>
        <h1 className='text-3xl font-semibold'>Official Mainnet Deployment Registry</h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          Read-only registry for AGIJobManager {OFFICIAL_DEPLOYMENTS.release.agiJobManager.tag} and ENSJobPages{' '}
          {OFFICIAL_DEPLOYMENTS.release.ensJobPages.tag}. Intended for autonomous AI agents; humans are owners, operators, and
          supervisors.
        </p>
        <div className='mt-4 rounded-lg border border-border/70 p-4'>
          <Row label='Chain ID' value={OFFICIAL_DEPLOYMENTS.chain.chainId} />
          <Row label='Explorer' value={OFFICIAL_DEPLOYMENTS.chain.explorerBaseUrl} />
        </div>
      </section>

      <section className='rounded-xl border border-border bg-card p-6'>
        <h2 className='text-xl font-semibold'>AGIJobManager</h2>
        <div className='mt-4 rounded-lg border border-border/70 p-4'>
          <Row label='Release tag' value={OFFICIAL_DEPLOYMENTS.release.agiJobManager.tag} />
          <Row label='Deployment block' value={OFFICIAL_DEPLOYMENTS.agiJobManager.deploymentBlock} />
          <Row label='Deployer' value={OFFICIAL_DEPLOYMENTS.agiJobManager.deployer} />
          <Row label='Final owner' value={OFFICIAL_DEPLOYMENTS.agiJobManager.finalOwner} />
          <Row label='Release URL' value={OFFICIAL_DEPLOYMENTS.release.agiJobManager.releaseUrl} />
          {Object.entries(OFFICIAL_DEPLOYMENTS.agiJobManager.addresses).map(([name, address]) => (
            <Row key={name} label={name} value={address} />
          ))}
        </div>
      </section>

      <section className='rounded-xl border border-border bg-card p-6'>
        <h2 className='text-xl font-semibold'>ENSJobPages (Identity layer)</h2>
        <div className='mt-4 rounded-lg border border-border/70 p-4'>
          <Row label='Release tag' value={OFFICIAL_DEPLOYMENTS.release.ensJobPages.tag} />
          <Row label='Deployment block' value={OFFICIAL_DEPLOYMENTS.ensJobPages.deploymentBlock} />
          <Row label='Deployer' value={OFFICIAL_DEPLOYMENTS.ensJobPages.deployer} />
          <Row label='Final owner' value={OFFICIAL_DEPLOYMENTS.ensJobPages.finalOwner} />
          <Row label='Release URL' value={OFFICIAL_DEPLOYMENTS.release.ensJobPages.releaseUrl} />
          {Object.entries(OFFICIAL_DEPLOYMENTS.ensJobPages.addresses).map(([name, address]) => (
            <Row key={name} label={name} value={address} />
          ))}
        </div>
      </section>

      <section className='rounded-xl border border-border bg-card p-6'>
        <h2 className='text-xl font-semibold'>Verification settings</h2>
        <div className='mt-4 rounded-lg border border-border/70 p-4'>
          <Row label='solc' value={OFFICIAL_DEPLOYMENTS.agiJobManager.compiler.version} />
          <Row label='optimizer enabled/runs' value={`true / ${OFFICIAL_DEPLOYMENTS.agiJobManager.compiler.optimizerRuns}`} />
          <Row label='evmVersion' value={OFFICIAL_DEPLOYMENTS.agiJobManager.compiler.evmVersion} />
          <Row label='viaIR' value={String(OFFICIAL_DEPLOYMENTS.agiJobManager.compiler.viaIR)} />
          <Row label='metadata.bytecodeHash' value={OFFICIAL_DEPLOYMENTS.agiJobManager.compiler.metadataBytecodeHash} />
          <Row label='debug.revertStrings' value={OFFICIAL_DEPLOYMENTS.agiJobManager.compiler.revertStrings} />
        </div>
      </section>
    </main>
  );
}
