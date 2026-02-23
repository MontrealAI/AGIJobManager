const fs = require('fs');
const path = require('path');
const { ethers, network, run } = require('hardhat');

const MAINNET_CONFIRMATION_VALUE = 'I_UNDERSTAND_MAINNET_DEPLOYMENT';
const DEFAULT_VERIFY_DELAY_MS = 3500;
const DEFAULT_CONFIRMATIONS = 3;
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
  if (!ethers.isAddress(value)) throw new Error(`${label} must be a valid address (0x + 40 hex): ${String(value)}`);
  if (!allowZero && value.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
    throw new Error(`${label} must be non-zero: ${String(value)}`);
  }
}

function validateBytes32(label, value) {
  if (!ethers.isHexString(value, 32)) throw new Error(`${label} must be bytes32 (0x + 64 hex): ${String(value)}`);
}

function parseOptionalOverrides() {
  const env = process.env;
  const overrides = {};

  if (env.AGI_TOKEN_ADDRESS) overrides.agiTokenAddress = env.AGI_TOKEN_ADDRESS;
  if (env.BASE_IPFS_URL) overrides.baseIpfsUrl = env.BASE_IPFS_URL;
  if (env.ENS_REGISTRY) overrides.ensRegistry = env.ENS_REGISTRY;
  if (env.NAME_WRAPPER) overrides.nameWrapper = env.NAME_WRAPPER;
  if (env.ROOT_NODE_0) overrides.rootNode0 = env.ROOT_NODE_0;
  if (env.ROOT_NODE_1) overrides.rootNode1 = env.ROOT_NODE_1;
  if (env.ROOT_NODE_2) overrides.rootNode2 = env.ROOT_NODE_2;
  if (env.ROOT_NODE_3) overrides.rootNode3 = env.ROOT_NODE_3;
  if (env.VALIDATOR_MERKLE_ROOT) overrides.validatorMerkleRoot = env.VALIDATOR_MERKLE_ROOT;
  if (env.AGENT_MERKLE_ROOT) overrides.agentMerkleRoot = env.AGENT_MERKLE_ROOT;

  return overrides;
}

function loadDeployConfig() {
  const configPath = path.resolve(
    __dirname,
    '..',
    process.env.DEPLOY_CONFIG || 'deploy.config.example.js'
  );

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
      overrides.ensRegistry || profile.ensConfig?.[0],
      overrides.nameWrapper || profile.ensConfig?.[1],
    ],
    rootNodes: [
      overrides.rootNode0 || profile.rootNodes?.[0],
      overrides.rootNode1 || profile.rootNodes?.[1],
      overrides.rootNode2 || profile.rootNodes?.[2],
      overrides.rootNode3 || profile.rootNodes?.[3],
    ],
    merkleRoots: [
      overrides.validatorMerkleRoot || profile.merkleRoots?.[0],
      overrides.agentMerkleRoot || profile.merkleRoots?.[1],
    ],
  };

  const finalOwner = process.env.FINAL_OWNER || '';

  validateAddress('agiTokenAddress', constructorArgs.agiTokenAddress);
  if (typeof constructorArgs.baseIpfsUrl !== 'string' || constructorArgs.baseIpfsUrl.trim() === '') {
    throw new Error('baseIpfsUrl must be a non-empty string.');
  }
  validateAddress('ensConfig[0]', constructorArgs.ensConfig[0]);
  validateAddress('ensConfig[1]', constructorArgs.ensConfig[1]);
  constructorArgs.rootNodes.forEach((v, i) => validateBytes32(`rootNodes[${i}]`, v));
  constructorArgs.merkleRoots.forEach((v, i) => validateBytes32(`merkleRoots[${i}]`, v));

  if (finalOwner) validateAddress('finalOwner', finalOwner);

  return { constructorArgs, finalOwner };
}

function getWaitConfirmations() {
  const raw = process.env.CONFIRMATIONS;
  if (!raw) return DEFAULT_CONFIRMATIONS;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`CONFIRMATIONS must be an integer >= 1. Received: ${raw}`);
  }
  return parsed;
}

function getVerifyDelayMs() {
  const raw = process.env.VERIFY_DELAY_MS;
  if (!raw) return DEFAULT_VERIFY_DELAY_MS;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`VERIFY_DELAY_MS must be an integer >= 0. Received: ${raw}`);
  }
  return parsed;
}

async function deployContract(name, args = [], options = {}, confirmations = DEFAULT_CONFIRMATIONS) {
  const factory = await ethers.getContractFactory(name, options);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const tx = contract.deploymentTransaction();
  const receipt = await tx.wait(confirmations);
  return {
    name,
    address: await contract.getAddress(),
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    contract,
  };
}

async function verifyWithRetry(params, verifyDelayMs) {
  const { name, record } = params;
  const verificationEntry = {
    contract: name,
    fqn: FQNS[name],
    address: record.address,
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
      return verificationEntry;
    } catch (error) {
      const message = String(error?.message || error);
      if (message.toLowerCase().includes('already verified')) {
        verificationEntry.status = 'already_verified';
        return verificationEntry;
      }
      verificationEntry.error = message;
      if (attempt < VERIFY_RETRIES) {
        await sleep(verifyDelayMs);
      }
    }
  }

  verificationEntry.status = 'failed';
  return verificationEntry;
}

function exportSolcInput(outDir) {
  const buildInfoDir = path.join(__dirname, '..', 'artifacts', 'build-info');
  if (!fs.existsSync(buildInfoDir)) {
    throw new Error(`Missing Hardhat build info directory: ${buildInfoDir}. Run hardhat compile first.`);
  }

  const buildFiles = fs.readdirSync(buildInfoDir).filter((file) => file.endsWith('.json')).sort();
  if (buildFiles.length === 0) {
    throw new Error('No Hardhat build-info JSON files found. Run hardhat compile first.');
  }

  const latestBuildFile = buildFiles[buildFiles.length - 1];
  const buildInfoPath = path.join(buildInfoDir, latestBuildFile);
  const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
  const outPath = path.join(outDir, 'solc-input.json');
  fs.writeFileSync(outPath, `${JSON.stringify(buildInfo.input, null, 2)}\n`, 'utf8');
  return { outPath, buildInfoPath };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const providerNetwork = await ethers.provider.getNetwork();
  const chainId = Number(providerNetwork.chainId);

  const { config, configPath } = loadDeployConfig();
  const overrides = parseOptionalOverrides();
  const profile = config[network.name];
  const { constructorArgs, finalOwner } = resolveConstructor(network.name, profile, overrides);

  const dryRun = process.env.DRY_RUN === '1';
  const confirmations = getWaitConfirmations();
  const verifyDelayMs = getVerifyDelayMs();

  if (chainId === 1) {
    if (process.env.DEPLOY_CONFIRM_MAINNET !== MAINNET_CONFIRMATION_VALUE) {
      throw new Error(`Mainnet deployment blocked. Set DEPLOY_CONFIRM_MAINNET=${MAINNET_CONFIRMATION_VALUE}.`);
    }
    if (!finalOwner) {
      throw new Error('FINAL_OWNER is required on mainnet and must be a valid address.');
    }
  }

  const resolvedFinalOwner = finalOwner || deployer.address;
  const explorerBase = getExplorerBase(chainId);

  const plan = {
    network: network.name,
    chainId,
    configPath,
    confirmations,
    verifyDelayMs,
    deployer: deployer.address,
    finalOwner: resolvedFinalOwner,
    libraryDeploymentOrder: LIBRARIES,
    constructorArgs,
    overrides,
    dryRun,
  };

  console.log('=== Deployment Plan ===');
  console.log(JSON.stringify(plan, null, 2));

  if (dryRun) {
    console.log('DRY_RUN=1 set; no transactions were broadcast.');
    return;
  }

  const deployments = {};
  const verificationResults = {};

  for (const libName of LIBRARIES) {
    const result = await deployContract(libName, [], {}, confirmations);
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

  const managerDeployment = await deployContract('AGIJobManager', managerArgs, { libraries: linkedLibraries }, confirmations);
  deployments.AGIJobManager = managerDeployment;
  console.log(`[deployed] AGIJobManager ${managerDeployment.address} tx=${managerDeployment.txHash}`);

  const manager = await ethers.getContractAt('AGIJobManager', managerDeployment.address, deployer);
  let ownershipTransfer;
  if (deployer.address.toLowerCase() !== resolvedFinalOwner.toLowerCase()) {
    const tx = await manager.transferOwnership(resolvedFinalOwner);
    const receipt = await tx.wait(confirmations);
    ownershipTransfer = { txHash: tx.hash, blockNumber: receipt.blockNumber, executed: true };
    console.log(`[owner] transferOwnership(${resolvedFinalOwner}) tx=${tx.hash}`);
  } else {
    ownershipTransfer = { txHash: null, blockNumber: null, executed: false, reason: 'deployer_is_final_owner' };
    console.log('[owner] transferOwnership skipped (deployer is final owner).');
  }

  for (const libName of LIBRARIES) {
    await sleep(verifyDelayMs);
    verificationResults[libName] = await verifyWithRetry({ name: libName, record: deployments[libName] }, verifyDelayMs);
  }
  await sleep(verifyDelayMs);
  verificationResults.AGIJobManager = await verifyWithRetry({
    name: 'AGIJobManager',
    record: managerDeployment,
    constructorArguments: managerArgs,
    libraries: linkedLibraries,
  }, verifyDelayMs);

  const stablePayload = stableObject({
    constructorArgs,
    libraries: linkedLibraries,
    finalOwner: resolvedFinalOwner,
  });
  const configHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(stablePayload)));

  const outDir = path.join(__dirname, '..', 'deployments', network.name);
  fs.mkdirSync(outDir, { recursive: true });

  const solcInputInfo = exportSolcInput(outDir);
  const verifyTargets = {
    network: network.name,
    chainId,
    contracts: Object.fromEntries(
      Object.keys(FQNS).map((name) => [name, { fqn: FQNS[name], address: deployments[name].address }])
    ),
  };
  const verifyTargetsPath = path.join(outDir, 'verify-targets.json');
  fs.writeFileSync(verifyTargetsPath, `${JSON.stringify(verifyTargets, null, 2)}\n`, 'utf8');

  const record = {
    chainId,
    network: network.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    finalOwner: resolvedFinalOwner,
    contracts: Object.fromEntries(
      Object.entries(deployments).map(([name, d]) => [name, { address: d.address, txHash: d.txHash, blockNumber: d.blockNumber }])
    ),
    constructorArgs,
    libraries: linkedLibraries,
    verification: verificationResults,
    ownershipTransfer,
    configHash,
    artifacts: {
      solcInputPath: solcInputInfo.outPath,
      buildInfoPath: solcInputInfo.buildInfoPath,
      verifyTargetsPath,
    },
  };

  const outFile = path.join(outDir, `deployment.${chainId}.${managerDeployment.blockNumber}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

  console.log('\n=== Deployment Summary ===');
  Object.entries(record.contracts).forEach(([name, data]) => {
    const explorer = explorerBase ? ` ${explorerBase}${data.address}` : '';
    const verifyStatus = verificationResults[name]?.status || 'unknown';
    console.log(`${name}: ${data.address}${explorer} [verify=${verifyStatus}]`);
  });
  console.log(`receipt: ${outFile}`);
  console.log(`solc-input.json: ${solcInputInfo.outPath}`);
  console.log(`verify-targets.json: ${verifyTargetsPath}`);
  console.log('Reminder: only deployment + verification + optional transferOwnership were executed.');
  console.log('All other protocol configuration is manual via Etherscan write actions.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
