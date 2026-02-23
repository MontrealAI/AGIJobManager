require('dotenv').config();
require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-verify');

const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

module.exports = {
  solidity: {
    version: '0.8.23',
    settings: {
      optimizer: {
        enabled: true,
        runs: 40,
      },
      evmVersion: 'shanghai',
      viaIR: false,
      metadata: {
        bytecodeHash: 'none',
      },
      debug: {
        revertStrings: 'strip',
      },
    },
  },
  paths: {
    sources: './contracts',
  },
  networks: {
    mainnet: {
      url: process.env.MAINNET_RPC_URL || '',
      accounts,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || '',
      accounts,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || '',
  },
};
