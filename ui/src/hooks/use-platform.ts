'use client';
import { useReadContracts } from 'wagmi';
import { agiJobManagerAbi } from '@/abis/agiJobManager';
import { env } from '@/lib/env';

export function usePlatform() {
  return useReadContracts({
    contracts: [
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'paused' },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'settlementPaused' },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'owner' },
      { abi: agiJobManagerAbi, address: env.agiJobManagerAddress, functionName: 'nextJobId' }
    ],
    allowFailure: true,
    query: { retry: 2 }
  });
}
