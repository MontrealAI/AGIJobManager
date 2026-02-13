'use client'

import { useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'
import { SimulateButton } from '@/components/tx/simulate-button'

export default function AdminPage() {
  const { address } = useAccount()
  const [pauseWord, setPauseWord] = useState('')
  const [settlementWord, setSettlementWord] = useState('')
  const [lockWord, setLockWord] = useState('')
  const owner = useReadContract({ abi: agiJobManagerAbi, address: env.jobManager, functionName: 'owner' })

  const isOwner = !!address && !!owner.data && address.toLowerCase() === owner.data.toLowerCase()
  if (!isOwner) return <div className="card-shell">Not authorized</div>

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Ops Console</h1>
      <section className="card-shell space-y-2">
        <h2 className="text-xl">Safety toggles</h2>
        <input className="input-shell" value={pauseWord} onChange={(e) => setPauseWord(e.target.value)} placeholder="Type PAUSE" />
        <SimulateButton disabled={pauseWord !== 'PAUSE'} config={{ abi: agiJobManagerAbi, address: env.jobManager, functionName: 'pause' }}>pause()</SimulateButton>
        <SimulateButton disabled={pauseWord !== 'PAUSE'} config={{ abi: agiJobManagerAbi, address: env.jobManager, functionName: 'unpause' }}>unpause()</SimulateButton>
      </section>
      <section className="card-shell space-y-2">
        <h2 className="text-xl">Settlement controls</h2>
        <input className="input-shell" value={settlementWord} onChange={(e) => setSettlementWord(e.target.value)} placeholder="Type SETTLEMENT" />
        <SimulateButton disabled={settlementWord !== 'SETTLEMENT'} config={{ abi: agiJobManagerAbi, address: env.jobManager, functionName: 'setSettlementPaused', args: [true] }}>setSettlementPaused(true)</SimulateButton>
      </section>
      <section className="card-shell space-y-2">
        <h2 className="text-xl">Identity lock (danger)</h2>
        <input className="input-shell" value={lockWord} onChange={(e) => setLockWord(e.target.value)} placeholder="Type LOCK" />
        <p className="text-sm text-muted-foreground">LOCK confirmation required for irreversible identity configuration operations.</p>
      </section>
    </div>
  )
}
