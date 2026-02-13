export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 1);
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_AGI_JOB_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const AGI_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_AGI_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const ENS_JOB_PAGES = process.env.NEXT_PUBLIC_ENS_JOB_PAGES_ADDRESS as `0x${string}` | undefined;
export const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_BASE_URL || (CHAIN_ID===11155111?'https://sepolia.etherscan.io':'https://etherscan.io');
