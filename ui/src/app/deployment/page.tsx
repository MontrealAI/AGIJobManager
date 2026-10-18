import { OFFICIAL_DEPLOYMENTS as d, RECORDED_MAINNET_INSTANCE as r, LATEST_REPORTED_MAINNET_INSTANCE as l } from '@/generated/deployments';
export default function DeploymentPage() {
  return <main className='container-shell space-y-6 py-10'>
    <h1 className='text-3xl font-semibold'>USDC software and deployment records</h1>
    <section aria-labelledby='latest-reported-instance' className='space-y-3 rounded-xl border p-6'>
      <h2 id='latest-reported-instance' className='text-2xl font-semibold'>Latest reported Manager deployment · {l.recordDate}</h2>
      <p>{l.contractCount} creations reported finalized on Ethereum mainnet. Explorer report: {l.exactMatches} Exact Match and {l.retainedSimilarMatches} retained Similar Match.</p>
      <p>Owner-reported authority snapshot at block {l.block.toLocaleString('en-US')}: intake {l.intakePaused ? 'paused' : 'not paused'}. Paid intake remains held.</p>
      <p><strong>Recorded evidence, not live state.</strong> No wallet is needed. This record does not establish an ENS helper attachment or select a transaction target.</p>
      <dl className='space-y-2 break-all'>
        <dt>Latest reported manager</dt><dd><a href={l.managerCodeUrl} target='_blank' rel='noopener noreferrer'>{l.manager}</a></dd>
        <dt>Selected source commit</dt><dd>{l.sourceCommit}</dd>
        <dt>Reported owner</dt><dd>{l.owner}</dd>
        <dt>Authority snapshot block hash</dt><dd>{l.blockHash}</dd>
      </dl>
      <p><a href={`https://github.com/MontrealAI/AGIJobManager/blob/${l.evidenceRevision}/${l.guidePath}`} target='_blank' rel='noopener noreferrer'>Review the latest deployment and all nine contracts</a> · <a href={`https://github.com/MontrealAI/AGIJobManager/blob/${l.evidenceRevision}/${l.recordPath}`} target='_blank' rel='noopener noreferrer'>Machine-readable record</a></p>
    </section>
    <section aria-labelledby='recorded-instance' className='space-y-3 rounded-xl border p-6'>
      <h2 id='recorded-instance' className='text-2xl font-semibold'>Historical instance · October 10, 2026</h2>
      <p>Historical deployment and ENS connection recorded on {r.recordDate} at Ethereum block {r.block.toLocaleString('en-US')}. This older instance and its helper are separate from the latest reported Manager above.</p>
      <p><strong>Current status: unavailable.</strong> This page makes no live RPC query and does not select a transaction target. No wallet is needed to view this history.</p>
      <dl className='space-y-2 break-all'>
        <dt>Chain</dt><dd>Ethereum mainnet · {r.chainId}</dd>
        <dt>Recorded manager</dt><dd>{r.manager}</dd>
        <dt>Recorded ENS helper</dt><dd>{r.helper}</dd>
        <dt>Job namespace</dt><dd>{r.namespace}</dd>
        <dt>Observation block hash</dt><dd>{r.blockHash}</dd>
      </dl>
      <a href={`https://github.com/MontrealAI/AGIJobManager/blob/${l.evidenceRevision}/docs/deployments/MAINNET_USDC_2026-10-10.md`} target='_blank' rel='noopener noreferrer'>Review the October 10 historical record</a>
    </section>
    <h2 className='text-2xl font-semibold'>Generic transaction configuration</h2>
    <p>AGIJobManager v{d.version}: {d.status}.</p><p>{d.note}</p>
    <dl className='space-y-3 break-all'>
      <dt>Chain ID</dt><dd>{d.chainId}</dd>
      <dt>Manager</dt><dd>{d.managerAddress || 'No manager selected'}</dd>
      <dt>Settlement token</dt><dd>USDC ({d.usdc.decimals} decimals): {d.usdc.address}</dd>
      <dt>30% settlement wallet</dt><dd>{d.settlementWallets.wallet30 || 'Required at deployment'}</dd>
      <dt>10% settlement wallet</dt><dd>{d.settlementWallets.wallet10 || 'Required at deployment'}</dd>
      <dt>Successful job distribution</dt><dd>Validators first (8% default), then 30% and 10% of the original USDC job cost, then the remaining balance to the agent.</dd>
      <dt>Owner maintenance</dt><dd>Payout wallets can change only while intake is paused and all escrow is settled. A new owner must accept an ownership proposal.</dd>
      <dt>ENS job pages</dt><dd>{d.ensJobPagesAddress || 'No helper selected'}</dd>
    </dl>
    <a href={d.addressSource} target='_blank' rel='noopener noreferrer'>Circle USDC address reference</a>
  </main>;
}
