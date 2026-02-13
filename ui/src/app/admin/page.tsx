'use client'

import { useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'
import { TxButton } from '@/components/tx-button'

export default function AdminPage() {
  const { address } = useAccount()
  const [confirm, setConfirm] = useState('')
  const owner = useReadContract({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'owner' })
  const isOwner = !!address && !!owner.data && address.toLowerCase() === owner.data.toLowerCase()

  if (!isOwner) return <div className="card-shell">Not authorized.</div>

  return (
    <div className="space-y-4">
      <h1 className="text-[32px] leading-[36px]">Ops Console</h1>
      <section className="card-shell space-y-3">
        <h2 className="text-2xl">Pause Controls</h2>
        <TxButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'pause' }}>Pause</TxButton>
        <TxButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'unpause' }}>Unpause</TxButton>
      </section>

      <section className="card-shell space-y-3 border-destructive/60">
        <h2 className="text-2xl">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">Type SETTLEMENT to enable settlement pause mutation.</p>
        <input className="input-shell" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="SETTLEMENT" />
        <TxButton disabled={confirm !== 'SETTLEMENT'} simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'setSettlementPaused', args: [true] }}>
          Set settlement paused
        </TxButton>
      </section>
    </div>
  )
}
