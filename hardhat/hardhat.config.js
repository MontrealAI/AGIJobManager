import 'dotenv/config';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatMocha from '@nomicfoundation/hardhat-mocha';

const require = createRequire(import.meta.url);
const directory = path.dirname(fileURLToPath(import.meta.url));
const compilerPath = require.resolve('solc/soljson.js', { paths: [path.resolve(directory, '..')] });
const compiler = { version: '0.8.37', path: compilerPath, preferWasm: true,
  settings: { optimizer: { enabled: true, runs: 40 }, evmVersion: 'shanghai', viaIR: true,
    metadata: { bytecodeHash: 'none' }, debug: { revertStrings: 'strip' } } };
const networks = {
  hardhat: { type: 'edr-simulated', chainType: 'l1', chainId: 31337, hardfork: 'osaka',
    allowUnlimitedContractSize: false, allowBlocksWithSameTimestamp: true, blockGasLimit: 100_000_000,
    accounts: { mnemonic: 'test test test test test test test test test test test junk', count: 10 } },
};
for (const [name, key, chainId] of [['mainnet', 'MAINNET_RPC_URL', 1], ['sepolia', 'SEPOLIA_RPC_URL', 11155111]]) {
  if (process.env[key]) networks[name] = { type: 'http', chainType: 'l1', url: process.env[key], chainId,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [] };
}
export default {
  plugins: [hardhatEthers, hardhatMocha],
  solidity: { profiles: { default: compiler, production: compiler } },
  paths: { sources: 'contracts', artifacts: 'hardhat/artifacts', cache: 'hardhat/cache',
    tests: { mocha: 'hardhat/test' } },
  networks,
  test: { mocha: { timeout: 300000 } },
};
