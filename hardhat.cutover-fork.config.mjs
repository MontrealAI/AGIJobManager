import fs from 'node:fs';
import base from './hardhat/hardhat.config.js';

const pin = JSON.parse(fs.readFileSync(new URL('./hardhat/qualification/cutover-pin.json', import.meta.url), 'utf8'));

export default {
  ...base,
  networks: { hardhat: { ...base.networks.hardhat, chainId: 1, forking: { enabled: true,
    url: process.env.MAINNET_FORK_RPC_URL || 'https://eth-mainnet.g.alchemy.com/public', blockNumber: pin.blockNumber } } },
};
