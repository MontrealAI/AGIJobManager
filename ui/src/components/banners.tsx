'use client'

import { useAccount, useChainId, useReadContract, useSwitchChain } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'

export function GlobalBanners() {
  const chainId = useChainId()
  const { isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const paused = useReadContract({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'paused' })
  const settlementPaused = useReadContract({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'settlementPaused' })

  return (
    <div className="space-y-3">
      {isConnected && chainId !== env.chainId && (
        <div className="card-shell border-yellow-500/50">
          Network mismatch.
          <button className="btn-outline ml-3" onClick={() => switchChain({ chainId: env.chainId })}>Switch network</button>
        </div>
      )}
      {paused.data && <div className="card-shell border-destructive/70">Protocol paused.</div>}
      {settlementPaused.data && <div className="card-shell border-destructive/70">Settlement paused.</div>}
    </div>
  )
}
