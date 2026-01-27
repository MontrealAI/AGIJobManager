require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

const alchemyKey = process.env.ALCHEMY_KEY;
const alchemyKeymain = process.env.ALCHEMY_KEY_MAIN;
const infuraKey = process.env.INFURA_KEY;
const privateKeys = process.env.PRIVATE_KEYS ? process.env.PRIVATE_KEYS.split(',') : [];

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
    },
    mainnet: {
      provider: () => new HDWalletProvider(privateKeys, `https://eth-mainnet.g.alchemy.com/v2/${alchemyKeymain}`),
      network_id: 1,
      gas: 5741207,
      gasPrice: 3000000000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: false
    },
    ganache: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*", // Match any network id
    },
    sepolia: {
      provider: () => new HDWalletProvider(privateKeys, `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`),
      network_id: "*",
      gas: 30000000,
      gasPrice: 26757541223,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: false
    }
  },
  mocha: {},
  compilers: {
    solc: {
      version: "0.8.17",
      settings: {
        optimizer: {
          enabled: true,
          runs: 20000
        }
      }
    }
  },
  plugins: [
    'truffle-plugin-verify'
  ],
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY
  }
};

