'use client'

import { useAccount, useReadContracts } from 'wagmi'
import { env } from '@/lib/env'
import { agiJobManagerAbi } from '@/abis/agiJobManager'

export function TopBanners({ degraded }: { degraded?: boolean }) {
  const { chainId } = useAccount()
  const flags = useReadContracts({
    contracts: [
      { abi: agiJobManagerAbi, address: env.jobManager, functionName: 'paused' },
      { abi: agiJobManagerAbi, address: env.jobManager, functionName: 'settlementPaused' }
    ],
    allowFailure: true
  })

  return (
    <div className="space-y-2">
      {chainId && chainId !== env.chainId && <div className="rounded-md border border-warning bg-warning/10 p-2 text-sm">Network mismatch. Expected chain {env.chainId}.</div>}
      {flags.data?.[0]?.result && <div className="rounded-md border border-warning bg-warning/10 p-2 text-sm">Protocol paused.</div>}
      {flags.data?.[1]?.result && <div className="rounded-md border border-warning bg-warning/10 p-2 text-sm">Settlement paused.</div>}
      {degraded && <div className="rounded-md border border-destructive bg-destructive/10 p-2 text-sm">Degraded RPC mode. Retry if reads fail.</div>}
    </div>
  )
}
