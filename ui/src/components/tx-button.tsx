'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import { BaseError } from 'viem'
import { useSimulateContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'

export function TxButton({ children, disabled, simulateConfig, preflightError }: { children: ReactNode; disabled?: boolean; simulateConfig: any; preflightError?: string }) {
  const [step, setStep] = useState<'idle' | 'preparing' | 'signature' | 'pending' | 'confirmed' | 'failed'>('idle')
  const write = useWriteContract()
  const sim = useSimulateContract({ ...simulateConfig, query: { enabled: step === 'preparing' } })
  const wait = useWaitForTransactionReceipt({ hash: write.data })

  const loading = step !== 'idle' && step !== 'confirmed' && step !== 'failed'
  const txLink = useMemo(() => (write.data ? `https://etherscan.io/tx/${write.data}` : ''), [write.data])

  const run = async () => {
    if (preflightError) return
    try {
      setStep('preparing')
      await sim.refetch()
      if (!sim.data?.request) {
        setStep('failed')
        return
      }
      setStep('signature')
      await write.writeContractAsync(sim.data.request)
      setStep('pending')
    } catch {
      setStep('failed')
    }
  }

  useEffect(() => {
    if (wait.isSuccess && step === 'pending') setStep('confirmed')
    if (wait.isError && step === 'pending') setStep('failed')
  }, [wait.isSuccess, wait.isError, step])

  const err = (sim.error || write.error || wait.error) as BaseError | undefined

  return (
    <div className="space-y-2">
      <button onClick={run} disabled={disabled || !!preflightError || loading} className="btn-primary">
        {loading ? 'Processing…' : children}
      </button>
      {preflightError && <p className="text-sm text-yellow-400">Preflight: {preflightError}</p>}
      {step === 'preparing' && <p className="text-sm">Preparing…</p>}
      {step === 'signature' && <p className="text-sm">Awaiting signature…</p>}
      {step === 'pending' && txLink && <p className="text-sm">Pending. <a className="underline" href={txLink} target="_blank">Explorer</a></p>}
      {step === 'confirmed' && <p className="text-sm text-emerald-400">Confirmed.</p>}
      {step === 'failed' && <p className="text-sm text-destructive">Failed: {err?.shortMessage || 'simulation error'}</p>}
    </div>
  )
}
