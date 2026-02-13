'use client'

import { useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { BaseError, decodeErrorResult } from 'viem'
import { TxStepper } from './tx-stepper'
import { humanizeError } from '@/lib/web3/errorDecode'

export function SimulateButton({ config, children, disabled }: { config: any; children: React.ReactNode; disabled?: boolean }) {
  const { chainId } = useAccount()
  const publicClient = usePublicClient({ chainId })
  const { data: walletClient } = useWalletClient()
  const [step, setStep] = useState('Preparing')
  const [error, setError] = useState<string>()

  async function run() {
    try {
      setError(undefined)
      setStep('Preparing')
      if (!walletClient || !publicClient) throw new Error('Wallet not connected')
      const simulation = await publicClient.simulateContract({ ...config, account: walletClient.account })
      setStep('Awaiting signature')
      const hash = await walletClient.writeContract(simulation.request)
      setStep('Pending')
      await publicClient.waitForTransactionReceipt({ hash })
      setStep('Confirmed')
    } catch (err) {
      const e = err as BaseError
      const data = (e.walk((x) => x instanceof BaseError) as any)?.data as `0x${string}` | undefined
      if (data && config.abi) {
        try {
          const decoded = decodeErrorResult({ abi: config.abi, data: data as `0x${string}` })
          setError(`${decoded.errorName}: ${humanizeError(decoded.errorName)}`)
          return
        } catch {}
      }
      setError(e.shortMessage || e.message)
    }
  }

  return (
    <div className="space-y-1">
      <button className="btn-primary" disabled={disabled} onClick={run}>{children}</button>
      <TxStepper step={step} error={error} />
    </div>
  )
}
