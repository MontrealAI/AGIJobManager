import base from './hardhat.config.js';

export default {
  ...base,
  networks: { hardhat: { ...base.networks.hardhat, chainId: 1, forking: { enabled: true,
    url: process.env.MAINNET_FORK_RPC_URL || 'https://eth-mainnet.g.alchemy.com/public', blockNumber: 25997388 } } },
};
