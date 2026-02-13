import { createWagmiConfig } from '@/lib/wagmi'

export const wagmiConfig = createWagmiConfig(process.env.RPC_MAINNET_URL, process.env.RPC_SEPOLIA_URL)
