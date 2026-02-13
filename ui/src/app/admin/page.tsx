'use client'
import { useAccount, useReadContract } from 'wagmi'
import { agiJobManagerAbi } from '@/abis/agiJobManager'
import { env } from '@/lib/env'
import { TxButton } from '@/components/tx-button'
import { useMemo, useState } from 'react'

export default function AdminPage() {
  const { address } = useAccount()
  const owner = useReadContract({ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'owner' })
  const isOwner = useMemo(() => !!address && !!owner.data && address.toLowerCase() === owner.data.toLowerCase(), [address, owner.data])
  const [confirmPause, setConfirmPause] = useState('')
  const [confirmSettlement, setConfirmSettlement] = useState('')

  if (!isOwner) return <div className="card p-4">Not authorized.</div>

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Operations console</h1>
      <div className="card p-5"><h2 className="text-xl">Pause controls</h2><p className="text-sm text-muted-foreground">Type PAUSE to enable pausing actions.</p><input className="input my-3" value={confirmPause} onChange={(e) => setConfirmPause(e.target.value)} />
        <div className="flex gap-2"><TxButton disabled={confirmPause !== 'PAUSE'} simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'pause' }}>Pause</TxButton><TxButton disabled={confirmPause !== 'PAUSE'} simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'unpause' }}>Unpause</TxButton></div></div>
      <div className="card p-5 border-destructive/60"><h2 className="text-xl">Settlement gate</h2><p className="text-sm text-muted-foreground">Type SETTLEMENT to toggle settlement paused.</p><input className="input my-3" value={confirmSettlement} onChange={(e) => setConfirmSettlement(e.target.value)} />
      <TxButton disabled={confirmSettlement !== 'SETTLEMENT'} simulateConfig={{ abi: agiJobManagerAbi, address: env.agiJobManagerAddress as `0x${string}`, functionName: 'setSettlementPaused', args: [true] }}>Set settlement paused</TxButton></div>
    </div>
  )
}
