const fs = require('node:fs');
const path = require('node:path');
const { Contract, JsonRpcProvider, getAddress } = require('ethers');
require('dotenv').config();

const NETWORK_CHAINS = { mainnet: 1n, sepolia: 11155111n };

function providerFor(network = 'development', rpcUrl) {
  if (!['development', 'localhost', 'test', 'mainnet', 'sepolia'].includes(network)) {
    throw new Error(`Unknown network: ${network}`);
  }
  const url = rpcUrl || process.env.RPC_URL || process.env.WEB3_PROVIDER
    || process.env[`${network.toUpperCase()}_RPC_URL`]
    || (!NETWORK_CHAINS[network] ? 'http://127.0.0.1:8545' : null);
  if (!url) throw new Error(`Missing ${network.toUpperCase()}_RPC_URL or RPC_URL`);
  return new JsonRpcProvider(url);
}

async function assertNetwork(provider, network, localWrite = false) {
  const { chainId } = await provider.getNetwork();
  const expected = NETWORK_CHAINS[network];
  if (expected && chainId !== expected) throw new Error(`RPC chain ${chainId} does not match ${network} (${expected})`);
  if (localWrite && ![1337n, 31337n].includes(chainId)) {
    throw new Error('This configuration command only writes to disposable local chains (1337/31337). Use the owner console for public-chain configuration.');
  }
  return chainId;
}

function managerAbi() {
  const artifactPath = path.join(__dirname, '../../hardhat/artifacts/contracts/AGIJobManager.sol/AGIJobManager.json');
  if (!fs.existsSync(artifactPath)) throw new Error('Missing AGIJobManager artifact. Run npm run build first.');
  return JSON.parse(fs.readFileSync(artifactPath, 'utf8')).abi;
}

async function loadManager(address, network, { provider: suppliedProvider, localWrite = false, dryRun = false } = {}) {
  const provider = suppliedProvider || providerFor(network);
  try {
    await assertNetwork(provider, network, localWrite);
    const checkedAddress = getAddress(address);
    if (await provider.getCode(checkedAddress) === '0x') throw new Error(`No contract code at ${checkedAddress}`);
    const runner = localWrite && !dryRun ? await provider.getSigner(process.env.TX_FROM || 0) : provider;
    return { instance: new Contract(checkedAddress, managerAbi(), runner), provider };
  } catch (error) {
    if (!suppliedProvider) provider.destroy();
    throw error;
  }
}

function assertSupportedConfig(config) {
  if (config.agiTypes !== undefined) {
    throw new Error('Legacy agiTypes configuration is retired: array-getter reverts cannot prove a complete registry. Use canonical readiness with READINESS_NFT_CONFIG and original build evidence for verification; use reviewed addAGIType/disableAGIType calls on disposable local chains for setup. No operations were performed.');
  }
}

function cliCallback(error) {
  if (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = { providerFor, assertNetwork, managerAbi, loadManager, assertSupportedConfig, cliCallback };
