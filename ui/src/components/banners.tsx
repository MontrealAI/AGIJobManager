'use client'

import { useChainId, useReadContracts } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'

export function GlobalBanners({ degradedRpc }: { degradedRpc?: boolean }) {
  const chainId = useChainId()
  const flags = useReadContracts({
    contracts: [
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'paused' },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'settlementPaused' }
    ],
    allowFailure: true
  })

  return (
    <div className="mb-4 space-y-2">
      {chainId !== env.chainId && <div className="card-shell border-warning/60 text-warning">Network mismatch. Expected chain ID {env.chainId}.</div>}
      {flags.data?.[0]?.result && <div className="card-shell border-warning/60 text-warning">Protocol paused.</div>}
      {flags.data?.[1]?.result && <div className="card-shell border-warning/60 text-warning">Settlement paused.</div>}
      {(degradedRpc || flags.isError) && <div className="card-shell border-destructive/60">Degraded RPC mode. Retry if data appears stale.</div>}
    </div>
  )
}
