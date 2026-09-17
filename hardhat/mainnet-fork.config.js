const base = require('./hardhat.config');

// No public-network signing configurations are exposed by this test runner.
module.exports = {
  ...base,
  networks: { hardhat: { chainId: 1, allowUnlimitedContractSize: false } },
  mocha: { timeout: 300000 },
};
