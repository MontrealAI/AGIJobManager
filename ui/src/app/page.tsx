import Link from 'next/link'
import { GlobalBanners } from '@/components/banners'

export default function HomePage() {
  return (
    <div className="space-y-6">
      <GlobalBanners />
      <section className="hero">
        <p className="text-sm text-muted-foreground uppercase tracking-wider">AGIJobManager</p>
        <h1 className="mt-2 text-[40px] leading-[44px]">Sovereign AGI Work Settlement Console</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Read-only by default. Connect a wallet only to execute role-gated contract actions.</p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="card-shell"><h2 className="text-2xl">Create Job</h2><p className="mt-2 text-sm text-muted-foreground">Wallet required. Includes preflight checks and simulation-first execution.</p></div>
        <div className="card-shell"><h2 className="text-2xl">Browse Jobs</h2><p className="mt-2 text-sm text-muted-foreground">Inspect lifecycle, deadlines, disputes, and completion records.</p><Link href="/jobs" className="btn-primary inline-block mt-3">Open jobs</Link></div>
        <div className="card-shell"><h2 className="text-2xl">Platform Config</h2><p className="mt-2 text-sm text-muted-foreground">Review settlement windows, voting thresholds, and pause flags.</p></div>
      </section>
    </div>
  )
}
