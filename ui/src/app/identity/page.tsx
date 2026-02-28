import { Card } from '@/components/ui/card';
import { OFFICIAL_DEPLOYMENTS } from '@/generated/deployments';

export default function IdentityPage() {
  const ensAddress = OFFICIAL_DEPLOYMENTS.ensJobPages.addresses.ENSJobPages;
  const rootName = OFFICIAL_DEPLOYMENTS.ensJobPages.constructorArgs.ENSJobPages.rootName;

  return (
    <section className='container-shell space-y-6 py-10'>
      <h1 className='text-3xl font-semibold'>Identity Layer Console</h1>
      <p className='text-muted-foreground'>
        ENSJobPages identity-layer details are sourced from canonical mainnet deployment artifacts.
      </p>
      <Card className='space-y-2'>
        <div><strong>ENSJobPages:</strong> {ensAddress}</div>
        <div><strong>Root name:</strong> {rootName}</div>
        <div><strong>Registry:</strong> {OFFICIAL_DEPLOYMENTS.agiJobManager.constructorArgs.ensConfig[0]}</div>
        <div><strong>NameWrapper:</strong> {OFFICIAL_DEPLOYMENTS.agiJobManager.constructorArgs.ensConfig[1]}</div>
      </Card>
      <Card>
        <p className='text-sm text-muted-foreground'>
          Derived naming format: <code>job-&lt;jobId&gt;.{rootName}</code>
        </p>
      </Card>
    </section>
  );
}
