const runSnapshotMigration = require('./2_deploy_agijobmanager_from_legacy_snapshot');

module.exports = async function (deployer, network, accounts) {
  if (process.env.LEGACY_SNAPSHOT_MIGRATION_ALREADY_RAN === '1') {
    return;
  }

  console.log('Deprecated migration shim: forwarding to 2_deploy_agijobmanager_from_legacy_snapshot.js');
  await runSnapshotMigration(deployer, network, accounts);
  process.env.LEGACY_SNAPSHOT_MIGRATION_ALREADY_RAN = '1';
};
