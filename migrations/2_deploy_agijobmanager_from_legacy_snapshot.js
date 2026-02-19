const runMainnetSnapshotMigration = require('./2_deploy_agijobmanager_from_legacy_mainnet');

module.exports = async function (deployer, network, accounts) {
  if (process.env.LEGACY_SNAPSHOT_MIGRATION_ALREADY_RAN === '1') {
    return;
  }

  console.log('Compatibility shim: forwarding to 2_deploy_agijobmanager_from_legacy_mainnet.js');
  await runMainnetSnapshotMigration(deployer, network, accounts);
  process.env.LEGACY_SNAPSHOT_MIGRATION_ALREADY_RAN = '1';
};
