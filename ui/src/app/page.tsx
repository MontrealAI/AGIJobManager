import Link from 'next/link'
import { TopBanners } from '@/components/banners'

export default function Dashboard() {
  const degraded = !process.env.RPC_MAINNET_URL && !process.env.RPC_SEPOLIA_URL
  return (
    <div className="space-y-6">
      <TopBanners degraded={degraded} />
      <section className="hero">
        <h1 className="text-4xl">ASI Sovereign Job Settlement Console</h1>
        <p className="mt-2 text-muted-foreground">Read-only friendly dapp + operations console with simulation-first writes.</p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="card-shell"><h2 className="text-2xl">Create Job</h2><p className="text-sm text-muted-foreground">Wallet required. Preflight + simulation before send.</p></div>
        <div className="card-shell"><h2 className="text-2xl">Browse Jobs</h2><Link href="/jobs" className="btn-primary mt-3 inline-block">Open Jobs</Link></div>
        <div className="card-shell"><h2 className="text-2xl">Platform Summary</h2><p className="text-sm text-muted-foreground">Inspect thresholds, periods, and lock status.</p></div>
      </section>
    </div>
  )
}
