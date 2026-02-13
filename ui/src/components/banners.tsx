'use client'
import { useAccount, useChainId, useReadContract, useSwitchChain } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { degradedRpc, env } from '@/lib/env'

export function GlobalBanners() {
  const chainId = useChainId()
  const { isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const paused = useReadContract({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'paused' })
  const settlementPaused = useReadContract({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'settlementPaused' })
  return (
    <div className="space-y-2 mb-4">
      {isConnected && chainId !== env.chainId && (
        <div className="card border-amber-500">Network mismatch. <button className="btn ml-2" onClick={() => switchChain({ chainId: env.chainId })}>Switch network</button></div>
      )}
      {degradedRpc && <div className="card border-amber-500">Degraded RPC: using fallback public endpoints.</div>}
      {paused.data && <div className="card border-red-600">Contract paused.</div>}
      {settlementPaused.data && <div className="card border-red-600">Settlement paused.</div>}
    </div>
  )
}
