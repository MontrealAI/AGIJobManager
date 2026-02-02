require('dotenv').config();
const ganache = require('ganache');
const HDWalletProvider = require('@truffle/hdwallet-provider');

const pk = (process.env.PRIVATE_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
const infura = (process.env.INFURA_KEY || '').trim();
const alchemySepolia = (process.env.ALCHEMY_KEY || '').trim();
const alchemyMain = (process.env.ALCHEMY_KEY_MAIN || process.env.ALCHEMY_KEY || '').trim();

const n = (v, d) => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : d;
};
const gweiToWei = (g) => Math.floor(n(g, 0) * 1e9);

const pollingInterval = n(process.env.RPC_POLLING_INTERVAL_MS, 8000);

function rpcUrl(net) {
  const direct = (process.env[`${net.toUpperCase()}_RPC_URL`] || '').trim();
  if (direct) return direct;

  if (net === 'mainnet') {
    if (alchemyMain) return `https://eth-mainnet.g.alchemy.com/v2/${alchemyMain}`;
    if (infura) return `https://mainnet.infura.io/v3/${infura}`;
  }
  if (net === 'sepolia') {
    if (alchemySepolia) return `https://eth-sepolia.g.alchemy.com/v2/${alchemySepolia}`;
    if (infura) return `https://sepolia.infura.io/v3/${infura}`;
  }
  return '';
}

function providerFor(net) {
  const url = rpcUrl(net);
  if (!url) throw new Error(`Missing RPC URL for ${net}. Set ${net.toUpperCase()}_RPC_URL or ALCHEMY_KEY(_MAIN)/INFURA_KEY.`);
  if (!pk.length) throw new Error('Missing PRIVATE_KEYS (comma-separated).');
  return new HDWalletProvider({ privateKeys: pk, providerOrUrl: url, shareNonce: true, pollingInterval });
}

const mainnetGasPrice = process.env.MAINNET_GAS_PRICE_GWEI ? gweiToWei(process.env.MAINNET_GAS_PRICE_GWEI) : undefined;
const sepoliaGasPrice = process.env.SEPOLIA_GAS_PRICE_GWEI ? gweiToWei(process.env.SEPOLIA_GAS_PRICE_GWEI) : undefined;

const gasMainnet = n(process.env.MAINNET_GAS, 8_000_000);
const gasSepolia = n(process.env.SEPOLIA_GAS, 8_000_000);

const confirmationsMainnet = n(process.env.MAINNET_CONFIRMATIONS, 2);
const confirmationsSepolia = n(process.env.SEPOLIA_CONFIRMATIONS, 2);

const timeoutBlocksMainnet = n(process.env.MAINNET_TIMEOUT_BLOCKS, 500);
const timeoutBlocksSepolia = n(process.env.SEPOLIA_TIMEOUT_BLOCKS, 500);

const solcVersion = (process.env.SOLC_VERSION || '0.8.23').trim();
const solcRuns = Math.floor(n(process.env.SOLC_RUNS, 150));
const solcViaIR = (process.env.SOLC_VIA_IR || 'true').toLowerCase() === 'true';
const evmVersion = (process.env.SOLC_EVM_VERSION || 'london').trim();

const testProvider = ganache.provider({
  wallet: {
    mnemonic: process.env.GANACHE_MNEMONIC || "test test test test test test test test test test test junk",
  },
  logging: { quiet: true },
  chain: { chainId: 1337, networkId: 1337, hardfork: "london", allowUnlimitedContractSize: true },
  miner: { blockGasLimit: 100_000_000 },
});

module.exports = {
  networks: {
    test: {
      provider: () => testProvider,
      network_id: 1337,
      gas: 80_000_000,
    },

    development: { host: "127.0.0.1", port: 8545, network_id: "*" },

    sepolia: {
      provider: () => providerFor('sepolia'),
      network_id: 11155111,
      gas: gasSepolia,
      confirmations: confirmationsSepolia,
      timeoutBlocks: timeoutBlocksSepolia,
      skipDryRun: true,
      ...(sepoliaGasPrice ? { gasPrice: sepoliaGasPrice } : {}),
    },

    mainnet: {
      provider: () => providerFor('mainnet'),
      network_id: 1,
      gas: gasMainnet,
      confirmations: confirmationsMainnet,
      timeoutBlocks: timeoutBlocksMainnet,
      skipDryRun: true,
      ...(mainnetGasPrice ? { gasPrice: mainnetGasPrice } : {}),
    },
  },

  mocha: { timeout: 100000 },

  compilers: {
    solc: {
      version: solcVersion,
      settings: {
        optimizer: { enabled: true, runs: solcRuns },
        evmVersion,
        viaIR: solcViaIR,
        metadata: { bytecodeHash: 'none' },
        debug: { revertStrings: 'strip' },
      },
    },
  },

  plugins: ["truffle-plugin-verify"],

  api_keys: { etherscan: process.env.ETHERSCAN_API_KEY },
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY },
};
