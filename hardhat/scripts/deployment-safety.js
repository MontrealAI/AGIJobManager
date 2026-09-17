const { requireCanonicalUSDC } = require('../../scripts/lib/usdc');

const NETWORK_CHAINS = Object.freeze({ mainnet: 1, sepolia: 11155111 });
const MAX_RUNTIME_BYTES = 24576;
const USDC_ABI = [
  'function decimals() view returns (uint8)',
  'function paused() view returns (bool)',
  'function isBlacklisted(address) view returns (bool)',
  'function balanceOf(address) view returns (uint256)',
];

function requireDeploymentNetwork(networkName, chainId) {
  if (!NETWORK_CHAINS[networkName] || NETWORK_CHAINS[networkName] !== Number(chainId)) {
    throw new Error(`Network ${networkName} must use chain ${NETWORK_CHAINS[networkName] || '(unsupported)'}, received ${chainId}.`);
  }
}

function requireRuntimeSize(name, deployedBytecode) {
  if (typeof deployedBytecode !== 'string' || !deployedBytecode.startsWith('0x') || deployedBytecode.length % 2 !== 0) {
    throw new Error(`${name} has malformed runtime bytecode.`);
  }
  const bytes = (deployedBytecode.length - 2) / 2;
  if (!bytes || bytes > MAX_RUNTIME_BYTES) throw new Error(`${name} runtime ${bytes} bytes exceeds the valid 1..${MAX_RUNTIME_BYTES} range.`);
  return bytes;
}

async function requireCode(provider, address, label, blockTag) {
  const code = await provider.getCode(address, blockTag);
  if (!code || code === '0x') throw new Error(`${label} has no deployed bytecode at ${address}.`);
  return code;
}

async function requireOperationalUSDC({ chainId, tokenAddress, token, recipients, blockTag }) {
  requireCanonicalUSDC(chainId, tokenAddress);
  const overrides = { blockTag };
  if (Number(await token.decimals(overrides)) !== 6) throw new Error('USDC must use six decimals.');
  if (await token.paused(overrides)) throw new Error('Circle USDC is paused; deployment or activation is blocked.');
  const uniqueRecipients = [...new Set(recipients.map(address => address.toLowerCase()))];
  for (const address of uniqueRecipients) {
    if (await token.isBlacklisted(address, overrides)) throw new Error(`Circle USDC has blacklisted ${address}; deployment or activation is blocked.`);
  }
  return { decimals: 6, paused: false, checkedAddresses: uniqueRecipients, blockTag };
}

function requireVerified(verification, names) {
  const failed = names.filter(name => !['verified', 'already_verified'].includes(verification[name]?.status));
  if (failed.length) throw new Error(`Explorer verification incomplete for ${failed.join(', ')}. Intake must remain paused; use the saved deployment receipt to finish verification.`);
}

function requireReadinessState(state) {
  if (state.owner.toLowerCase() !== state.finalOwner.toLowerCase()) throw new Error('Final owner has not accepted ownership.');
  if (BigInt(state.pendingOwner) !== 0n) throw new Error('A pending ownership transfer remains open.');
  if (!state.paused) throw new Error('Pre-activation readiness requires intake to be paused.');
  if (state.settlementPaused) throw new Error('Settlement is paused; review the emergency state before activation.');
  for (let index = 0; index < 2; index += 1) {
    if (state.wallets[index].toLowerCase() !== state.expectedWallets[index].toLowerCase()) throw new Error(`Settlement wallet ${index} does not match the reviewed receipt.`);
  }
  if (state.wallets[0].toLowerCase() === state.wallets[1].toLowerCase()) throw new Error('Settlement wallets must be distinct.');
  const reserved = state.reserves.reduce((sum, amount) => sum + BigInt(amount), 0n);
  if (BigInt(state.balance) < reserved) throw new Error('USDC balance is below reserved escrow and bonds.');
  if (reserved !== 0n) throw new Error('Initial activation requires no existing job escrow or bonds.');
  return { reserved: reserved.toString(), balance: String(state.balance) };
}

function requireArtifactMatch({ artifact, buildInfo, address, libraries = {}, tokenAddress, code }) {
  let expected = artifact.deployedBytecode.slice(2).toLowerCase();
  const replace = (start, length, value) => {
    const hex = value.replace(/^0x/, '').toLowerCase().padStart(length * 2, '0');
    if (hex.length !== length * 2 || !/^[a-f0-9]+$/.test(hex)) throw new Error('Invalid bytecode substitution.');
    expected = expected.slice(0, start * 2) + hex + expected.slice((start + length) * 2);
  };
  for (const [source, names] of Object.entries(artifact.deployedLinkReferences || {})) {
    for (const [name, positions] of Object.entries(names)) {
      const linkedAddress = libraries[`${source}:${name}`];
      if (!linkedAddress) throw new Error(`Missing linked library ${source}:${name}.`);
      positions.forEach(({ start, length }) => replace(start, length, linkedAddress));
    }
  }
  const target = buildInfo.output.contracts[artifact.sourceName][artifact.contractName];
  const immutableGroups = Object.values(target.evm.deployedBytecode.immutableReferences || {});
  if (immutableGroups.length) {
    if (artifact.contractName !== 'AGIJobManager' || immutableGroups.length !== 1 || !tokenAddress) throw new Error('Unrecognized immutable layout; review deployment verifier before continuing.');
    immutableGroups.flat().forEach(({ start, length }) => replace(start, length, tokenAddress));
  }
  if (artifact.contractName !== 'AGIJobManager' && expected.startsWith(`73${'00'.repeat(20)}3014`)) replace(1, 20, address);
  if (`0x${expected}` !== code.toLowerCase()) throw new Error(`${artifact.contractName} deployed runtime differs from the compiled release artifact.`);
  return requireRuntimeSize(artifact.contractName, code);
}

module.exports = { NETWORK_CHAINS, MAX_RUNTIME_BYTES, USDC_ABI, requireDeploymentNetwork, requireRuntimeSize, requireCode, requireOperationalUSDC, requireVerified, requireReadinessState, requireArtifactMatch };
