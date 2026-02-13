'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode; rpcMainnetUrl?: string; rpcSepoliaUrl?: string }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 2, retryDelay: (a) => Math.min(1000 * 2 ** a, 5000) } } }));
  return <ThemeProvider attribute="class" defaultTheme="dark"><QueryClientProvider client={client}>{children}</QueryClientProvider></ThemeProvider>;
}

export default Providers;
