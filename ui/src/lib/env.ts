export const env = {
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? '1'),
  agiJobManagerAddress: (process.env.NEXT_PUBLIC_AGI_JOB_MANAGER_ADDRESS ??
    '0x0000000000000000000000000000000000000000') as `0x${string}`,
  agiTokenAddress: (process.env.NEXT_PUBLIC_AGI_TOKEN_ADDRESS ??
    '0x0000000000000000000000000000000000000000') as `0x${string}`,
  ensJobPagesAddress: process.env.NEXT_PUBLIC_ENS_JOB_PAGES_ADDRESS as `0x${string}` | undefined,
  wcProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '',
  rpcMainnetUrl: process.env.RPC_MAINNET_URL ?? 'https://cloudflare-eth.com',
  rpcSepoliaUrl: process.env.RPC_SEPOLIA_URL ?? 'https://rpc.sepolia.org',
  hasPrivateRpc: Boolean(process.env.RPC_MAINNET_URL || process.env.RPC_SEPOLIA_URL)
};

export const degradedRpc = !env.hasPrivateRpc;
