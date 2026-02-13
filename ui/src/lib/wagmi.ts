'use client'
import { createConfig, fallback, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { mainnet, sepolia } from 'wagmi/chains'
import { env } from './env'

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  connectors: [injected()],
  transports: {
    [mainnet.id]: fallback([http(env.rpcMainnetUrl), http()]),
    [sepolia.id]: fallback([http(env.rpcSepoliaUrl), http()])
  },
  ssr: false
})
