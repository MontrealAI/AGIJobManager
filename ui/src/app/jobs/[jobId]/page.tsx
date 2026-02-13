'use client'
import { useParams } from 'next/navigation'
import { useAccount, usePublicClient, useReadContract, useReadContracts } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'
import { computeDeadlines, deriveJobStatus } from '@/lib/job'
import { TxButton } from '@/components/tx-button'
import { useMemo } from 'react'

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const id = BigInt(jobId)
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const bundle = useReadContracts({ contracts: [
    { abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'getJobCore', args: [id] },
    { abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'getJobValidation', args: [id] },
    { abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'getJobSpecURI', args: [id] },
    { abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'getJobCompletionURI', args: [id] },
    { abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'completionReviewPeriod' },
    { abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'disputeReviewPeriod' },
    { abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'challengePeriodAfterApproval' }
  ] })
  const logs = useMemo(async () => {
    if (!publicClient) return []
    return publicClient.getLogs({ address: env.agiJobManagerAddress as `0x${string}`, fromBlock: 'earliest', toBlock: 'latest' })
  }, [publicClient])

  const core = bundle.data?.[0]?.result as any
  const val = bundle.data?.[1]?.result as any
  if (!core) return <div>Loading...</div>
  const deadlines = computeDeadlines(core, { completionReview: bundle.data?.[4]?.result as bigint, disputeReview: bundle.data?.[5]?.result as bigint, challengeAfterApproval: bundle.data?.[6]?.result as bigint })
  const status = deriveJobStatus(core, val, Math.floor(Date.now() / 1000))

  return <div className="space-y-4"><h1 className="text-xl font-semibold">Job #{jobId}</h1>
    <div className="card space-y-2"><p>Status: {status}</p><p>Spec URI: {String(bundle.data?.[2]?.result || '')}</p><p>Completion URI: {String(bundle.data?.[3]?.result || '')}</p>
    <p>Expiry: {new Date(Number(deadlines.expiry) * 1000).toUTCString()}</p>
    <p>Completion review deadline: {new Date(Number(deadlines.completionReviewDeadline) * 1000).toUTCString()}</p>
    </div>
    <div className="grid md:grid-cols-2 gap-4">
      {address === core.employer && <div className="card"><h2>Employer actions</h2><TxButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'cancelJob', args: [id] }}>Cancel job</TxButton></div>}
      {address && <div className="card"><h2>Agent actions</h2><TxButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'applyForJob', args: [id, []] }}>Apply for job</TxButton></div>}
      <div className="card"><h2>Timeline</h2><p className="text-sm text-slate-400">On-chain activity feed uses event logs; if completion exists without event, shown as settled (inferred).</p><p className="text-xs">{JSON.stringify(logs).slice(0, 120)}...</p></div>
      {env.ensJobPagesAddress && <div className="card"><h2>ENS job page</h2><p>job-{jobId}</p><p>ens://job-{jobId}</p></div>}
    </div>
  </div>
}
