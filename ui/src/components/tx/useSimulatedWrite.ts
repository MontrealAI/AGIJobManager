'use client';
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
      if (chainId !== expectedChainId) throw new Error('Network mismatch');
      await preflight?.();
      const sim = await publicClient!.simulateContract({...config, account: address});
      setStep('Awaiting signature');
      const hash = await walletClient.writeContract(sim.request);
      setStep('Pending');
      await publicClient!.waitForTransactionReceipt({ hash });
      setStep('Confirmed');
      return hash;
    } catch (e:any) {
      const decoded = e?.data ? (()=>{ try{return decodeErrorResult({abi: config.abi, data: e.data});}catch{return undefined;} })() : undefined;
      setError(translateError(decoded?.errorName) || e?.shortMessage || e?.message);
      setStep('Failed');
      throw e;
    }
  }
  return { run, step, error };
}
