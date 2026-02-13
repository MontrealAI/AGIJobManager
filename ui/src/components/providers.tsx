'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { ThemeProvider } from 'next-themes';
import { wagmiConfig } from '@/lib/web3/config';
import '@rainbow-me/rainbowkit/styles.css';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode; rpcMainnetUrl?: string; rpcSepoliaUrl?: string }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 2, retryDelay: (a) => Math.min(1000 * 2 ** a, 5000) } } })
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={client}>
          <RainbowKitProvider>{children}</RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}

export default Providers;
