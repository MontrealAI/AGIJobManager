import { OFFICIAL_DEPLOYMENTS as d } from '@/generated/deployments';
export default function IdentityPage() {
  return <main className='container-shell space-y-6 py-10'>
    <h1 className='text-3xl font-semibold'>ENS Identity</h1>
    <p>Identity credentials remain separate from USDC settlement.</p>
    <p>ENS job pages: {d.ensJobPagesAddress || 'Deployment and manager wiring required for v0.8.0.'}</p>
    <p>{d.note}</p>
  </main>;
}
