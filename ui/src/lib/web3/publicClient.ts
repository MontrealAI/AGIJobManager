import { createPublicClient, fallback, http } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { CHAIN_ID } from '../constants';

const chain = CHAIN_ID===11155111?sepolia:mainnet;
const envRpc = CHAIN_ID===11155111?process.env.RPC_SEPOLIA_URL:process.env.RPC_MAINNET_URL;
export const publicClient = createPublicClient({ chain, transport: fallback([http(envRpc), http()]) });
