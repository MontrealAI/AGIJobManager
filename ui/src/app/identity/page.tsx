import { OFFICIAL_DEPLOYMENTS as d } from '@/generated/deployments';
export default function IdentityPage() {
  return <main className='container-shell space-y-6 py-10'>
    <h1 className='text-3xl font-semibold'>ENS Identity</h1>
    <p>AGI Agents use a subname under agent.agi.eth; AGI Club validators use a subname under club.agi.eth. The alpha.agent.agi.eth and alpha.club.agi.eth routes remain supported.</p>
    <p>USDC changes settlement, while membership authorization keeps the legacy ENS, owner allowlist, and Merkle-proof routes. Agents also need an enabled NFT credential when their job requires one. The owner’s default is recorded for each new job; turning it off leaves ENS authorization, bonds and payments unchanged.</p>
    <p>ENS job pages name individual jobs. Their optional configuration does not replace member identity checks.</p>
    <p>ENS job pages: {d.ensJobPagesAddress || 'Deployment and manager wiring required for v0.9.4.'}</p>
    <p>{d.note}</p>
  </main>;
}
