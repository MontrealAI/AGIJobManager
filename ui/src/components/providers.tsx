'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useMemo, useState } from 'react'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { createWagmiConfig } from '@/lib/wagmi'

export default function Providers({ children, rpcMainnetUrl, rpcSepoliaUrl }: { children: ReactNode; rpcMainnetUrl?: string; rpcSepoliaUrl?: string }) {
  const config = useMemo(() => createWagmiConfig(rpcMainnetUrl, rpcSepoliaUrl), [rpcMainnetUrl, rpcSepoliaUrl])
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: (failureCount) => failureCount < 4, retryDelay: (attempt) => Math.min(300 * 2 ** attempt, 5000) } }
      })
  )

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          modalSize="compact"
          theme={darkTheme({ accentColor: '#4B1D86', borderRadius: 'medium' })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
