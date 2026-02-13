export const env = {
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || '1'),
  jobManager: (process.env.NEXT_PUBLIC_AGI_JOB_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  agiToken: (process.env.NEXT_PUBLIC_AGI_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  ensJobPages: process.env.NEXT_PUBLIC_ENS_JOB_PAGES_ADDRESS || '',
  wcProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
  explorer: process.env.NEXT_PUBLIC_EXPLORER_BASE_URL || ''
}
