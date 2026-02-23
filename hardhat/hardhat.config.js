require('dotenv').config();
require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-verify');

const path = require('path');

const { MAINNET_RPC_URL, SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

const networks = {};
if (MAINNET_RPC_URL && PRIVATE_KEY) {
  networks.mainnet = { url: MAINNET_RPC_URL, accounts: [PRIVATE_KEY] };
}
if (SEPOLIA_RPC_URL && PRIVATE_KEY) {
  networks.sepolia = { url: SEPOLIA_RPC_URL, accounts: [PRIVATE_KEY] };
}

module.exports = {
  solidity: {
    version: '0.8.23',
    settings: {
      optimizer: { enabled: true, runs: 40 },
      evmVersion: 'shanghai',
      viaIR: false,
      metadata: { bytecodeHash: 'none' },
      debug: { revertStrings: 'strip' },
    },
  },
  paths: {
    sources: path.resolve(__dirname, 'contracts'),
    artifacts: path.resolve(__dirname, 'artifacts'),
    cache: path.resolve(__dirname, 'cache'),
  },
  networks,
  etherscan: {
    apiKey: ETHERSCAN_API_KEY || '',
  },
};
