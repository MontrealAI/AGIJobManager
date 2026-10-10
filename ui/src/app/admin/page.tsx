'use client';
import { usePlatformSummary } from '@/lib/web3/queries';
import { Card } from '@/components/ui/card';
import { useDemoScenario, isDemoMode } from '@/lib/demo';

export default function Admin() {
  const scenario = useDemoScenario();
  const { data, isPending, isError, refetch } = usePlatformSummary(scenario);
  return <div className='container-shell py-8 space-y-3'>
    <h1 className='font-serif text-2xl'>Platform configuration</h1>
    <Card><h2 className='font-serif'>Owner controls</h2><p>This dashboard is read-only. Use the USDC console for wallet-authorized owner actions. Wallet changes require paused intake and no reserved escrow. NFT collection changes require all escrow and bonds to be cleared. Existing jobs keep their NFT policy.</p><p className='mt-2'><a className='underline' href='https://montrealai.github.io/AGIJobManager/agijobmanager-usdc.html'>Open the USDC console</a> · <a className='underline' href='https://github.com/MontrealAI/AGIJobManager/blob/main/docs/OWNER_CONTROLS.md' target='_blank' rel='noopener noreferrer'>Owner guide</a></p></Card>
    {isDemoMode && <Card>Demo configuration. Writes disabled.</Card>}
    {isPending ? <Card>Loading configuration…</Card> : isError || !data ? <Card><p role='alert'>Configuration unavailable. Check the deployment and RPC connection.</p><button className='btn-outline' onClick={() => refetch()}>Retry</button></Card> : <Card><dl className='space-y-2'><dt>Owner</dt><dd className='break-all'>{data.owner}</dd><dt>Intake paused</dt><dd>{String(data.paused)}</dd><dt>Settlement paused</dt><dd>{String(data.settlementPaused)}</dd><dt>Vote quorum</dt><dd>{String(data.voteQuorum)}</dd><dt>Required approvals / disapprovals</dt><dd>{String(data.requiredValidatorApprovals)} / {String(data.requiredValidatorDisapprovals)}</dd></dl></Card>}
  </div>;
}
