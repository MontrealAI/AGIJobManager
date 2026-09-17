import { OFFICIAL_DEPLOYMENTS as d } from '@/generated/deployments';
export default function DeploymentPage() {
  return <main className='container-shell space-y-6 py-10'>
    <h1 className='text-3xl font-semibold'>USDC Deployment Registry</h1>
    <p>AGIJobManager v{d.version}: {d.status}.</p><p>{d.note}</p>
    <dl className='space-y-3 break-all'>
      <dt>Chain ID</dt><dd>{d.chainId}</dd>
      <dt>Manager</dt><dd>{d.managerAddress || 'Not deployed'}</dd>
      <dt>Settlement token</dt><dd>USDC ({d.usdc.decimals} decimals): {d.usdc.address}</dd>
      <dt>30% settlement wallet</dt><dd>{d.settlementWallets.wallet30 || 'Required at deployment'}</dd>
      <dt>10% settlement wallet</dt><dd>{d.settlementWallets.wallet10 || 'Required at deployment'}</dd>
      <dt>Successful job distribution</dt><dd>Validators first (8% default), then 30% and 10% of the original USDC job cost, then the remaining balance to the agent.</dd>
      <dt>Owner maintenance</dt><dd>Payout wallets can change only while intake is paused and all escrow is settled. A new owner must accept an ownership proposal.</dd>
      <dt>ENS job pages</dt><dd>{d.ensJobPagesAddress || 'Not configured'}</dd>
    </dl>
    <a href={d.addressSource} target='_blank' rel='noopener noreferrer'>Circle USDC address reference</a>
  </main>;
}
