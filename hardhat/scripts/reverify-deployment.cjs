const fs = require('fs');
const path = require('path');
const { getRuntime } = require('./runtime.cjs');
let ethers = require('ethers');
const { requireCanonicalUSDC } = require('../../scripts/lib/usdc');
const { FQNS, LIBRARIES, qualifiedBuild, resolveConstructor, stableObject, verifyWithRetry, parsePositiveInt } = require('./deploy.cjs');
const { requireDeploymentNetwork, requireExplorerEnabled, requireConfirmedReceipt, requireCode, requireArtifactMatch, requireVerified } = require('./deployment-safety.cjs');

async function main() {
  const runtime = await getRuntime();
  ethers = runtime.ethers;
  const { network, artifacts, config } = runtime;
  if (!process.env.DEPLOYMENT_RECEIPT) throw new Error('Set DEPLOYMENT_RECEIPT to the saved deployment journal. This command sends no blockchain transactions.');
  requireExplorerEnabled(config);
  const receiptPath = path.resolve(process.cwd(), process.env.DEPLOYMENT_RECEIPT);
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  requireDeploymentNetwork(network.name, chainId);
  if (receipt.chainId !== chainId || receipt.network !== network.name) throw new Error('Saved deployment journal does not match this network and chain.');
  const constructorArgs = resolveConstructor(network.name, receipt.constructorArgs);
  if (!ethers.isAddress(receipt.finalOwner) || [ethers.ZeroAddress, constructorArgs.usdcTokenAddress].some(address => address.toLowerCase() === receipt.finalOwner.toLowerCase())) throw new Error('Saved deployment journal is missing a valid final owner.');
  if (!ethers.isAddress(receipt.deployer)) throw new Error('Saved deployment journal is missing a valid deployer.');
  requireCanonicalUSDC(chainId, constructorArgs.usdcTokenAddress);
  const libraries = receipt.libraries;
  const payload = stableObject({ constructorArgs, libraries, finalOwner: receipt.finalOwner });
  const configHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)));
  if (receipt.configHash && receipt.configHash.toLowerCase() !== configHash) throw new Error('Saved deployment configuration hash is inconsistent; use the original journal.');
  const confirmations = Math.max(chainId === 1 ? 3 : 1, parsePositiveInt(receipt.confirmations, 'Saved confirmations', 3, 1));
  const delay = parsePositiveInt(process.env.VERIFY_DELAY_MS, 'VERIFY_DELAY_MS', 3500, 0);
  const { buildInfo } = await qualifiedBuild();
  const block = await ethers.provider.getBlock('latest');
  if (!block || !ethers.isHexString(block.hash, 32)) throw new Error('Cannot identify the current chain block for recovery.');
  const contracts = {};
  const managerArgs = [constructorArgs.usdcTokenAddress, constructorArgs.baseIpfsUrl, constructorArgs.ensConfig,
    constructorArgs.rootNodes, constructorArgs.merkleRoots, constructorArgs.settlementWallets];
  for (const name of [...LIBRARIES, 'AGIJobManager']) {
    const recorded = receipt.contracts?.[name];
    if (!recorded || !ethers.isAddress(recorded.address) || !ethers.isHexString(recorded.txHash, 32)) {
      throw new Error(`The journal lacks ${name} and its broadcast transaction. Partial library-only deployments cannot be resumed by this verification-only command.`);
    }
    if (name !== 'AGIJobManager' && libraries?.[FQNS[name]]?.toLowerCase() !== recorded.address.toLowerCase()) throw new Error(`Saved ${name} link differs from its deployed address.`);
    const transactionReceipt = requireConfirmedReceipt(await ethers.provider.getTransactionReceipt(recorded.txHash), recorded.txHash, recorded.address);
    const transaction = await ethers.provider.getTransaction(recorded.txHash);
    const factory = await ethers.getContractFactory(FQNS[name], { libraries });
    const expectedCreation = await factory.getDeployTransaction(...(name === 'AGIJobManager' ? managerArgs : []));
    if (!transaction || transaction.to !== null || transaction.from?.toLowerCase() !== receipt.deployer.toLowerCase() || transaction.data?.toLowerCase() !== expectedCreation.data.toLowerCase()) {
      throw new Error(`${name} creation transaction differs from the recorded deployer or exact constructor and linked creation code.`);
    }
    if (block.number - transactionReceipt.blockNumber + 1 < confirmations) throw new Error(`${name} is not sufficiently confirmed; retry after ${confirmations} confirmations.`);
    const minedBlock = await ethers.provider.getBlock(transactionReceipt.blockNumber);
    if (!minedBlock || minedBlock.hash?.toLowerCase() !== transactionReceipt.blockHash.toLowerCase()) throw new Error(`${name} receipt is not in the canonical chain; reconcile before retrying.`);
    if (recorded.blockNumber !== undefined && recorded.blockNumber !== transactionReceipt.blockNumber) throw new Error(`${name} mined block differs from the saved journal.`);
    if (recorded.blockHash && recorded.blockHash.toLowerCase() !== transactionReceipt.blockHash.toLowerCase()) throw new Error(`${name} block hash differs from the saved journal.`);
    const code = await requireCode(ethers.provider, recorded.address, name, block.number);
    requireArtifactMatch({ artifact: await artifacts.readArtifact(FQNS[name]), buildInfo, address: recorded.address,
      libraries, tokenAddress: constructorArgs.usdcTokenAddress, code });
    const runtimeCodeHash = ethers.keccak256(code);
    if (recorded.runtimeCodeHash && recorded.runtimeCodeHash.toLowerCase() !== runtimeCodeHash) throw new Error(`${name} runtime hash differs from the saved journal.`);
    contracts[name] = { address: recorded.address, txHash: recorded.txHash, blockNumber: transactionReceipt.blockNumber,
      blockHash: transactionReceipt.blockHash, runtimeCodeHash };
  }
  const manager = await ethers.getContractAt('AGIJobManager', contracts.AGIJobManager.address, ethers.provider);
  const calls = { blockTag: block.number };
  const [tokenAddress, paused, owner, pendingOwner] = await Promise.all([manager.usdcToken(calls), manager.paused(calls), manager.owner(calls), manager.pendingOwner(calls)]);
  if (tokenAddress.toLowerCase() !== constructorArgs.usdcTokenAddress.toLowerCase() || !paused) throw new Error('Manager token or paused intake differs from the intended deployment. Reconcile before recovery.');
  if (![receipt.finalOwner, receipt.deployer].some(address => address.toLowerCase() === owner.toLowerCase())) throw new Error('Current owner differs from the saved deployer and intended final owner.');
  if (![ethers.ZeroAddress, receipt.finalOwner].some(address => address.toLowerCase() === pendingOwner.toLowerCase())) throw new Error('Pending ownership proposal differs from the reviewed final owner.');
  const verification = {};
  for (const name of [...LIBRARIES, 'AGIJobManager']) {
    verification[name] = await verifyWithRetry({ name, record: contracts[name],
      constructorArguments: name === 'AGIJobManager' ? managerArgs : [], libraries }, delay);
  }
  requireVerified(verification, [...LIBRARIES, 'AGIJobManager']);
  const sameBlock = await ethers.provider.getBlock(block.number);
  if (!sameBlock || sameBlock.hash?.toLowerCase() !== block.hash.toLowerCase()) throw new Error('Recovery block changed during verification; rerun. The original journal is unchanged.');
  const accepted = owner.toLowerCase() === receipt.finalOwner.toLowerCase();
  const recovered = { ...receipt, contracts, configHash, verification, status: 'awaiting_readiness_review', intakePaused: paused,
    ownershipTransfer: { ...(receipt.ownershipTransfer || {}), currentOwner: owner, pendingOwner, accepted,
      acceptanceRequired: !accepted, proposalRequired: !accepted && pendingOwner === ethers.ZeroAddress },
    recovery: { originalReceipt: receiptPath, blockNumber: block.number, blockHash: block.hash, blockchainTransactionsBroadcast: 0 } };
  delete recovered.error;
  const recoveredPath = receiptPath.replace(/\.json$/, '') + `.reverified.${block.number}.json`;
  fs.writeFileSync(recoveredPath, `${JSON.stringify(recovered, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(`Reverified deployment receipt: ${recoveredPath}`);
  console.log('No blockchain transactions were sent. Preserve the original journal. Use the recovered receipt for the read-only readiness check.');
  if (!accepted) console.log(`Owner action remains required: ${recovered.ownershipTransfer.proposalRequired ? 'the current owner must propose transferOwnership(finalOwner), then ' : ''}${receipt.finalOwner} must acceptOwnership(). Intake remains paused.`);
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { main };
