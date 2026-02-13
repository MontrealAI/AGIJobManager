'use client'
import Link from 'next/link'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'
import { useReadContract, useReadContracts } from 'wagmi'
import { deriveJobStatus } from '@/lib/job'
import { useMemo, useState } from 'react'

export default function JobsPage() {
  const [query, setQuery] = useState('')
  const nextId = useReadContract({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'nextJobId' })
  const ids = useMemo(() => {
    const n = Number(nextId.data || 0n)
    return Array.from({ length: Math.min(n, 30) }, (_, i) => BigInt(n - i - 1))
  }, [nextId.data])
  const jobs = useReadContracts({
    contracts: ids.map((id) => ({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'getJobCore', args: [id] })),
    allowFailure: true
  })
  const vals = useReadContracts({
    contracts: ids.map((id) => ({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'getJobValidation', args: [id] })),
    allowFailure: true
  })

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Jobs registry</h1>
      <input value={query} onChange={(e) => setQuery(e.target.value)} className="input" placeholder="Filter by id/address/status" />
      <div className="space-y-2">
        {ids.map((id, i) => {
          const core = jobs.data?.[i]?.result as any
          const validation = vals.data?.[i]?.result as any
          if (!core) return null
          const status = deriveJobStatus({ ...core }, { ...(validation || { approvals: 0, disapprovals: 0, disputed: false }) }, Math.floor(Date.now() / 1000))
          const text = `${id} ${core.employer} ${core.agent} ${status}`.toLowerCase()
          if (query && !text.includes(query.toLowerCase())) return null
          return (
            <Link key={id.toString()} className="card block p-4 hover:border-accent/40" href={`/jobs/${id.toString()}`}>
              <div className="flex justify-between"><span>Job #{id.toString()}</span><span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase">{status}</span></div>
              <div className="text-sm text-muted-foreground">Employer: {core.employer.slice(0, 8)}... Agent: {core.agent.slice(0, 8)}... Payout: {core.payout?.toString?.() ?? '0'}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
