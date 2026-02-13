'use client'

import { ReactNode, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { ThemeProvider } from 'next-themes'
import '@rainbow-me/rainbowkit/styles.css'
import { makeConfig } from '@/lib/web3/clients'

export function Providers({ children, mainnetRpc, sepoliaRpc }: { children: ReactNode; mainnetRpc?: string; sepoliaRpc?: string }) {
  const config = useMemo(() => makeConfig(mainnetRpc, sepoliaRpc), [mainnetRpc, sepoliaRpc])
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 3, retryDelay: (a) => Math.min(500 * 2 ** a, 5000) } }
      })
  )
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={darkTheme({ accentColor: '#4B1D86' })}>{children}</RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}
