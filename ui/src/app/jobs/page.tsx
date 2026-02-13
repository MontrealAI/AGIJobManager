'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'
import { deriveJobStatus } from '@/lib/job'
import { formatEther } from 'viem'

export default function JobsPage() {
  const [query, setQuery] = useState('')
  const nextId = useReadContract({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'nextJobId' })

  const ids = useMemo(() => {
    const n = Number(nextId.data || 0n)
    return Array.from({ length: Math.min(n, 50) }, (_, i) => BigInt(n - i - 1))
  }, [nextId.data])

  const cores = useReadContracts({
    contracts: ids.map((id) => ({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobCore', args: [id] })),
    allowFailure: true
  })
  const vals = useReadContracts({
    contracts: ids.map((id) => ({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobValidation', args: [id] })),
    allowFailure: true
  })

  return (
    <div className="space-y-4">
      <h1 className="text-[32px] leading-[36px]">Jobs</h1>
      <input className="input-shell" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by id, address, or status" />
      <div className="overflow-hidden rounded-[14px] border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr><th className="p-3">Job</th><th>Payout</th><th>Status</th><th>Employer</th><th>Agent</th></tr></thead>
          <tbody>
            {ids.map((id, i) => {
              const core = cores.data?.[i]?.result as any
              const val = vals.data?.[i]?.result as any
              if (!core) return null
              const status = deriveJobStatus(core, val || { approvals: 0, disapprovals: 0, disputed: false }, Math.floor(Date.now() / 1000))
              const haystack = `${id} ${core.employer} ${core.agent} ${status}`.toLowerCase()
              if (query && !haystack.includes(query.toLowerCase())) return null
              return (
                <tr key={id.toString()} className="border-t hover:bg-primary/5">
                  <td className="p-3"><Link href={`/jobs/${id}`} className="underline">#{id.toString()}</Link></td>
                  <td>{Number(formatEther(core.payout)).toFixed(4)} AGI</td>
                  <td><span className="pill">{status}</span></td>
                  <td>{core.employer.slice(0, 8)}…</td>
                  <td>{core.agent.slice(0, 8)}…</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
