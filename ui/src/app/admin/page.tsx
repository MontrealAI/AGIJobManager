'use client'

import { useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'
import { TxStepperButton } from '@/components/tx/tx-stepper-button'

export default function AdminPage() {
  const { address } = useAccount()
  const owner = useReadContract({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'owner' })
  const [typed, setTyped] = useState('')
  const isOwner = !!address && !!owner.data && address.toLowerCase() === owner.data.toLowerCase()

  if (!isOwner) return <div className="card-shell">Not authorized</div>

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Ops Console</h1>
      <section className="card-shell space-y-2"><h2 className="text-xl">Safety toggles</h2><TxStepperButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'pause' }}>Pause</TxStepperButton><TxStepperButton simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'unpause' }}>Unpause</TxStepperButton></section>
      <section className="card-shell space-y-2"><h2 className="text-xl">Settlement control</h2><p className="text-sm text-muted-foreground">Type SETTLEMENT to continue.</p><input className="input-shell" value={typed} onChange={(e) => setTyped(e.target.value)} /><TxStepperButton disabled={typed !== 'SETTLEMENT'} simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'setSettlementPaused', args: [true] }}>Set settlement paused</TxStepperButton></section>
      <section className="card-shell"><h2 className="text-xl">Treasury</h2><p className="text-sm text-muted-foreground">Withdraw only while paused and settlement active-state allows it.</p></section>
    </div>
  )
}
