'use client'

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { fallback, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { env } from './env'

export const wagmiConfig = getDefaultConfig({
  appName: 'AGIJobManager UI',
  projectId: env.walletConnectProjectId,
  chains: [mainnet, sepolia],
  ssr: false,
  transports: {
    [mainnet.id]: fallback([http(env.rpcMainnetUrl), http()]),
    [sepolia.id]: fallback([http(env.rpcSepoliaUrl), http()])
  }
})
