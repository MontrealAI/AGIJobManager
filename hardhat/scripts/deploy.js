const fs = require('fs');
const path = require('path');
const { ethers, network, run } = require('hardhat');

const MAINNET_CONFIRMATION_VALUE = 'I_UNDERSTAND_MAINNET_DEPLOYMENT';
const VERIFY_DELAY_MS = 3500;
const VERIFY_RETRIES = 3;

const FQNS = {
  AGIJobManager: 'contracts/AGIJobManager.sol:AGIJobManager',
  UriUtils: 'contracts/utils/UriUtils.sol:UriUtils',
  TransferUtils: 'contracts/utils/TransferUtils.sol:TransferUtils',
  BondMath: 'contracts/utils/BondMath.sol:BondMath',
  ReputationMath: 'contracts/utils/ReputationMath.sol:ReputationMath',
  ENSOwnership: 'contracts/utils/ENSOwnership.sol:ENSOwnership',
};

const LIBRARIES = ['UriUtils', 'TransferUtils', 'BondMath', 'ReputationMath', 'ENSOwnership'];

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableObject(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getExplorerBase(chainId) {
  if (chainId === 1) return 'https://etherscan.io/address/';
  if (chainId === 11155111) return 'https://sepolia.etherscan.io/address/';
  return null;
}

function validateAddress(label, value, { allowZero = false } = {}) {
  if (!ethers.isAddress(value)) throw new Error(`${label} must be a valid address: ${String(value)}`);
  if (!allowZero && value.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
    throw new Error(`${label} must be non-zero: ${String(value)}`);
  }
}

function validateBytes32(label, value) {
  if (!ethers.isHexString(value, 32)) throw new Error(`${label} must be bytes32: ${String(value)}`);
}

function parseOptionalOverrides() {
  const env = process.env;
  const overrides = {};

  if (env.AGI_TOKEN_ADDRESS) overrides.agiTokenAddress = env.AGI_TOKEN_ADDRESS;
  if (env.BASE_IPFS_URL) overrides.baseIpfsUrl = env.BASE_IPFS_URL;
  if (env.ENS_REGISTRY) overrides.ensRegistry = env.ENS_REGISTRY;
  if (env.NAME_WRAPPER) overrides.nameWrapper = env.NAME_WRAPPER;
  if (env.VALIDATOR_MERKLE_ROOT) overrides.validatorMerkleRoot = env.VALIDATOR_MERKLE_ROOT;
  if (env.AGENT_MERKLE_ROOT) overrides.agentMerkleRoot = env.AGENT_MERKLE_ROOT;

  return overrides;
}

function loadDeployConfig() {
  const customPath = process.env.DEPLOY_CONFIG;
  const configPath = customPath
    ? path.resolve(process.cwd(), customPath)
    : path.resolve(__dirname, '..', 'deploy.config.example.js');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Deployment config file not found: ${configPath}`);
  }

  // eslint-disable-next-line global-require, import/no-dynamic-require
  const config = require(configPath);
  return { config, configPath };
}

function resolveConstructor(networkName, profile, overrides) {
  if (!profile || typeof profile !== 'object') {
    throw new Error(`Missing deployment profile for network "${networkName}".`);
  }

  const constructorArgs = {
    agiTokenAddress: overrides.agiTokenAddress || profile.agiTokenAddress,
    baseIpfsUrl: overrides.baseIpfsUrl || profile.baseIpfsUrl,
    ensConfig: [
      overrides.ensRegistry || profile.ensConfig?.ensRegistry,
      overrides.nameWrapper || profile.ensConfig?.nameWrapper,
    ],
    rootNodes: [
      profile.rootNodes?.clubRootNode,
      profile.rootNodes?.agentRootNode,
      profile.rootNodes?.alphaClubRootNode,
      profile.rootNodes?.alphaAgentRootNode,
    ],
    merkleRoots: [
      overrides.validatorMerkleRoot || profile.merkleRoots?.validatorMerkleRoot,
      overrides.agentMerkleRoot || profile.merkleRoots?.agentMerkleRoot,
    ],
  };

  const finalOwner = process.env.FINAL_OWNER || profile.finalOwner || '';

  validateAddress('agiTokenAddress', constructorArgs.agiTokenAddress);
  if (typeof constructorArgs.baseIpfsUrl !== 'string' || constructorArgs.baseIpfsUrl.trim() === '') {
    throw new Error('baseIpfsUrl must be a non-empty string.');
  }
  validateAddress('ensConfig[0]', constructorArgs.ensConfig[0]);
  validateAddress('ensConfig[1]', constructorArgs.ensConfig[1], { allowZero: true });
  constructorArgs.rootNodes.forEach((v, i) => validateBytes32(`rootNodes[${i}]`, v));
  constructorArgs.merkleRoots.forEach((v, i) => validateBytes32(`merkleRoots[${i}]`, v));

  if (finalOwner) validateAddress('finalOwner', finalOwner);

  return { constructorArgs, finalOwner };
}

async function deployContract(name, args = [], options = {}) {
  const factory = await ethers.getContractFactory(name, options);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const tx = contract.deploymentTransaction();
  const receipt = await tx.wait();
  return {
    name,
    address: await contract.getAddress(),
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    contract,
  };
}

async function verifyWithRetry(params) {
  const { name, record } = params;
  const verificationEntry = {
    contract: name,
    status: 'pending',
    attempts: 0,
    error: null,
  };

  for (let attempt = 1; attempt <= VERIFY_RETRIES; attempt += 1) {
    verificationEntry.attempts = attempt;
    try {
      await run('verify:verify', {
        address: record.address,
        constructorArguments: params.constructorArguments || [],
        libraries: params.libraries,
        contract: FQNS[name],
      });
      verificationEntry.status = 'verified';
      verificationEntry.error = null;
      return verificationEntry;
    } catch (error) {
      const message = String(error?.message || error);
      if (message.toLowerCase().includes('already verified')) {
        verificationEntry.status = 'already_verified';
        verificationEntry.error = null;
        verificationEntry.note = message;
        return verificationEntry;
      }
      verificationEntry.error = message;
      if (attempt < VERIFY_RETRIES) {
        await sleep(VERIFY_DELAY_MS);
      }
    }
  }

  verificationEntry.status = 'failed';
  return verificationEntry;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const providerNetwork = await ethers.provider.getNetwork();
  const chainId = Number(providerNetwork.chainId);

  const { config, configPath } = loadDeployConfig();
  const overrides = parseOptionalOverrides();
  const profile = config[network.name];
  const { constructorArgs, finalOwner } = resolveConstructor(network.name, profile, overrides);

  if (chainId === 1) {
    if (process.env.DEPLOY_CONFIRM_MAINNET !== MAINNET_CONFIRMATION_VALUE) {
      throw new Error(`Mainnet deployment blocked. Set DEPLOY_CONFIRM_MAINNET=${MAINNET_CONFIRMATION_VALUE}.`);
    }
    if (!process.env.FINAL_OWNER) {
      throw new Error('FINAL_OWNER is required on mainnet.');
    }
  }

  const resolvedFinalOwner = finalOwner || deployer.address;
  const dryRun = process.env.DRY_RUN === '1';
  const explorerBase = getExplorerBase(chainId);

  const plan = {
    network: network.name,
    chainId,
    configPath,
    deployer: deployer.address,
    finalOwner: resolvedFinalOwner,
    constructorArgs,
    overrides,
    dryRun,
  };

  console.log('=== DEPLOYMENT PLAN ===');
  console.log(JSON.stringify(plan, null, 2));

  if (dryRun) {
    console.log('DRY_RUN=1 set; no transactions were broadcast.');
    return;
  }

  const deployments = {};
  const verificationResults = {};

  for (const libName of LIBRARIES) {
    const result = await deployContract(libName);
    deployments[libName] = result;
    console.log(`[deployed] ${libName} ${result.address} tx=${result.txHash}`);
  }

  const linkedLibraries = {
    [FQNS.UriUtils]: deployments.UriUtils.address,
    [FQNS.TransferUtils]: deployments.TransferUtils.address,
    [FQNS.BondMath]: deployments.BondMath.address,
    [FQNS.ReputationMath]: deployments.ReputationMath.address,
    [FQNS.ENSOwnership]: deployments.ENSOwnership.address,
  };

  const managerArgs = [
    constructorArgs.agiTokenAddress,
    constructorArgs.baseIpfsUrl,
    constructorArgs.ensConfig,
    constructorArgs.rootNodes,
    constructorArgs.merkleRoots,
  ];

  const managerDeployment = await deployContract('AGIJobManager', managerArgs, { libraries: linkedLibraries });
  deployments.AGIJobManager = managerDeployment;
  console.log(`[deployed] AGIJobManager ${managerDeployment.address} tx=${managerDeployment.txHash}`);

  const manager = await ethers.getContractAt('AGIJobManager', managerDeployment.address, deployer);
  let ownershipTransfer = null;
  if (deployer.address.toLowerCase() !== resolvedFinalOwner.toLowerCase()) {
    const tx = await manager.transferOwnership(resolvedFinalOwner);
    const receipt = await tx.wait();
    ownershipTransfer = { txHash: tx.hash, blockNumber: receipt.blockNumber, executed: true };
    console.log(`[owner] transferOwnership(${resolvedFinalOwner}) tx=${tx.hash}`);
  } else {
    ownershipTransfer = { txHash: null, blockNumber: null, executed: false, reason: 'deployer_is_final_owner' };
    console.log('[owner] transferOwnership skipped (deployer is final owner).');
  }

  for (const libName of LIBRARIES) {
    await sleep(VERIFY_DELAY_MS);
    verificationResults[libName] = await verifyWithRetry({ name: libName, record: deployments[libName] });
  }
  await sleep(VERIFY_DELAY_MS);
  verificationResults.AGIJobManager = await verifyWithRetry({
    name: 'AGIJobManager',
    record: managerDeployment,
    constructorArguments: managerArgs,
    libraries: linkedLibraries,
  });

  const stablePayload = stableObject({
    constructorArgs,
    libraries: linkedLibraries,
    finalOwner: resolvedFinalOwner,
  });
  const configHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(stablePayload)));

  const record = {
    chainId,
    network: network.name,
    deployer: deployer.address,
    finalOwner: resolvedFinalOwner,
    contracts: Object.fromEntries(
      Object.entries(deployments).map(([name, d]) => [name, { address: d.address, txHash: d.txHash, blockNumber: d.blockNumber }])
    ),
    constructorArgs,
    libraries: linkedLibraries,
    ownershipTransfer,
    verification: verificationResults,
    timestamp: new Date().toISOString(),
    configHash,
  };

  const outDir = path.join(__dirname, '..', 'deployments', network.name);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `deployment.${chainId}.${managerDeployment.blockNumber}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

  console.log('\n=== DEPLOYMENT RESULT ===');
  Object.entries(record.contracts).forEach(([name, data]) => {
    const explorer = explorerBase ? ` ${explorerBase}${data.address}` : '';
    console.log(`${name}: ${data.address}${explorer}`);
  });
  console.log(`receipt: ${outFile}`);
  console.log(`configHash: ${configHash}`);
  console.log('\nManual verify fallback commands:');
  LIBRARIES.forEach((libName) => {
    console.log(`npx hardhat verify --network ${network.name} ${record.contracts[libName].address}`);
  });
  console.log(`AGIJobManager args JSON: ${JSON.stringify(managerArgs)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
