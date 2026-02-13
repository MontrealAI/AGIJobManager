'use client'
import { ReactNode, useState } from 'react'
import { BaseError } from 'viem'
import { useSimulateContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'

export function TxButton({ children, disabled, simulateConfig }: { children: ReactNode; disabled?: boolean; simulateConfig: any }) {
  const [started, setStarted] = useState(false)
  const sim = useSimulateContract({ ...simulateConfig, query: { enabled: started } })
  const write = useWriteContract()
  const wait = useWaitForTransactionReceipt({ hash: write.data })
  const loading = sim.isPending || write.isPending || wait.isLoading

  const onClick = async () => {
    try {
      setStarted(true)
      const req = sim.data?.request
      if (!req) return
      await write.writeContractAsync(req)
    } catch {
      // noop, surfaced below
    }
  }

  const err = (sim.error || write.error || wait.error) as BaseError | undefined
  return (
    <div className="space-y-2">
      <button onClick={onClick} disabled={disabled || loading} className="btn">
        {loading ? 'Processing...' : children}
      </button>
      {sim.isPending && <p>Preparing (simulation)...</p>}
      {write.isPending && <p>Awaiting signature...</p>}
      {write.data && !wait.isSuccess && <p>Pending onchain: {write.data.slice(0, 10)}...</p>}
      {wait.isSuccess && <p className="text-green-400">Confirmed in block {wait.data.blockNumber.toString()}</p>}
      {err && <p className="text-red-400">Failed: {err.shortMessage}</p>}
    </div>
  )
}
