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

  const lastBlock = useReadContracts({
    contracts: [{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'owner' }],
    query: { enabled: true }
  })

  return (
    <div className="mb-4 space-y-2">
      {chainId !== env.chainId && <div className="card-shell border-warning/60 text-warning">Network mismatch. Expected chain ID {env.chainId}.</div>}
      {flags.data?.[0]?.result && <div className="card-shell border-warning/60 text-warning">Protocol paused.</div>}
      {flags.data?.[1]?.result && <div className="card-shell border-warning/60 text-warning">Settlement paused.</div>}
      {(degradedRpc || flags.isError) && (
        <div className="card-shell border-destructive/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>Degraded RPC mode. Retry if data appears stale.</p>
            <button type="button" className="btn-outline" onClick={() => flags.refetch()}>Retry</button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Last successful contract read: {lastBlock.data?.[0]?.result ? 'available' : 'unavailable'}</p>
        </div>
      )}
    </div>
  )
}
