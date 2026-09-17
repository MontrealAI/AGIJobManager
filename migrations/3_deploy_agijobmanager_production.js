// Pre-v0.5.0 deployment migration retired: legacy snapshots use incompatible currencies/units.
module.exports = async function (_deployer, network) {
  if (network === 'test' || network === 'development') return;
  throw new Error('Legacy deployment migrations are retired. Use hardhat/scripts/deploy.js with a fresh USDC configuration.');
};
