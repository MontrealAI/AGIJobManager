const fs = require('fs');
const path = require('path');
const { ethers, network, run } = require('hardhat');

const MAINNET_CONFIRMATION_VALUE = 'I_UNDERSTAND_MAINNET_DEPLOYMENT';
const DEFAULT_VERIFY_DELAY_MS = 3500;
const DEFAULT_VERIFY_RETRIES = 3;
const DEFAULT_CONFIRMATIONS = 3;

const COMPILER_SETTINGS = {
  version: '0.8.23',
  optimizer: { enabled: true, runs: 40 },
  evmVersion: 'shanghai',
  viaIR: false,
  metadata: { bytecodeHash: 'none' },
  debug: { revertStrings: 'strip' },
};

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

function getExplorerAddressBase(chainId) {
  if (chainId === 1) return 'https://etherscan.io/address/';
  if (chainId === 11155111) return 'https://sepolia.etherscan.io/address/';
  return null;
}

function getExplorerBase(chainId) {
  if (chainId === 1) return 'https://etherscan.io';
  if (chainId === 11155111) return 'https://sepolia.etherscan.io';
  return null;
}

function parsePositiveInt(value, label, fallback, min = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`${label} must be an integer >= ${min}. Received: ${value}`);
  }
  return parsed;
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

function loadDeployConfig() {
  const configPath = process.env.DEPLOY_CONFIG
    ? path.resolve(process.cwd(), process.env.DEPLOY_CONFIG)
    : path.resolve(__dirname, '..', 'deploy.config.example.js');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Deployment config file not found: ${configPath}`);
  }

  delete require.cache[configPath];
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const config = require(configPath);
  return { config, configPath };
}

function resolveConstructor(networkName, profile) {
  if (!profile || typeof profile !== 'object') {
    throw new Error(`Missing deployment profile for network "${networkName}".`);
  }

  const constructorArgs = {
    agiTokenAddress: profile.agiTokenAddress,
    baseIpfsUrl: profile.baseIpfsUrl,
    ensConfig: profile.ensConfig,
    rootNodes: profile.rootNodes,
    merkleRoots: profile.merkleRoots,
  };

  validateAddress('agiTokenAddress', constructorArgs.agiTokenAddress);
  if (typeof constructorArgs.baseIpfsUrl !== 'string' || constructorArgs.baseIpfsUrl.trim() === '') {
    throw new Error('baseIpfsUrl must be a non-empty string.');
  }
  if (!Array.isArray(constructorArgs.ensConfig) || constructorArgs.ensConfig.length !== 2) {
    throw new Error('ensConfig must be an array of exactly 2 addresses.');
  }
  if (!Array.isArray(constructorArgs.rootNodes) || constructorArgs.rootNodes.length !== 4) {
    throw new Error('rootNodes must be an array of exactly 4 bytes32 values.');
  }
  if (!Array.isArray(constructorArgs.merkleRoots) || constructorArgs.merkleRoots.length !== 2) {
    throw new Error('merkleRoots must be an array of exactly 2 bytes32 values.');
  }

  constructorArgs.ensConfig.forEach((value, index) => validateAddress(`ensConfig[${index}]`, value, { allowZero: index === 1 }));
  constructorArgs.rootNodes.forEach((value, index) => validateBytes32(`rootNodes[${index}]`, value));
  constructorArgs.merkleRoots.forEach((value, index) => validateBytes32(`merkleRoots[${index}]`, value));

  return constructorArgs;
}

function resolveFinalOwner(profile) {
  const finalOwner = process.env.FINAL_OWNER || profile.finalOwner;
  if (!finalOwner) {
    throw new Error('Unable to resolve finalOwner. Set FINAL_OWNER or config.finalOwner.');
  }
  validateAddress('finalOwner', finalOwner);
  return finalOwner;
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
  };
}

async function verifyWithRetry(params, verifyDelayMs) {
  const { name, record } = params;
  const verificationEntry = {
    contract: name,
    status: 'pending',
    attempts: 0,
    error: null,
  };

  for (let attempt = 1; attempt <= DEFAULT_VERIFY_RETRIES; attempt += 1) {
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
      const lowered = message.toLowerCase();
      if (lowered.includes('already verified') || lowered.includes('already been verified')) {
        verificationEntry.status = 'already_verified';
        verificationEntry.error = null;
        return verificationEntry;
      }
      verificationEntry.error = message;
      if (attempt < DEFAULT_VERIFY_RETRIES) {
        await sleep(verifyDelayMs);
      }
    }
  }

  verificationEntry.status = 'failed';
  return verificationEntry;
}

function getLatestBuildInfoPath() {
  const buildInfoDir = path.resolve(__dirname, '..', 'artifacts', 'build-info');
  if (!fs.existsSync(buildInfoDir)) {
    throw new Error(`Build info directory not found: ${buildInfoDir}. Run \`npx hardhat compile\` first.`);
  }
  const candidates = fs
    .readdirSync(buildInfoDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => {
      const fullPath = path.join(buildInfoDir, fileName);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (!candidates.length) {
    throw new Error(`No build-info JSON files found in ${buildInfoDir}.`);
  }
  return candidates[0].fullPath;
}

function copySolcInput(outDir) {
  const latestBuildInfoPath = getLatestBuildInfoPath();
  const buildInfo = JSON.parse(fs.readFileSync(latestBuildInfoPath, 'utf8'));
  const solcInputPath = path.join(outDir, 'solc-input.json');
  fs.writeFileSync(solcInputPath, `${JSON.stringify(buildInfo.input, null, 2)}\n`, 'utf8');
  return solcInputPath;
}

async function main() {
  const confirmations = parsePositiveInt(process.env.CONFIRMATIONS, 'CONFIRMATIONS', DEFAULT_CONFIRMATIONS, 1);
  const verifyDelayMs = parsePositiveInt(process.env.VERIFY_DELAY_MS, 'VERIFY_DELAY_MS', DEFAULT_VERIFY_DELAY_MS, 0);
  const [deployer] = await ethers.getSigners();
  const providerNetwork = await ethers.provider.getNetwork();
  const chainId = Number(providerNetwork.chainId);
  const explorerBase = getExplorerBase(chainId);
  const explorerAddressBase = getExplorerAddressBase(chainId);

  const { config, configPath } = loadDeployConfig();
  const profile = config[network.name];
  const constructorArgs = resolveConstructor(network.name, profile);
  const resolvedFinalOwner = resolveFinalOwner(profile);
  const dryRun = process.env.DRY_RUN === '1';

  if (chainId === 1) {
    if (process.env.DEPLOY_CONFIRM_MAINNET !== MAINNET_CONFIRMATION_VALUE) {
      throw new Error(`Mainnet deployment blocked. Set DEPLOY_CONFIRM_MAINNET=${MAINNET_CONFIRMATION_VALUE}.`);
    }
    if (resolvedFinalOwner.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
      throw new Error('Mainnet deployment requires a non-zero finalOwner.');
    }
  }

  const plan = {
    network: network.name,
    chainId,
    deployer: deployer.address,
    finalOwner: resolvedFinalOwner,
    configPath,
    confirmations,
    verifyDelayMs,
    constructorArgs,
    libraries: LIBRARIES,
    compiler: COMPILER_SETTINGS,
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

  for (const libName of LIBRARIES) {
    await sleep(verifyDelayMs);
    verificationResults[libName] = await verifyWithRetry({ name: libName, record: deployments[libName] }, verifyDelayMs);
  }
  await sleep(verifyDelayMs);
  verificationResults.AGIJobManager = await verifyWithRetry(
    {
      name: 'AGIJobManager',
      record: managerDeployment,
      constructorArguments: managerArgs,
      libraries: linkedLibraries,
    },
    verifyDelayMs
  );

  const manager = await ethers.getContractAt('AGIJobManager', managerDeployment.address, deployer);
  let ownershipTransfer = {
    executed: false,
    txHash: null,
    blockNumber: null,
    reason: 'deployer_is_final_owner',
  };
  if (deployer.address.toLowerCase() !== resolvedFinalOwner.toLowerCase()) {
    const tx = await manager.transferOwnership(resolvedFinalOwner);
    const transferReceipt = await tx.wait(confirmations);
    ownershipTransfer = {
      executed: true,
      txHash: tx.hash,
      blockNumber: transferReceipt.blockNumber,
      reason: null,
    };
    console.log(`[owner] transferOwnership(${resolvedFinalOwner}) tx=${tx.hash}`);
  } else {
    console.log('[owner] transferOwnership skipped (deployer is final owner).');
  }

  const stablePayload = stableObject({ constructorArgs, libraries: linkedLibraries, finalOwner: resolvedFinalOwner });
  const configHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(stablePayload)));

  const outDir = path.join(__dirname, '..', 'deployments', network.name);
  fs.mkdirSync(outDir, { recursive: true });

  const record = {
    chainId,
    network: network.name,
    explorerBaseUrl: explorerBase,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    finalOwner: resolvedFinalOwner,
    contracts: Object.fromEntries(
      Object.entries(deployments).map(([name, deployment]) => [name, {
        address: deployment.address,
        txHash: deployment.txHash,
        blockNumber: deployment.blockNumber,
      }])
    ),
    constructorArgs,
    libraries: linkedLibraries,
    ownershipTransfer,
    verification: verificationResults,
    configHash,
  };

  const receiptPath = path.join(outDir, `deployment.${chainId}.${managerDeployment.blockNumber}.json`);
  fs.writeFileSync(receiptPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

  const solcInputPath = copySolcInput(outDir);
  const verifyTargetsPath = path.join(outDir, 'verify-targets.json');
  const verifyTargets = {
    network: network.name,
    chainId,
    targets: Object.entries(record.contracts).map(([name, contract]) => ({
      name,
      fqn: FQNS[name],
      address: contract.address,
    })),
  };
  fs.writeFileSync(verifyTargetsPath, `${JSON.stringify(verifyTargets, null, 2)}\n`, 'utf8');

  console.log('\n=== Deployment Summary ===');
  Object.entries(record.contracts).forEach(([name, contract]) => {
    const explorerLink = explorerAddressBase ? ` ${explorerAddressBase}${contract.address}` : '';
    const verifyStatus = verificationResults[name]?.status || 'not_attempted';
    console.log(`${name}: ${contract.address}${explorerLink} [verify=${verifyStatus}]`);
  });
  console.log(`receipt: ${receiptPath}`);
  console.log(`solc-input: ${solcInputPath}`);
  console.log(`verify-targets: ${verifyTargetsPath}`);
  console.log('Post-deploy on-chain actions performed: deployment + optional transferOwnership(finalOwner) only.');
  console.log('All other operational configuration is manual via Etherscan runbook.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
