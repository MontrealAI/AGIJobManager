'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'
import { deriveJobStatus } from '@/lib/jobStatus'
import { formatToken, shortAddress } from '@/lib/format'

export default function JobsPage() {
  const [filter, setFilter] = useState('')
  const nextJob = useReadContract({ abi: agiJobManagerAbi, address: env.jobManager, functionName: 'nextJobId' })
  const ids = useMemo(() => {
    const n = Number(nextJob.data || 0n)
    return Array.from({ length: Math.min(25, n) }, (_, i) => BigInt(n - 1 - i))
  }, [nextJob.data])

  const bundle = useReadContracts({
    contracts: ids.flatMap((jobId) => [
      { abi: agiJobManagerAbi, address: env.jobManager, functionName: 'getJobCore', args: [jobId] as const },
      { abi: agiJobManagerAbi, address: env.jobManager, functionName: 'getJobValidation', args: [jobId] as const }
    ]),
    allowFailure: true
  })

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Jobs</h1>
      <input value={filter} onChange={(e) => setFilter(e.target.value.toLowerCase())} className="input-shell" placeholder="Filter by id/address/status" />
      <table className="w-full overflow-hidden rounded-xl border text-sm">
        <thead><tr className="bg-muted/40 text-left"><th className="p-2">Job</th><th>Status</th><th>Payout</th><th>Employer</th><th>Agent</th></tr></thead>
        <tbody>
          {ids.map((id, idx) => {
            const core = bundle.data?.[idx * 2]?.result as any
            const validation = bundle.data?.[idx * 2 + 1]?.result as any
            if (!core || !validation) return null
            const status = deriveJobStatus(core, validation)
            const row = `${id} ${core.employer} ${core.assignedAgent} ${status.label}`.toLowerCase()
            if (filter && !row.includes(filter)) return null
            return (
              <tr key={id.toString()} className="border-t hover:bg-muted/30">
                <td className="p-2"><Link className="underline" href={`/jobs/${id}`}>#{id.toString()}</Link></td>
                <td>{status.label}</td>
                <td>{formatToken(core.payout)}</td>
                <td>{shortAddress(core.employer)}</td>
                <td>{shortAddress(core.assignedAgent)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
