'use client'
import { useParams } from 'next/navigation'
import { useAccount, usePublicClient, useReadContracts } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'
import { computeDeadlines, deriveJobStatus } from '@/lib/job'
import { TxButton } from '@/components/tx-button'
import { useEffect, useState } from 'react'
import { isSafeUri } from '@/lib/security'

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const id = BigInt(jobId)
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [events, setEvents] = useState<{ eventName: string; blockNumber: bigint }[]>([])

  const bundle = useReadContracts({
    contracts: [
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'getJobCore', args: [id] },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'getJobValidation', args: [id] },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'getJobSpecURI', args: [id] },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'getJobCompletionURI', args: [id] },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'completionReviewPeriod' },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'disputeReviewPeriod' },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'challengePeriodAfterApproval' }
    ],
    allowFailure: true
  })

  useEffect(() => {
    if (!publicClient) return
    Promise.all([
      publicClient.getLogs({ address: env.agiJobManagerAddress as `0x${string}`, event: { type: 'event', name: 'JobCreated', inputs: [{ indexed: true, name: 'jobId', type: 'uint256' }] }, fromBlock: 0n, args: { jobId: id } }),
      publicClient.getLogs({ address: env.agiJobManagerAddress as `0x${string}`, event: { type: 'event', name: 'JobCompletionRequested', inputs: [{ indexed: true, name: 'jobId', type: 'uint256' }] }, fromBlock: 0n, args: { jobId: id } }),
      publicClient.getLogs({ address: env.agiJobManagerAddress as `0x${string}`, event: { type: 'event', name: 'JobDisputed', inputs: [{ indexed: true, name: 'jobId', type: 'uint256' }] }, fromBlock: 0n, args: { jobId: id } }),
      publicClient.getLogs({ address: env.agiJobManagerAddress as `0x${string}`, event: { type: 'event', name: 'JobCompleted', inputs: [{ indexed: true, name: 'jobId', type: 'uint256' }] }, fromBlock: 0n, args: { jobId: id } })
    ])
      .then((rows) => rows.flat().map((x) => ({ eventName: x.eventName, blockNumber: x.blockNumber ?? 0n })).sort((a, b) => Number(a.blockNumber - b.blockNumber)))
      .then(setEvents)
      .catch(() => setEvents([]))
  }, [id, publicClient])

  const core = bundle.data?.[0]?.result as any
  const val = bundle.data?.[1]?.result as any
  if (!core) return <div className="card p-4">Loading...</div>
  const deadlines = computeDeadlines(core, { completionReview: (bundle.data?.[4]?.result as bigint) ?? 0n, disputeReview: (bundle.data?.[5]?.result as bigint) ?? 0n, challengeAfterApproval: (bundle.data?.[6]?.result as bigint) ?? 0n })
  const status = deriveJobStatus(core, val, Math.floor(Date.now() / 1000))
  const specUri = String(bundle.data?.[2]?.result || '')
  const completionUri = String(bundle.data?.[3]?.result || '')

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Job #{jobId}</h1>
      <div className="card space-y-2 p-5">
        <p>Status: <span className="font-medium uppercase">{status}</span></p>
        <p>Spec URI: {specUri || '—'} {isSafeUri(specUri) && <a className="text-accent" target="_blank" href={specUri} rel="noreferrer">Open</a>}</p>
        <p>Completion URI: {completionUri || '—'} {isSafeUri(completionUri) && <a className="text-accent" target="_blank" href={completionUri} rel="noreferrer">Open</a>}</p>
        <p>Expiry: {new Date(Number(deadlines.expiry) * 1000).toUTCString()}</p>
        <p>Completion review deadline: {new Date(Number(deadlines.completionReviewDeadline) * 1000).toUTCString()}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {address?.toLowerCase() === core.employer.toLowerCase() && <div className="card p-5"><h2 className="text-xl">Employer actions</h2><TxButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'cancelJob', args: [id] }}>Cancel job</TxButton></div>}
        {address && <div className="card p-5"><h2 className="text-xl">Agent actions</h2><TxButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'applyForJob', args: [id, []] }}>Apply for job</TxButton></div>}
        <div className="card p-5"><h2 className="text-xl">Sovereign ledger</h2><ul className="mt-2 text-sm text-muted-foreground">{events.map((evt, idx) => <li key={idx}>{evt.eventName} @ block {evt.blockNumber.toString()}</li>)}{events.length === 0 && <li>No events indexed.</li>}</ul></div>
        {env.ensJobPagesAddress && <div className="card p-5"><h2 className="text-xl">ENS job page</h2><p>job-{jobId}</p><p>ens://job-{jobId}</p></div>}
      </div>
    </div>
  )
}
