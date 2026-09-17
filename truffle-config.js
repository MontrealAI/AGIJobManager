require('dotenv').config();
const ganache = require('ganache');
// Truffle/Ganache are retained for local regression tests only. Public-chain
// signing uses the maintained Hardhat deployment path and the owner's wallet UI.
const n = (v, d) => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : d;
};
const gweiToWei = (g) => Math.floor(n(g, 0) * 1e9);
function providerFor(net) {
  throw new Error(`Truffle ${net} signing is retired. Use the Hardhat deployment workflow or the v0.9.0 owner console.`);
}

const mainnetGasPrice = process.env.MAINNET_GAS_PRICE_GWEI ? gweiToWei(process.env.MAINNET_GAS_PRICE_GWEI) : undefined;
const sepoliaGasPrice = process.env.SEPOLIA_GAS_PRICE_GWEI ? gweiToWei(process.env.SEPOLIA_GAS_PRICE_GWEI) : undefined;

const gasMainnet = n(process.env.MAINNET_GAS, 8_000_000);
const gasSepolia = n(process.env.SEPOLIA_GAS, 8_000_000);

const confirmationsMainnet = n(process.env.MAINNET_CONFIRMATIONS, 2);
const confirmationsSepolia = n(process.env.SEPOLIA_CONFIRMATIONS, 2);

const timeoutBlocksMainnet = n(process.env.MAINNET_TIMEOUT_BLOCKS, 500);
const timeoutBlocksSepolia = n(process.env.SEPOLIA_TIMEOUT_BLOCKS, 500);

const solcVersion = require.resolve('solc/soljson.js');
const solcRuns = 40;
const solcViaIR = false;
const evmVersion = (process.env.SOLC_EVM_VERSION || 'shanghai').trim();

const testProvider = ganache.provider({
  wallet: {
    mnemonic: process.env.GANACHE_MNEMONIC || "test test test test test test test test test test test junk",
  },
  logging: { quiet: true },
  chain: { chainId: 1337, networkId: 1337, hardfork: "shanghai", allowUnlimitedContractSize: true },
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
