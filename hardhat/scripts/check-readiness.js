const fs = require('fs');
const path = require('path');
const { ethers, network, artifacts } = require('hardhat');
const { qualifiedBuild, FQNS, LIBRARIES } = require('./deploy');
const { USDC_ABI, requireDeploymentNetwork, requireCode, requireOperationalUSDC, requireVerified, requireReadinessState, requireArtifactMatch } = require('./deployment-safety');

async function main() {
  if (!process.env.DEPLOYMENT_RECEIPT) throw new Error('Set DEPLOYMENT_RECEIPT to the reviewed deployment receipt JSON.');
  const receiptPath = path.resolve(process.cwd(), process.env.DEPLOYMENT_RECEIPT);
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  requireDeploymentNetwork(network.name, chainId);
  if (receipt.chainId !== chainId || receipt.network !== network.name) throw new Error('Receipt network or chain does not match this provider.');
  requireVerified(receipt.verification, [...LIBRARIES, 'AGIJobManager']);
  const { buildInfo } = await qualifiedBuild();
  const block = await ethers.provider.getBlock('latest');
  if (!block) throw new Error('Unable to resolve the readiness block.');
  const calls = { blockTag: block.number };
  const managerAddress = receipt.contracts.AGIJobManager.address;
  const manager = await ethers.getContractAt('AGIJobManager', managerAddress, ethers.provider);
  const tokenAddress = await manager.usdcToken(calls);
  if (tokenAddress.toLowerCase() !== receipt.constructorArgs.usdcTokenAddress.toLowerCase()) throw new Error('Manager token differs from the reviewed deployment receipt.');
  const runtimeCodeHashes = {};
  for (const name of [...LIBRARIES, 'AGIJobManager']) {
    const deployment = receipt.contracts[name];
    if (!deployment || !ethers.isAddress(deployment.address)) throw new Error(`Missing ${name} deployment address.`);
    if (name !== 'AGIJobManager' && receipt.libraries[FQNS[name]]?.toLowerCase() !== deployment.address.toLowerCase()) throw new Error(`Linked ${name} address differs from the deployment receipt.`);
    const code = await requireCode(ethers.provider, deployment.address, name, block.number);
    requireArtifactMatch({ artifact: await artifacts.readArtifact(FQNS[name]), buildInfo, address: deployment.address,
      libraries: receipt.libraries, tokenAddress, code });
    runtimeCodeHashes[name] = ethers.keccak256(code);
    if (runtimeCodeHashes[name] !== deployment.runtimeCodeHash) throw new Error(`${name} bytecode hash differs from the deployment receipt.`);
  }
  const token = new ethers.Contract(tokenAddress, USDC_ABI, ethers.provider);
  const [owner, pendingOwner, paused, settlementPaused, wallet30, wallet10, balance, ...reserves] = await Promise.all([
    manager.owner(calls), manager.pendingOwner(calls), manager.paused(calls), manager.settlementPaused(calls),
    manager.wallet30(calls), manager.wallet10(calls), token.balanceOf(managerAddress, calls),
    manager.lockedEscrow(calls), manager.lockedAgentBonds(calls), manager.lockedValidatorBonds(calls), manager.lockedDisputeBonds(calls),
  ]);
  const accounting = requireReadinessState({ owner, pendingOwner, paused, settlementPaused, wallets: [wallet30, wallet10],
    expectedWallets: receipt.constructorArgs.settlementWallets, finalOwner: receipt.finalOwner, balance, reserves });
  const tokenState = await requireOperationalUSDC({ chainId, tokenAddress, token, recipients: [managerAddress, owner, wallet30, wallet10], blockTag: block.number });
  const report = {
    checksPassed: true, scope: 'read-only pre-activation technical checks; owner operational review and independent security review remain separate',
    chainId, network: network.name, manager: managerAddress, owner, pendingOwner, intakePaused: paused,
    settlementWallets: [wallet30, wallet10], blockNumber: block.number, blockHash: block.hash,
    accounting, tokenState, runtimeCodeHashes, transactionsBroadcast: 0,
  };
  const reportPath = receiptPath.replace(/\.json$/, '') + `.readiness.${block.number}.json`;
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify(report, null, 2));
  console.log(`Readiness report: ${reportPath}`);
  console.log('Intake remains paused. The accepted owner must review participant eligibility, limits, monitoring, incident response and the deployment runbook before choosing to activate.');
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { main };
