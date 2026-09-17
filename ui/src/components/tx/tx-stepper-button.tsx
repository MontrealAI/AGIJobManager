'use client'

import { verifyUSDCDeployment, assertUSDCWriteTarget, assertUSDCWalletContext, assertSimulatedUSDCRequest } from '@/lib/usdc'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { BaseError } from 'viem'
import { useAccount, useChainId, usePublicClient, useSimulateContract, useWaitForTransactionReceipt, useWalletClient, useWriteContract } from 'wagmi'
import { decodeError } from '@/lib/web3/errors'
import { env } from '@/lib/env'

export function TxStepperButton({ children, disabled, simulateConfig, preflightError }: { children: ReactNode; disabled?: boolean; simulateConfig: any; preflightError?: string }) {
  const [step, setStep] = useState<'idle' | 'preparing' | 'signature' | 'pending' | 'confirmed' | 'failed'>('idle')
  const chainId = useChainId()
  const { isConnected, address } = useAccount()
  const [localError, setLocalError] = useState<Error>()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const write = useWriteContract()
  const sim = useSimulateContract({ ...simulateConfig, account: address, chainId: env.chainId, query: { enabled: false } })
  const wait = useWaitForTransactionReceipt({ hash: write.data, chainId: env.chainId })

  const txLink = useMemo(() => {
    if (!write.data) return ''
    const base = env.explorerBaseUrl || (env.chainId === 11155111 ? 'https://sepolia.etherscan.io' : 'https://etherscan.io')
    return `${base}/tx/${write.data}`
  }, [write.data])

  const run = async () => {
    if (!isConnected || !address || chainId !== env.chainId || preflightError) return
    try {
      const reviewedConfig = { ...simulateConfig, args: simulateConfig.args ? structuredClone(simulateConfig.args) : undefined }
      setLocalError(undefined)
      setStep('preparing')
      await assertUSDCWalletContext(walletClient, address, env.chainId)
      const simulated = await sim.refetch()
      if (simulated.isError || simulated.error || !simulated.data?.request) throw simulated.error || new Error('Simulation failed')
      const token = await verifyUSDCDeployment(publicClient, env.agiJobManagerAddress, chainId)
      assertUSDCWriteTarget(simulated.data.request.address, env.agiJobManagerAddress, token, simulated.data.request.functionName, simulated.data.request.args)
      assertSimulatedUSDCRequest(simulated.data.request, reviewedConfig)
      await assertUSDCWalletContext(walletClient, address, env.chainId)
      setStep('signature')
      await write.writeContractAsync({ ...simulated.data.request, account: address, chainId: env.chainId })
      setStep('pending')
    } catch (error) {
      setLocalError(error instanceof Error ? error : new Error(String(error)))
      setStep('failed')
    }
  }

  useEffect(() => {
    if (wait.isSuccess && step === 'pending') {
      if (wait.data?.status === 'success') setStep('confirmed')
      else { setLocalError(new Error('Transaction reverted. Check your wallet before retrying.')); setStep('failed') }
    }
    if (wait.isError && step === 'pending') setStep('failed')
  }, [wait.isSuccess, wait.isError, wait.data?.status, step])

  const err = (localError || sim.error || write.error || wait.error) as BaseError | undefined
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
