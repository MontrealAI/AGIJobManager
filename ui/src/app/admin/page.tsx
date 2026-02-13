'use client'
import { useAccount, useReadContract } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'
import { TxButton } from '@/components/tx-button'
import { useState } from 'react'

export default function AdminPage() {
  const { address } = useAccount()
  const owner = useReadContract({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'owner' })
  const [confirm, setConfirm] = useState('')
  if (!address || !owner.data || address.toLowerCase() !== owner.data.toLowerCase()) return <div className="card">Not authorized.</div>
  const canDanger = confirm === 'CONFIRM'
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Admin console</h1>
      <div className="card"><h2>Pausing</h2><TxButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'pause' }}>Pause</TxButton><div className="mt-2"><TxButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'unpause' }}>Unpause</TxButton></div></div>
      <div className="card border-red-600"><h2>Danger zone</h2><p>Type CONFIRM to enable dangerous writes.</p><input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <TxButton disabled={!canDanger} simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'setSettlementPaused', args: [true] }}>Set settlement paused</TxButton></div>
    </div>
  )
}
