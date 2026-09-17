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

async function fetchAgiTypes(instance, calls = {}) {
  const items = [];
  for (let index = 0; ; index += 1) {
    try {
      const entry = await instance.agiTypes(index, calls);
      items.push({ nftAddress: entry.nftAddress, payoutPercentage: entry.payoutPercentage.toString() });
    } catch (error) {
      // Generated public array getters revert with empty data at the end;
      // explicit array access may instead return Panic(0x32). RPC errors fail closed.
      if (error.code === 'CALL_EXCEPTION' && [
        '0x', `0x4e487b71${'0'.repeat(62)}32`,
      ].includes(error.data?.toLowerCase())) return items;
      throw error;
    }
  }
}

function cliCallback(error) {
  if (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = { providerFor, assertNetwork, managerAbi, loadManager, fetchAgiTypes, cliCallback };
