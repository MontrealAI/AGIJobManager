'use client'
import Link from 'next/link'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'
import { useReadContract, useReadContracts } from 'wagmi'
import { deriveJobStatus } from '@/lib/job'
import { useMemo, useState } from 'react'

const zero = '0x0000000000000000000000000000000000000000'

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

  return <div className="space-y-4"><h1 className="text-xl font-semibold">Jobs</h1><input value={query} onChange={(e) => setQuery(e.target.value)} className="input" placeholder="Search by id/address/status" />
    <div className="space-y-2">{ids.map((id, i) => {
      const core = jobs.data?.[i]?.result as any
      const validation = vals.data?.[i]?.result as any
      if (!core) return null
      const status = deriveJobStatus({ ...core }, { ...(validation || { approvals: 0, disapprovals: 0, disputed: false }) }, Math.floor(Date.now() / 1000))
      const text = `${id} ${core.employer} ${core.agent} ${status}`.toLowerCase()
      if (query && !text.includes(query.toLowerCase())) return null
      return <Link key={id.toString()} className="card block" href={`/jobs/${id.toString()}`}>
        <div className="flex justify-between"><span>Job #{id.toString()}</span><span className="text-xs uppercase">{status}</span></div>
        <div className="text-sm text-slate-400">Employer: {core.employer.slice(0, 8)}... Agent: {core.agent === zero ? 'unassigned' : core.agent.slice(0, 8)}</div>
      </Link>
    })}</div></div>
}
