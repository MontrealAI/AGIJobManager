'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '@/lib/wagmi'
import { ReactNode, useEffect, useState } from 'react'
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: (failureCount) => failureCount < 4, retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000) }
        }
      })
  )
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = window.localStorage.getItem('theme') as 'dark' | 'light' | null
    const next = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    document.documentElement.classList.toggle('light', next === 'light')
    setTheme(next)
  }, [])

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme === 'dark' ? darkTheme() : lightTheme()}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
