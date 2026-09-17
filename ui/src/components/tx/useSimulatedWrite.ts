'use client';
import { verifyUSDCDeployment, assertUSDCWriteTarget, assertUSDCWalletContext } from '@/lib/usdc';
import { env } from '@/lib/env';
import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { decodeErrorResult } from 'viem';
import { translateError } from '@/lib/web3/errors';

export function useSimulatedWrite(){
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [step,setStep] = useState('Idle');
  const [error,setError] = useState<string>();
  async function run(config: any, expectedChainId:number, preflight?:()=>Promise<void>|void){
    try {
      setError(undefined); setStep('Preparing');
      if (!address || !walletClient) throw new Error('Connect wallet');
      if (chainId !== expectedChainId || !publicClient) throw new Error('Network mismatch');
      await assertUSDCWalletContext(walletClient, address, expectedChainId);
      await preflight?.();
      const sim = await publicClient!.simulateContract({...config, account: address});
      const token = await verifyUSDCDeployment(publicClient, env.agiJobManagerAddress, expectedChainId);
      assertUSDCWriteTarget(config.address, env.agiJobManagerAddress, token, config.functionName, config.args);
      await assertUSDCWalletContext(walletClient, address, expectedChainId);
      setStep('Awaiting signature');
      const hash = await walletClient.writeContract(sim.request);
      setStep('Pending');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Transaction reverted. Check your wallet before retrying.');
      setStep('Confirmed');
      return hash;
    } catch (e:any) {
      const decoded = e?.data ? (()=>{ try{return decodeErrorResult({abi: config.abi, data: e.data});}catch{return undefined;} })() : undefined;
      setError(decoded?.errorName ? translateError(decoded.errorName) : e?.shortMessage || e?.message || 'Transaction failed.');
      setStep('Failed');
      throw e;
    }
  }
  return { run, step, error };
}
