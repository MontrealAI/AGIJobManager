'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'
import { deriveJobUiStatus } from '@/lib/jobStatus'
import { formatToken, shortAddress, formatTimestamp } from '@/lib/format'

const zero = '0x0000000000000000000000000000000000000000' as const

export default function JobsPage() {
  const [query, setQuery] = useState('')
  const nextId = useReadContract({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'nextJobId' })
  const ids = useMemo(() => {
    const n = Number(nextId.data || 0n)
    return Array.from({ length: Math.min(n, 100) }, (_, i) => BigInt(n - i - 1))
  }, [nextId.data])

  const cores = useReadContracts({ contracts: ids.map((id) => ({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobCore', args: [id] })), allowFailure: true })
  const vals = useReadContracts({ contracts: ids.map((id) => ({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobValidation', args: [id] })), allowFailure: true })

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Jobs</h1>
      <input className="input-shell" placeholder="Filter by id/address/status" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="overflow-hidden rounded-[14px] border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left"><tr><th className="p-3">Job ID</th><th>Status</th><th>Payout</th><th>Employer</th><th>Agent</th><th>Key deadline</th></tr></thead>
          <tbody>
            {ids.map((id, i) => {
              const core = cores.data?.[i]?.result as any
              const val = vals.data?.[i]?.result as any
              if (!core) return null
              const status = deriveJobUiStatus({
                employer: core.employer,
                assignedAgent: core.agent,
                payout: core.payout,
                duration: core.duration,
                assignedAt: core.assignedAt,
                completed: core.completed,
                disputed: (val?.disputed as boolean) || false,
                expired: core.agent !== zero && !core.completed && Number(core.assignedAt + core.duration) < Date.now() / 1000,
                agentPayoutPct: 0
              }, {
                completionRequested: core.completionRequestedAt > 0n,
                approvals: Number(val?.approvals || 0),
                disapprovals: Number(val?.disapprovals || 0),
                completionRequestedAt: core.completionRequestedAt,
                disputedAt: core.disputedAt
              }).status

              const row = `${id} ${core.employer} ${core.agent} ${status}`.toLowerCase()
              if (query && !row.includes(query.toLowerCase())) return null

              return <tr key={id.toString()} className="border-t hover:bg-accent/5"><td className="p-3"><Link href={`/jobs/${id}`} className="underline">#{id.toString()}</Link></td><td>{status}</td><td>{formatToken(core.payout)}</td><td>{shortAddress(core.employer)}</td><td>{shortAddress(core.agent)}</td><td>{formatTimestamp(core.assignedAt + core.duration)}</td></tr>
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
