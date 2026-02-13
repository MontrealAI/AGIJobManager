export const env = {
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || '1'),
  agiJobManagerAddress: (process.env.NEXT_PUBLIC_AGI_JOB_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  agiTokenAddress: (process.env.NEXT_PUBLIC_AGI_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  ensJobPagesAddress: process.env.NEXT_PUBLIC_ENS_JOB_PAGES_ADDRESS || '',
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
  explorerBaseUrl: process.env.NEXT_PUBLIC_EXPLORER_BASE_URL || ''
}
