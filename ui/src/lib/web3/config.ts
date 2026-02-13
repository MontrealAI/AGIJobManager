import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia } from 'wagmi/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo';
export const wagmiConfig = getDefaultConfig({
  appName: 'AGIJobManager',
  projectId,
  chains: [mainnet, sepolia],
  ssr: true
});
