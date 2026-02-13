'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import { BaseError } from 'viem'
import { useAccount, useChainId, useSimulateContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { decodeError } from '@/lib/web3/errors'
import { env } from '@/lib/env'

export function TxStepperButton({ children, disabled, simulateConfig, preflightError }: { children: ReactNode; disabled?: boolean; simulateConfig: any; preflightError?: string }) {
  const [step, setStep] = useState<'idle' | 'preparing' | 'signature' | 'pending' | 'confirmed' | 'failed'>('idle')
  const chainId = useChainId()
  const { isConnected } = useAccount()
  const write = useWriteContract()
  const sim = useSimulateContract({ ...simulateConfig, query: { enabled: false } })
  const wait = useWaitForTransactionReceipt({ hash: write.data })

  const txLink = useMemo(() => {
    if (!write.data) return ''
    const base = env.explorerBaseUrl || (env.chainId === 11155111 ? 'https://sepolia.etherscan.io' : 'https://etherscan.io')
    return `${base}/tx/${write.data}`
  }, [write.data])

  const run = async () => {
    if (!isConnected || chainId !== env.chainId || preflightError) return
    try {
      setStep('preparing')
      const simulated = await sim.refetch()
      if (!simulated.data?.request) throw new Error('Simulation failed')
      setStep('signature')
      await write.writeContractAsync(simulated.data.request)
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
  const decoded = decodeError(err)
  const effectiveError = preflightError || (!isConnected ? 'Connect wallet' : chainId !== env.chainId ? 'Wrong network' : '')

  return (
    <div className="space-y-2">
      <button onClick={run} disabled={disabled || !!effectiveError || step === 'preparing' || step === 'signature' || step === 'pending'} className="btn-primary">
        {children}
      </button>
      {effectiveError && <p className="text-xs text-warning">{effectiveError}</p>}
      {step === 'preparing' && <p className="text-xs">Preparing…</p>}
      {step === 'signature' && <p className="text-xs">Awaiting signature…</p>}
      {step === 'pending' && txLink && <a href={txLink} className="text-xs underline" target="_blank" rel="noreferrer">Pending in explorer</a>}
      {step === 'confirmed' && <p className="text-xs text-emerald-400">Confirmed</p>}
      {step === 'failed' && <p className="text-xs text-destructive">{decoded.name}: {decoded.human}</p>}
    </div>
  )
}
