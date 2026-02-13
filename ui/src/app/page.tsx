import Link from 'next/link'
import { GlobalBanners } from '@/components/banners'

export default function HomePage() {
  return (
    <div>
      <GlobalBanners />
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card"><h2 className="font-semibold">Create Job</h2><p className="text-sm text-slate-400">Connect wallet to create jobs.</p></div>
        <div className="card"><h2 className="font-semibold">Browse Jobs</h2><Link className="btn inline-block mt-2" href="/jobs">Open jobs</Link></div>
        <div className="card"><h2 className="font-semibold">Platform Config</h2><p className="text-sm text-slate-400">View global thresholds and review periods in job detail pages.</p></div>
      </div>
    </div>
  )
}
