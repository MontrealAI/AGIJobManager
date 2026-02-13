'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAccount, usePublicClient, useReadContract, useReadContracts } from 'wagmi'
import { formatEther } from 'viem'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { erc20Abi } from '@/abis/erc20'
import { env } from '@/lib/env'
import { computeDeadlines, deriveJobStatus } from '@/lib/job'
import { isSafeUri } from '@/lib/security'
import { TxButton } from '@/components/tx-button'

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const id = BigInt(jobId)
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [timeline, setTimeline] = useState<any[]>([])

  const bundle = useReadContracts({
    contracts: [
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobCore', args: [id] },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobValidation', args: [id] },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobSpecURI', args: [id] },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'getJobCompletionURI', args: [id] },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'completionReviewPeriod' },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'disputeReviewPeriod' },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'challengePeriodAfterApproval' }
    ]
  })

  useEffect(() => {
    if (!publicClient) return
    publicClient
      .getLogs({ address: env.agiJobManagerAddress, fromBlock: 'earliest', toBlock: 'latest' })
      .then((logs) => setTimeline(logs.slice(-6)))
      .catch(() => setTimeline([]))
  }, [publicClient])

  const allowance = useReadContract({ abi: erc20Abi, address: env.agiTokenAddress, functionName: 'allowance', args: [address || '0x0000000000000000000000000000000000000000', env.agiJobManagerAddress] })
  const balance = useReadContract({ abi: erc20Abi, address: env.agiTokenAddress, functionName: 'balanceOf', args: [address || '0x0000000000000000000000000000000000000000'] })

  const core = bundle.data?.[0]?.result as any
  const val = bundle.data?.[1]?.result as any
  const specUri = String(bundle.data?.[2]?.result || '')
  const completionUri = String(bundle.data?.[3]?.result || '')
  if (!core) return <div className="card-shell">Loading job…</div>

  const deadlines = computeDeadlines(core, {
    completionReview: (bundle.data?.[4]?.result as bigint) || 0n,
    disputeReview: (bundle.data?.[5]?.result as bigint) || 0n,
    challengeAfterApproval: (bundle.data?.[6]?.result as bigint) || 0n
  })
  const status = deriveJobStatus(core, val || { approvals: 0, disapprovals: 0, disputed: false }, Math.floor(Date.now() / 1000))

  return (
    <div className="space-y-4">
      <h1 className="text-[32px] leading-[36px]">Job #{jobId}</h1>
      <div className="card-shell grid gap-3 md:grid-cols-2">
        <p>Status: <span className="pill">{status}</span></p>
        <p>Payout: {Number(formatEther(core.payout)).toFixed(4)} AGI</p>
        <p>Assigned deadline: {new Date(Number(deadlines.assignmentDeadline) * 1000).toUTCString()}</p>
        <p>Completion review deadline: {new Date(Number(deadlines.completionReviewDeadline) * 1000).toUTCString()}</p>
        <p className="break-all">Spec URI: {specUri}</p>
        <p className="break-all">Completion URI: {completionUri}</p>
        {isSafeUri(specUri) && <a className="underline" href={specUri} target="_blank">Open spec safely</a>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card-shell space-y-3">
          <h2 className="text-2xl">Allowance</h2>
          <p>Balance: {Number(formatEther((balance.data as bigint) || 0n)).toFixed(4)} AGI</p>
          <p>Allowance: {Number(formatEther((allowance.data as bigint) || 0n)).toFixed(4)} AGI</p>
          <TxButton simulateConfig={{ abi: erc20Abi, address: env.agiTokenAddress, functionName: 'approve', args: [env.agiJobManagerAddress, core.payout] }}>Approve exact</TxButton>
          <TxButton simulateConfig={{ abi: erc20Abi, address: env.agiTokenAddress, functionName: 'approve', args: [env.agiJobManagerAddress, 2n ** 255n] }}>Approve max</TxButton>
        </div>

        <div className="card-shell space-y-3">
          <h2 className="text-2xl">Actions</h2>
          {address?.toLowerCase() === core.employer.toLowerCase() && <TxButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'cancelJob', args: [id] }}>Cancel (employer)</TxButton>}
          <TxButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'applyForJob', args: [id, []] }}>Apply (agent)</TxButton>
          <TxButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'requestCompletion', args: [id, completionUri || 'ipfs://pending'] }}>Request completion</TxButton>
          <TxButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'disputeJob', args: [id] }}>Dispute</TxButton>
          <TxButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'finalizeJob', args: [id] }}>Finalize</TxButton>
        </div>
      </div>

      <div className="card-shell">
        <h2 className="text-2xl">Sovereign ledger</h2>
        <p className="text-sm text-muted-foreground">Recent on-chain events for AGIJobManager.</p>
        <p className="text-xs mt-2 break-all">{JSON.stringify(timeline).slice(0, 400)}...</p>
      </div>

      {env.ensJobPagesAddress && (
        <div className="card-shell">
          <h2 className="text-2xl">ENS Job Page</h2>
          <p>Label: job-{jobId}</p>
          <p>URI: ens://job-{jobId}</p>
        </div>
      )}
    </div>
  )
}
