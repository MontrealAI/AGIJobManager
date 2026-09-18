const { loadDeploymentEnv } = require('./load-env.cjs');
const { loadDeployConfig, resolveReviewedProfile, parsePositiveInt } = require('./deploy.cjs');
const { parseBooleanSetting, describeMembershipConfig } = require('./deployment-safety.cjs');

async function main(networkName = process.argv[2]) {
  if (!['mainnet', 'sepolia'].includes(networkName) || process.argv.length > 3) {
    throw new Error('Use npm --prefix hardhat run check:config:mainnet or check:config:sepolia. This check is offline.');
  }
  loadDeploymentEnv();
  const { config, configPath } = await loadDeployConfig();
  const { constructorArgs, finalOwner } = resolveReviewedProfile(networkName, config[networkName]);
  const confirmations = parsePositiveInt(process.env.CONFIRMATIONS, 'CONFIRMATIONS', 3, 1);
  if (networkName === 'mainnet' && confirmations < 3) throw new Error('Mainnet requires at least 3 confirmations.');
  parsePositiveInt(process.env.VERIFY_DELAY_MS, 'VERIFY_DELAY_MS', 3500, 0);
  parseBooleanSetting(process.env.DRY_RUN, 'DRY_RUN');
  const report = { checksPassed: true, scope: 'offline configuration only; no RPC, signer, runtime, explorer or readiness verification',
    network: networkName, chainId: networkName === 'mainnet' ? 1 : 11155111, configPath,
    finalOwner, settlementWallets: constructorArgs.settlementWallets, membership: describeMembershipConfig(constructorArgs),
    confirmations, transactionsBroadcast: 0 };
  console.log(JSON.stringify(report, null, 2));
  console.log(`Next: compile, then DRY_RUN=1 npm run deploy:${networkName} from hardhat/ with the reviewed RPC and DEPLOYER_ADDRESS.`);
  return report;
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
