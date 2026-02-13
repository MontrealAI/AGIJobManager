import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">ASI Sovereign Console</p>
        <h1 className="mt-2 text-4xl">AGIJobManager Dapp + Ops Console</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Read-only by default. Wallet connect only unlocks role-gated actions. Every write uses preflight checks and simulation-first execution.</p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="card-shell"><h2 className="text-2xl">Create Job</h2><p className="mt-2 text-sm text-muted-foreground">Wallet required; disabled when safety toggles are active.</p></div>
        <div className="card-shell"><h2 className="text-2xl">Browse Jobs</h2><p className="mt-2 text-sm text-muted-foreground">Lifecycle, deadlines, validator votes, disputes and outcomes.</p><Link href="/jobs" className="btn-primary mt-3 inline-block">Open Jobs</Link></div>
        <div className="card-shell"><h2 className="text-2xl">Platform Summary</h2><p className="mt-2 text-sm text-muted-foreground">Review periods, quorum thresholds, and lock controls.</p></div>
      </section>
    </div>
  )
}
