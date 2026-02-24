import { OFFICIAL_DEPLOYMENT } from './constants';

export const env = {
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || String(OFFICIAL_DEPLOYMENT.chainId)),
  agiJobManagerAddress: (process.env.NEXT_PUBLIC_AGI_JOB_MANAGER_ADDRESS || OFFICIAL_DEPLOYMENT.addresses.AGIJobManager) as `0x${string}`,
  agiTokenAddress: (process.env.NEXT_PUBLIC_AGI_TOKEN_ADDRESS || OFFICIAL_DEPLOYMENT.agiTokenAddress) as `0x${string}`,
  ensJobPagesAddress: process.env.NEXT_PUBLIC_ENS_JOB_PAGES_ADDRESS || '',
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
  explorerBaseUrl: process.env.NEXT_PUBLIC_EXPLORER_BASE_URL || 'https://etherscan.io'
};
