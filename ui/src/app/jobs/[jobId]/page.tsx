'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { erc20Abi } from '@/abis/erc20'
import { env } from '@/lib/env'
import { computeDeadlines, deriveJobStatus } from '@/lib/jobStatus'
import { formatToken, formatTs, shortAddress } from '@/lib/format'
import { parseSafeUri } from '@/lib/uriSafety'
import { SimulateButton } from '@/components/tx/simulate-button'

const EMPTY = '0x0000000000000000000000000000000000000000'

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const id = BigInt(jobId)
  const { address } = useAccount()
  const [uriInput, setUriInput] = useState('ipfs://')

  const data = useReadContracts({
    contracts: [
      { abi: agiJobManagerAbi, address: env.jobManager, functionName: 'getJobCore', args: [id] },
      { abi: agiJobManagerAbi, address: env.jobManager, functionName: 'getJobValidation', args: [id] },
      { abi: agiJobManagerAbi, address: env.jobManager, functionName: 'getJobSpecURI', args: [id] },
      { abi: agiJobManagerAbi, address: env.jobManager, functionName: 'getJobCompletionURI', args: [id] },
      { abi: agiJobManagerAbi, address: env.jobManager, functionName: 'completionReviewPeriod' },
      { abi: agiJobManagerAbi, address: env.jobManager, functionName: 'disputeReviewPeriod' },
      { abi: agiJobManagerAbi, address: env.jobManager, functionName: 'challengePeriodAfterApproval' }
    ],
    allowFailure: true
  })

  const balance = useReadContract({ abi: erc20Abi, address: env.agiToken, functionName: 'balanceOf', args: [address || EMPTY] })
  const allowance = useReadContract({ abi: erc20Abi, address: env.agiToken, functionName: 'allowance', args: [address || EMPTY, env.jobManager] })

  const core = data.data?.[0]?.result as any
  const val = data.data?.[1]?.result as any
  const specUri = (data.data?.[2]?.result as string) || ''
  const completionUri = (data.data?.[3]?.result as string) || ''

  const status = core && val ? deriveJobStatus(core, val) : undefined
  const deadlines = core && val ? computeDeadlines(core, val, { completionReviewPeriod: (data.data?.[4]?.result as bigint) || 0n, disputeReviewPeriod: (data.data?.[5]?.result as bigint) || 0n, challengePeriodAfterApproval: (data.data?.[6]?.result as bigint) || 0n }) : undefined


  if (!core || !val) return <div className="card-shell">Job not found or RPC unavailable.</div>

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Job #{jobId}</h1>
      <div className="card-shell grid gap-2 md:grid-cols-2">
        <p>Status: {status?.label}</p>
        <p>Terminal: {status?.terminal ? 'Yes' : 'No'}</p>
        <p>Payout: {formatToken(core.payout)}</p>
        <p>Employer: {shortAddress(core.employer)}</p>
        <p>Agent: {shortAddress(core.assignedAgent)}</p>
        <p>Expiry: {formatTs(deadlines?.expiryTime)}</p>
        <p>Completion review end: {formatTs(deadlines?.completionReviewEnd)}</p>
        <p>Dispute review end: {formatTs(deadlines?.disputeReviewEnd)}</p>
      </div>

      <div className="card-shell space-y-2">
        <h2 className="text-2xl">Untrusted URIs</h2>
        <p className="break-all">Spec URI: {specUri || '—'}</p>
        <button className="btn-outline" onClick={() => navigator.clipboard.writeText(specUri)}>Copy</button>
        <a className={`btn-outline inline-block ${!parseSafeUri(specUri) ? 'pointer-events-none opacity-40' : ''}`} href={parseSafeUri(specUri) ? specUri : undefined} target="_blank" rel="noreferrer">Open link</a>
        <p className="break-all">Completion URI: {completionUri || '—'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card-shell space-y-2">
          <h2 className="text-2xl">Token Allowance</h2>
          <p>Balance: {formatToken((balance.data as bigint) || 0n)}</p>
          <p>Allowance: {formatToken((allowance.data as bigint) || 0n)}</p>
          <SimulateButton config={{ abi: erc20Abi, address: env.agiToken, functionName: 'approve', args: [env.jobManager, core.payout] }}>Approve exact</SimulateButton>
          <SimulateButton config={{ abi: erc20Abi, address: env.agiToken, functionName: 'approve', args: [env.jobManager, 2n ** 255n] }}>Approve max</SimulateButton>
        </div>

        <div className="card-shell space-y-2">
          <h2 className="text-2xl">Actions</h2>
          <SimulateButton disabled={address?.toLowerCase() !== core.employer.toLowerCase()} config={{ abi: agiJobManagerAbi, address: env.jobManager, functionName: 'cancelJob', args: [id] }}>cancelJob</SimulateButton>
          <SimulateButton config={{ abi: agiJobManagerAbi, address: env.jobManager, functionName: 'applyForJob', args: [id, []] }}>applyForJob</SimulateButton>
          <input className="input-shell" value={uriInput} onChange={(e) => setUriInput(e.target.value)} placeholder="ipfs://..." />
          <SimulateButton config={{ abi: agiJobManagerAbi, address: env.jobManager, functionName: 'requestCompletion', args: [id, uriInput] }}>requestJobCompletion</SimulateButton>
          <SimulateButton config={{ abi: agiJobManagerAbi, address: env.jobManager, functionName: 'disputeJob', args: [id] }}>disputeJob</SimulateButton>
          <SimulateButton config={{ abi: agiJobManagerAbi, address: env.jobManager, functionName: 'finalizeJob', args: [id] }}>finalizeJob</SimulateButton>
        </div>
      </div>

      <div className="card-shell">
        <h2 className="text-2xl">Sovereign ledger timeline</h2>
        <p className="text-sm text-muted-foreground">Events: JobCreated, JobApplied, JobCompletionRequested, JobValidated, JobDisapproved, JobDisputed, DisputeResolvedWithCode, JobCompleted, JobCancelled, JobExpired, NFTIssued.</p>
        <p className="text-xs">Viewer is best-effort and resilient to RPC errors.</p>
      </div>

      {env.ensJobPages && (
        <div className="card-shell">
          <h2 className="text-2xl">ENS Job Page</h2>
          <p>ENS Job Pages contract: {env.ensJobPages}</p>
          <p>ens://job-{jobId}</p>
        </div>
      )}
    </div>
  )
}
