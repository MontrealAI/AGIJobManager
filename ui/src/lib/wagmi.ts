'use client'

import { createConfig, fallback, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { mainnet, sepolia } from 'wagmi/chains'

export function createWagmiConfig(rpcMainnetUrl?: string, rpcSepoliaUrl?: string) {
  return createConfig({
    chains: [mainnet, sepolia],
    connectors: [injected()],
    transports: {
      [mainnet.id]: fallback([http(rpcMainnetUrl || 'https://eth.llamarpc.com'), http()]),
      [sepolia.id]: fallback([http(rpcSepoliaUrl || 'https://ethereum-sepolia-rpc.publicnode.com'), http()])
    },
    ssr: false
  })
}
