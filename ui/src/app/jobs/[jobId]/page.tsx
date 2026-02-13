'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAccount, usePublicClient, useReadContract, useReadContracts } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { erc20Abi } from '@/abis/erc20'
import { env } from '@/lib/env'
import { computeDeadlines, deriveJobUiStatus } from '@/lib/jobStatus'
import { formatTimestamp, formatToken, secondsLeft } from '@/lib/format'
import { isSafeUri } from '@/lib/security'
import { TxStepperButton } from '@/components/tx/tx-stepper-button'

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const id = BigInt(jobId)
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [events, setEvents] = useState<string[]>([])

  const reads = useReadContracts({
    contracts: [
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobCore', args: [id] },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobValidation', args: [id] },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobSpecURI', args: [id] },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobCompletionURI', args: [id] },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'completionReviewPeriod' },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'disputeReviewPeriod' },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'challengePeriodAfterApproval' }
    ],
    allowFailure: true
  })

  useEffect(() => {
    if (!publicClient) return
    publicClient.getLogs({ address: env.agiJobManagerAddress, fromBlock: 'earliest', toBlock: 'latest' }).then((l) => setEvents(l.slice(-10).map((x) => x.topics[0] || 'event'))).catch(() => setEvents([]))
  }, [publicClient])

  const core = reads.data?.[0]?.result as any
  const validation = reads.data?.[1]?.result as any
  const allowance = useReadContract({ abi: erc20Abi, address: env.agiTokenAddress, functionName: 'allowance', args: [address || '0x0000000000000000000000000000000000000000', env.agiJobManagerAddress] })
  const balance = useReadContract({ abi: erc20Abi, address: env.agiTokenAddress, functionName: 'balanceOf', args: [address || '0x0000000000000000000000000000000000000000'] })
  if (!core) return <div className="card-shell">Loading…</div>

  const status = deriveJobUiStatus({ employer: core.employer, assignedAgent: core.agent, payout: core.payout, duration: core.duration, assignedAt: core.assignedAt, completed: core.completed, disputed: !!validation?.disputed, expired: false, agentPayoutPct: 0 }, { completionRequested: core.completionRequestedAt > 0n, approvals: Number(validation?.approvals || 0), disapprovals: Number(validation?.disapprovals || 0), completionRequestedAt: core.completionRequestedAt, disputedAt: core.disputedAt })
  const deadlines = computeDeadlines({ employer: core.employer, assignedAgent: core.agent, payout: core.payout, duration: core.duration, assignedAt: core.assignedAt, completed: core.completed, disputed: !!validation?.disputed, expired: false, agentPayoutPct: 0 }, { completionRequested: core.completionRequestedAt > 0n, approvals: Number(validation?.approvals || 0), disapprovals: Number(validation?.disapprovals || 0), completionRequestedAt: core.completionRequestedAt, disputedAt: core.disputedAt }, { completionReviewPeriod: (reads.data?.[4]?.result as bigint) || 0n, disputeReviewPeriod: (reads.data?.[5]?.result as bigint) || 0n, challengePeriodAfterApproval: (reads.data?.[6]?.result as bigint) || 0n })

  const completionUri = String(reads.data?.[3]?.result || '')
  const specUri = String(reads.data?.[2]?.result || '')

  return <div className="space-y-4">
    <h1 className="text-3xl">Job #{jobId}</h1>
    <div className="card-shell grid gap-2 md:grid-cols-2">
      <p>Status: {status.status}{status.terminal ? ' (terminal)' : ''}</p>
      <p>Payout: {formatToken(core.payout)}</p>
      <p>Expiry: {formatTimestamp(deadlines.expiryTime)} ({secondsLeft(deadlines.expiryTime)})</p>
      <p>Completion review: {formatTimestamp(deadlines.completionReviewEnd)}</p>
      <p>Spec URI: <span className="break-all">{specUri || '—'}</span></p>
      <p>Completion URI: <span className="break-all">{completionUri || '—'}</span></p>
      <div className="flex gap-2">{isSafeUri(specUri) ? <a className="btn-outline" href={specUri} rel="noreferrer" target="_blank">Open link</a> : <button className="btn-outline" disabled>Open link</button>}</div>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <div className="card-shell space-y-2"><h2 className="text-xl">Allowance</h2><p>Balance: {formatToken((balance.data as bigint) || 0n)}</p><p>Allowance: {formatToken((allowance.data as bigint) || 0n)}</p><TxStepperButton simulateConfig={{ abi: erc20Abi, address: env.agiTokenAddress, functionName: 'approve', args: [env.agiJobManagerAddress, core.payout] }}>Approve exact</TxStepperButton></div>
      <div className="card-shell space-y-2"><h2 className="text-xl">Actions</h2><TxStepperButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'applyForJob', args: [id, []] }}>Apply</TxStepperButton><TxStepperButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'requestCompletion', args: [id, completionUri || 'ipfs://placeholder'] }}>Request completion</TxStepperButton><TxStepperButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'disputeJob', args: [id] }}>Dispute</TxStepperButton><TxStepperButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'finalizeJob', args: [id] }}>Finalize</TxStepperButton></div>
    </div>

    <div className="card-shell"><h2 className="text-xl">Sovereign ledger timeline</h2><ul className="mt-2 list-disc pl-5 text-xs">{events.map((e, i) => <li key={i} className="break-all">{e}</li>)}</ul></div>
    {env.ensJobPagesAddress && <div className="card-shell"><h2 className="text-xl">ENS Job Page</h2><p>Best effort: ens://job-{jobId}</p></div>}
  </div>
}
