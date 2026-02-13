'use client'

import { createConfig, fallback, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'

export function makeConfig(mainnetRpc?: string, sepoliaRpc?: string) {
  return createConfig({
    chains: [mainnet, sepolia],
    ssr: true,
    connectors: [],
    transports: {
      [mainnet.id]: fallback([http(mainnetRpc || 'https://eth.llamarpc.com'), http()]),
      [sepolia.id]: fallback([http(sepoliaRpc || 'https://ethereum-sepolia-rpc.publicnode.com'), http()])
    }
  })
}
