import { encodeFunctionData, isAddress, zeroAddress } from 'viem';

export const USDC_DECIMALS = 6;
export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
};
export function configuredUSDC(chainId: number, configured?: string): `0x${string}` {
  const canonical = USDC_ADDRESSES[chainId];
  if (configured && (!canonical || configured.toLowerCase() !== canonical.toLowerCase())) {
    throw new Error('Only canonical Circle USDC may be configured.');
  }
  return canonical || zeroAddress;
}
const tokenAbi = [
  ...['wallet30', 'wallet10', 'pendingOwner'].map(name => ({ type: 'function', name, stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] })),
  { type: 'function', name: 'usdcToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }
] as const;

export async function verifyUSDCDeployment(client: any, manager: string, chainId: number) {
  const expected = USDC_ADDRESSES[chainId];
  if (!expected) throw new Error('Unsupported USDC chain.');
  if (!isAddress(manager) || manager.toLowerCase() === zeroAddress) throw new Error('Configure a verified v0.9.0 USDC deployment.');
  if (await client.getChainId() !== chainId) throw new Error('USDC provider chain mismatch.');
  const code = await client.getBytecode({ address: manager });
  if (!code || code === '0x') throw new Error('USDC manager has no deployed code.');
  const token = await client.readContract({ address: manager, abi: tokenAbi, functionName: 'usdcToken' });
  if (String(token).toLowerCase() !== expected.toLowerCase()) throw new Error('Manager does not settle in native Circle USDC.');
  const decimals = await client.readContract({ address: expected, abi: tokenAbi, functionName: 'decimals' });
  if (Number(decimals) !== USDC_DECIMALS) throw new Error('USDC must have six decimals.');
  const wallets = await Promise.all(['wallet30', 'wallet10'].map(functionName => client.readContract({ address: manager, abi: tokenAbi, functionName })));
  const invalid = [zeroAddress, manager, expected].map(x => x.toLowerCase());
  if (wallets.some(x => !isAddress(String(x)) || invalid.includes(String(x).toLowerCase())) || String(wallets[0]).toLowerCase() === String(wallets[1]).toLowerCase()) {
    throw new Error('A v0.9.0 manager with distinct valid 30% and 10% settlement wallets is required.');
  }
  const pending = await client.readContract({ address: manager, abi: tokenAbi, functionName: 'pendingOwner' });
  if (!isAddress(String(pending))) throw new Error('A v0.9.0 manager with two-step ownership is required.');
  return expected;
}

export function assertUSDCWriteTarget(address: string, manager: string, token: string, functionName: string, args: readonly unknown[] = []) {
  if (address.toLowerCase() === manager.toLowerCase()) return;
  if (address.toLowerCase() === token.toLowerCase() && functionName === 'approve' && String(args[0]).toLowerCase() === manager.toLowerCase()) return;
  throw new Error('Only the verified USDC manager and its USDC approvals are supported.');
}

export async function assertUSDCWalletContext(walletClient: any, expectedAccount: string, expectedChainId: number) {
  if (!walletClient || !expectedAccount) throw new Error('Connect wallet.');
  const [chainId, accounts] = await Promise.all([walletClient.getChainId(), walletClient.getAddresses()]);
  if (chainId !== expectedChainId || String(accounts?.[0] || '').toLowerCase() !== expectedAccount.toLowerCase()) {
    throw new Error('Wallet account or network changed. Review the action again.');
  }
}

export function assertSimulatedUSDCRequest(request: any, reviewed: any) {
  const sameTarget = String(request.address).toLowerCase() === String(reviewed.address).toLowerCase();
  const calldata = (config: any) => encodeFunctionData({ abi: config.abi, functionName: config.functionName, args: config.args });
  if (!sameTarget || BigInt(request.value || 0) !== BigInt(reviewed.value || 0) || calldata(request) !== calldata(reviewed)) {
    throw new Error('Transaction details changed after review. Review the action again.');
  }
}
