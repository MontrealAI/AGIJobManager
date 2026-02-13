'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { env } from '@/lib/env';

const queryClient = new QueryClient();
const config = getDefaultConfig({
  appName: 'AGI Job Manager',
  projectId: env.wcProjectId || 'demo',
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_RPC_MAINNET_URL || 'https://cloudflare-eth.com'),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_SEPOLIA_URL || 'https://rpc.sepolia.org')
  }
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config as ReturnType<typeof createConfig>}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default Providers;
