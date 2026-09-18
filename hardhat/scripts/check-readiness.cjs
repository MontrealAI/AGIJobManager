const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { getRuntime } = require('./runtime.cjs');
let ethers = require('ethers');
const { qualifiedBuild, FQNS, LIBRARIES } = require('./deploy.cjs');
const { USDC_ABI, describeMembershipConfig, requireDeploymentNetwork, requireCode, requireOperationalUSDC, requireVerified, requireReadinessState, requireArtifactMatch } = require('./deployment-safety.cjs');

const { normalizeNftPolicy, checkNftPolicy } = require('./nft-policy.cjs');

const IDENTITY_FIELDS = { ensConfig: 2, rootNodes: 4, merkleRoots: 2 };

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableObject(value[key])]));
  return value;
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
}

function requireAddress(value, label, allowZero = false) {
  if (!ethers.isAddress(value) || (!allowZero && value.toLowerCase() === ethers.ZeroAddress)) throw new Error(`${label} must be a valid ${allowZero ? '' : 'non-zero '}address.`);
}

function requireIdentityConfig(config, label) {
  for (const [field, length] of Object.entries(IDENTITY_FIELDS)) {
    if (!Array.isArray(config[field]) || config[field].length !== length) throw new Error(`${label}.${field} must contain exactly ${length} values.`);
    config[field].forEach((value, index) => {
      if (field === 'ensConfig') requireAddress(value, `${label}.${field}[${index}]`, true);
      else if (!ethers.isHexString(value, 32)) throw new Error(`${label}.${field}[${index}] must be bytes32.`);
    });
  }
}

function requireReceipt(receipt) {
  requireObject(receipt, 'Deployment receipt');
  if (!['deployed_paused', 'awaiting_readiness_review'].includes(receipt.status)) {
    throw new Error('Deployment receipt status must be deployed_paused or awaiting_readiness_review. Reconcile an incomplete or failed deployment journal before running readiness; preserve the original journal.');
  }
  if (!Number.isSafeInteger(receipt.chainId) || receipt.chainId <= 0 || typeof receipt.network !== 'string') throw new Error('Deployment receipt must identify its network and numeric chainId.');
  requireAddress(receipt.finalOwner, 'Deployment receipt finalOwner');
  for (const field of ['constructorArgs', 'contracts', 'libraries', 'verification']) requireObject(receipt[field], `Deployment receipt ${field}`);
  const args = receipt.constructorArgs;
  requireAddress(args.usdcTokenAddress, 'Deployment receipt USDC');
  if (typeof args.baseIpfsUrl !== 'string') throw new Error('Deployment receipt baseIpfsUrl must be a string.');
  requireIdentityConfig(args, 'Deployment receipt constructorArgs');
  if (!Array.isArray(args.settlementWallets) || args.settlementWallets.length !== 2) throw new Error('Deployment receipt settlementWallets must contain exactly two addresses.');
  args.settlementWallets.forEach((address, index) => requireAddress(address, `Deployment receipt settlementWallets[${index}]`));
  for (const name of [...LIBRARIES, 'AGIJobManager']) {
    const record = receipt.contracts[name];
    requireObject(record, `Deployment receipt ${name}`);
    requireAddress(record.address, `Deployment receipt ${name} address`);
    if (!ethers.isHexString(record.runtimeCodeHash, 32) || !ethers.isHexString(record.txHash, 32) || !Number.isSafeInteger(record.blockNumber) || record.blockNumber < 0) {
      throw new Error(`Deployment receipt ${name} must include its runtime hash, transaction hash and mined block number.`);
    }
    if (name !== 'AGIJobManager') requireAddress(receipt.libraries[FQNS[name]], `Deployment receipt linked ${name}`);
    requireObject(receipt.verification[name], `Deployment receipt ${name} verification`);
  }
  requireVerified(receipt.verification, [...LIBRARIES, 'AGIJobManager']);
  const payload = stableObject({ constructorArgs: args, libraries: receipt.libraries, finalOwner: receipt.finalOwner });
  const expectedHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)));
  if (!ethers.isHexString(receipt.configHash, 32) || receipt.configHash.toLowerCase() !== expectedHash) {
    throw new Error('Deployment receipt configHash does not match its constructor, libraries and final owner. Use the intact reviewed receipt; use READINESS_CONFIG for reviewed identity changes.');
  }
}

function loadIdentityConfig(receipt) {
  const expected = Object.fromEntries(Object.keys(IDENTITY_FIELDS).map(field => [field, receipt.constructorArgs[field]]));
  if (!process.env.READINESS_CONFIG) return { expected, override: null };
  const configPath = path.resolve(process.cwd(), process.env.READINESS_CONFIG);
  const contents = fs.readFileSync(configPath, 'utf8');
  const replacement = JSON.parse(contents);
  requireObject(replacement, 'READINESS_CONFIG');
  const fields = Object.keys(replacement);
  if (!fields.length || fields.some(field => !Object.hasOwn(IDENTITY_FIELDS, field))) {
    throw new Error('READINESS_CONFIG permits only ensConfig, rootNodes and merkleRoots; provide at least one explicitly reviewed replacement.');
  }
  Object.assign(expected, replacement);
  requireIdentityConfig(expected, 'READINESS_CONFIG');
  return { expected, override: { path: configPath, sha256: createHash('sha256').update(contents).digest('hex'), fields } };
}

async function main() {
  const runtime = await getRuntime();
  ethers = runtime.ethers;
  const { network, artifacts } = runtime;
  if (!process.env.DEPLOYMENT_RECEIPT) throw new Error('Set DEPLOYMENT_RECEIPT to the reviewed deployment receipt JSON.');
  const receiptPath = path.resolve(process.cwd(), process.env.DEPLOYMENT_RECEIPT);
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  requireReceipt(receipt);
  const reviewedConfig = loadIdentityConfig(receipt);
  if (!process.env.READINESS_NFT_CONFIG) throw new Error('Set READINESS_NFT_CONFIG to a reviewed JSON file containing agentNftRequired and the complete agiTypes registry.');
  const nftConfigPath = path.resolve(process.cwd(), process.env.READINESS_NFT_CONFIG);
  const nftConfigText = fs.readFileSync(nftConfigPath, 'utf8');
  const expectedNftPolicy = normalizeNftPolicy(JSON.parse(nftConfigText));
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  requireDeploymentNetwork(network.name, chainId);
  if (receipt.chainId !== chainId || receipt.network !== network.name) throw new Error('Receipt network or chain does not match this provider.');
  const { buildInfo } = await qualifiedBuild();
  const block = await ethers.provider.getBlock('latest');
  if (!block || !Number.isSafeInteger(block.number) || !ethers.isHexString(block.hash, 32)) throw new Error('Unable to resolve the readiness block and hash.');
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
    if (runtimeCodeHashes[name] !== deployment.runtimeCodeHash.toLowerCase()) throw new Error(`${name} bytecode hash differs from the deployment receipt.`);
  }
  const token = new ethers.Contract(tokenAddress, USDC_ABI, ethers.provider);
  const [owner, pendingOwner, paused, settlementPaused, wallet30, wallet10, balance, ...reserves] = await Promise.all([
    manager.owner(calls), manager.pendingOwner(calls), manager.paused(calls), manager.settlementPaused(calls),
    manager.wallet30(calls), manager.wallet10(calls), token.balanceOf(managerAddress, calls),
    manager.lockedEscrow(calls), manager.lockedAgentBonds(calls), manager.lockedValidatorBonds(calls), manager.lockedDisputeBonds(calls), manager.lockedClaims(calls),
  ]);
  const accounting = requireReadinessState({ owner, pendingOwner, paused, settlementPaused, wallets: [wallet30, wallet10],
    expectedWallets: receipt.constructorArgs.settlementWallets, finalOwner: receipt.finalOwner, balance, reserves });
  const observedConfig = {
    ensConfig: await Promise.all([manager.ens(calls), manager.nameWrapper(calls)]),
    rootNodes: await Promise.all([manager.clubRootNode(calls), manager.agentRootNode(calls), manager.alphaClubRootNode(calls), manager.alphaAgentRootNode(calls)]),
    merkleRoots: await Promise.all([manager.validatorMerkleRoot(calls), manager.agentMerkleRoot(calls)]),
  };
  for (const field of Object.keys(IDENTITY_FIELDS)) {
    observedConfig[field].forEach((value, index) => {
      if (value.toLowerCase() !== reviewedConfig.expected[field][index].toLowerCase()) {
        throw new Error(`On-chain ${field}[${index}] differs from the reviewed configuration. Restore the intended configuration or supply an explicitly reviewed READINESS_CONFIG JSON; do not edit the original deployment receipt.`);
      }
    });
  }
  const observedNftPolicy = await checkNftPolicy(manager, expectedNftPolicy, calls);
  const nftCodeHashes = {};
  for (const entry of observedNftPolicy.agiTypes) {
    if (BigInt(entry.payoutPercentage) > 0n) {
      const code = await requireCode(ethers.provider, entry.nftAddress, 'Enabled NFT collection', block.number);
      nftCodeHashes[entry.nftAddress] = ethers.keccak256(code);
    }
  }
  const tokenState = await requireOperationalUSDC({ chainId, tokenAddress, token, recipients: [managerAddress, owner, wallet30, wallet10], blockTag: block.number });
  const confirmedBlock = await ethers.provider.getBlock(block.number);
  if (!confirmedBlock || confirmedBlock.number !== block.number || confirmedBlock.hash?.toLowerCase() !== block.hash.toLowerCase()) {
    throw new Error('Readiness block changed or disappeared during verification. No report was written; rerun against a consistent chain state.');
  }
  const report = {
    checksPassed: true, scope: 'read-only pre-activation technical checks; owner operational review and independent security review remain separate',
    chainId, network: network.name, manager: managerAddress, owner, pendingOwner, intakePaused: paused,
    settlementWallets: [wallet30, wallet10], blockNumber: block.number, blockHash: block.hash,
    identityConfig: { expected: reviewedConfig.expected, observed: observedConfig, reviewedOverride: reviewedConfig.override },
    membership: describeMembershipConfig(observedConfig),
    nftPolicy: { expected: expectedNftPolicy, observed: observedNftPolicy,
      reviewedConfig: { path: nftConfigPath, sha256: createHash('sha256').update(nftConfigText).digest('hex') },
      runtimeCodeHashes: nftCodeHashes,
      scope: 'Default and complete collection registry matched at this block. Per-job requirements are fixed at posting. Participant NFT balances, collection upgrade authority and future availability require separate operational review.' },
    configurationScope: 'ENS registry, name wrapper, root nodes, Merkle roots and NFT policy checked. Private baseIpfsUrl metadata and other mutable operational policy settings are not validated by this check.',
    explorerVerification: { source: 'deployment receipt; no fresh explorer query', recorded: receipt.verification },
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
