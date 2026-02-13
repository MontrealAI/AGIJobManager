'use client'
import Link from 'next/link'
import { GlobalBanners } from '@/components/banners'
import { useReadContracts } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'

export default function HomePage() {
  const config = useReadContracts({
    contracts: ['requiredValidatorApprovals', 'requiredValidatorDisapprovals', 'voteQuorum', 'completionReviewPeriod', 'disputeReviewPeriod'].map((functionName) => ({
      abi: agiJobManagerAbi,
      address: env.agiJobManagerAddress as `0x${string}`,
      functionName: functionName as any
    })),
    allowFailure: true
  })

  return (
    <div className="space-y-6">
      <GlobalBanners />
      <section className="card rounded-[18px] p-7">
        <h1 className="text-4xl leading-[44px]">AGI Job Manager</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">Institutional-grade orchestration for AGI work orders, on-chain validation, and dispute resolution.</p>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5"><h2 className="text-xl">Create Job</h2><p className="mt-2 text-sm text-muted-foreground">Wallet required. Preflight and simulation checks are enforced.</p></div>
        <div className="card p-5"><h2 className="text-xl">Browse Jobs</h2><Link className="btn inline-block mt-3" href="/jobs">Open registry</Link></div>
        <div className="card p-5"><h2 className="text-xl">Platform Config</h2><ul className="mt-2 space-y-1 text-sm text-muted-foreground">{config.data?.map((entry, i) => <li key={i}>{String(entry.result ?? '—')}</li>)}</ul></div>
      </div>
    </div>
  )
}
