'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useMemo, useState } from 'react'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { ThemeProvider } from 'next-themes'
import '@rainbow-me/rainbowkit/styles.css'
import { createWagmiConfig } from '@/lib/wagmi'

export default function Providers({ children, rpcMainnetUrl, rpcSepoliaUrl }: { children: ReactNode; rpcMainnetUrl?: string; rpcSepoliaUrl?: string }) {
  const config = useMemo(() => createWagmiConfig(rpcMainnetUrl, rpcSepoliaUrl), [rpcMainnetUrl, rpcSepoliaUrl])
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: (a) => Math.min(400 * 2 ** a, 4000) } } }))

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={darkTheme({ accentColor: '#4B1D86' })}>{children}</RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}
