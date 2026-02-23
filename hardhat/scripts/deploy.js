const fs = require('fs');
const path = require('path');
const { ethers, network, run } = require('hardhat');

const MAINNET_CONFIRMATION_VALUE = 'I_UNDERSTAND_MAINNET_DEPLOYMENT';
const DEFAULT_VERIFY_DELAY_MS = 4000;
const DEFAULT_VERIFY_RETRIES = 3;
const DEFAULT_CONFIRMATIONS = 3;

const FQNS = {
  AGIJobManager: 'contracts/AGIJobManager.sol:AGIJobManager',
  UriUtils: 'contracts/utils/UriUtils.sol:UriUtils',
  TransferUtils: 'contracts/utils/TransferUtils.sol:TransferUtils',
  BondMath: 'contracts/utils/BondMath.sol:BondMath',
  ReputationMath: 'contracts/utils/ReputationMath.sol:ReputationMath',
  ENSOwnership: 'contracts/utils/ENSOwnership.sol:ENSOwnership',
};

const LIBRARIES = ['UriUtils', 'TransferUtils', 'BondMath', 'ReputationMath', 'ENSOwnership'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function validateAddress(label, value, { allowZero = false } = {}) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(String(value || ''))) {
    throw new Error(`${label} must be 0x + 40 hex chars. got=${String(value)}`);
  }
  if (!allowZero && value.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
    throw new Error(`${label} must be non-zero.`);
  }
}

function validateBytes32(label, value) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(String(value || ''))) {
    throw new Error(`${label} must be 0x + 64 hex chars. got=${String(value)}`);
  }
}

function normalizeArray(label, value, expectedLength) {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    throw new Error(`${label} must be an array of length ${expectedLength}.`);
  }
  return value;
}

function getExplorerBase(chainId) {
  if (chainId === 1) return 'https://etherscan.io/address/';
  if (chainId === 11155111) return 'https://sepolia.etherscan.io/address/';
  return '';
}

function loadDeployConfig() {
  const defaultPath = path.join(__dirname, '..', 'deploy.config.example.js');
  const configPath = process.env.DEPLOY_CONFIG
    ? path.resolve(process.cwd(), process.env.DEPLOY_CONFIG)
    : defaultPath;

  if (!fs.existsSync(configPath)) {
    throw new Error(`Deployment config not found: ${configPath}`);
  }

  delete require.cache[require.resolve(configPath)];
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const config = require(configPath);
  return { config, configPath };
}

function parseConfigProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new Error(`Missing deployment profile for network "${network.name}".`);
  }

  const constructorArgs = {
    agiTokenAddress: profile.agiTokenAddress,
    baseIpfsUrl: profile.baseIpfsUrl,
    ensConfig: normalizeArray('ensConfig', profile.ensConfig, 2),
    rootNodes: normalizeArray('rootNodes', profile.rootNodes, 4),
    merkleRoots: normalizeArray('merkleRoots', profile.merkleRoots, 2),
  };

  validateAddress('agiTokenAddress', constructorArgs.agiTokenAddress);
  if (typeof constructorArgs.baseIpfsUrl !== 'string' || constructorArgs.baseIpfsUrl.trim() === '') {
    throw new Error('baseIpfsUrl must be a non-empty string.');
  }
  constructorArgs.ensConfig.forEach((address, i) => validateAddress(`ensConfig[${i}]`, address, { allowZero: i === 1 }));
  constructorArgs.rootNodes.forEach((root, i) => validateBytes32(`rootNodes[${i}]`, root));
  constructorArgs.merkleRoots.forEach((root, i) => validateBytes32(`merkleRoots[${i}]`, root));

  return constructorArgs;
}

async function deployContract(name, args, options, confirmations) {
  const factory = await ethers.getContractFactory(name, options || {});
  const contract = await factory.deploy(...(args || []));
  const tx = contract.deploymentTransaction();
  const receipt = await tx.wait(confirmations);

  return {
    name,
    address: await contract.getAddress(),
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
  };
}

async function verifyWithRetry({ name, address, constructorArguments = [], libraries, retries, delayMs }) {
  const out = { status: 'pending', attempts: 0, error: null };

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    out.attempts = attempt;
    try {
      await run('verify:verify', {
        address,
        constructorArguments,
        contract: FQNS[name],
        libraries,
      });
      out.status = 'verified';
      return out;
    } catch (error) {
      const message = String(error?.message || error);
      if (message.toLowerCase().includes('already verified')) {
        out.status = 'already_verified';
        return out;
      }
      out.error = message;
      if (attempt < retries) await sleep(delayMs);
    }
  }

  out.status = 'failed';
  return out;
}

function findLatestBuildInfoFile() {
  const buildInfoDir = path.join(__dirname, '..', 'artifacts', 'build-info');
  if (!fs.existsSync(buildInfoDir)) return null;
  const files = fs.readdirSync(buildInfoDir).filter((name) => name.endsWith('.json'));
  if (!files.length) return null;

  files.sort((a, b) => {
    const aStat = fs.statSync(path.join(buildInfoDir, a));
    const bStat = fs.statSync(path.join(buildInfoDir, b));
    return bStat.mtimeMs - aStat.mtimeMs;
  });

  return path.join(buildInfoDir, files[0]);
}

function exportManualVerificationArtifacts({ outDir, deployments }) {
  const latestBuildInfoPath = findLatestBuildInfoFile();
  if (latestBuildInfoPath) {
    const buildInfo = JSON.parse(fs.readFileSync(latestBuildInfoPath, 'utf8'));
    if (buildInfo.input) {
      fs.writeFileSync(path.join(outDir, 'solc-input.json'), `${JSON.stringify(buildInfo.input, null, 2)}\n`, 'utf8');
    }
  }

  const verifyTargets = Object.fromEntries(
    Object.entries(deployments).map(([name, value]) => [name, { address: value.address, contract: FQNS[name] }])
  );
  fs.writeFileSync(path.join(outDir, 'verify-targets.json'), `${JSON.stringify(verifyTargets, null, 2)}\n`, 'utf8');
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const providerNetwork = await ethers.provider.getNetwork();
  const chainId = Number(providerNetwork.chainId);
  const confirmations = Number(process.env.CONFIRMATIONS || DEFAULT_CONFIRMATIONS);
  const verifyDelayMs = Number(process.env.VERIFY_DELAY_MS || DEFAULT_VERIFY_DELAY_MS);
  const verifyRetries = DEFAULT_VERIFY_RETRIES;

  const { config, configPath } = loadDeployConfig();
  const constructorArgs = parseConfigProfile(config[network.name]);

  const configuredFinalOwner = config[network.name]?.finalOwner || '';
  const envFinalOwner = process.env.FINAL_OWNER || '';
  const finalOwner = envFinalOwner || configuredFinalOwner || deployer.address;

  if (chainId === 1) {
    if (process.env.DEPLOY_CONFIRM_MAINNET !== MAINNET_CONFIRMATION_VALUE) {
      throw new Error(`Mainnet deployment blocked. Set DEPLOY_CONFIRM_MAINNET=${MAINNET_CONFIRMATION_VALUE}.`);
    }
    if (!envFinalOwner) {
      throw new Error('FINAL_OWNER is required on mainnet.');
    }
  }
  validateAddress('finalOwner', finalOwner);

  const deploymentPlan = {
    network: network.name,
    chainId,
    deployer: deployer.address,
    finalOwner,
    configPath,
    confirmations,
    verifyDelayMs,
    libraries: LIBRARIES,
    constructorArgs,
  };

  console.log('=== Deployment Plan ===');
  console.log(JSON.stringify(deploymentPlan, null, 2));

  if (process.env.DRY_RUN === '1') {
    console.log('DRY_RUN=1 detected. Plan printed; exiting without broadcasting transactions.');
    return;
  }

  const deployments = {};
  const verification = {};

  for (const libName of LIBRARIES) {
    const deployed = await deployContract(libName, [], {}, confirmations);
    deployments[libName] = deployed;
    console.log(`[deploy] ${libName} ${deployed.address} tx=${deployed.txHash}`);
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
  console.log(`[deploy] AGIJobManager ${managerDeployment.address} tx=${managerDeployment.txHash}`);

  let ownershipTransfer = { executed: false, txHash: null, blockNumber: null, reason: 'deployer_is_final_owner' };
  if (finalOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    const manager = await ethers.getContractAt('AGIJobManager', managerDeployment.address, deployer);
    const tx = await manager.transferOwnership(finalOwner);
    const receipt = await tx.wait(confirmations);
    ownershipTransfer = { executed: true, txHash: tx.hash, blockNumber: receipt.blockNumber };
    console.log(`[owner] transferOwnership(${finalOwner}) tx=${tx.hash}`);
  }

  for (const libName of LIBRARIES) {
    await sleep(verifyDelayMs);
    verification[libName] = await verifyWithRetry({
      name: libName,
      address: deployments[libName].address,
      retries: verifyRetries,
      delayMs: verifyDelayMs,
    });
  }

  await sleep(verifyDelayMs);
  verification.AGIJobManager = await verifyWithRetry({
    name: 'AGIJobManager',
    address: deployments.AGIJobManager.address,
    constructorArguments: managerArgs,
    libraries: linkedLibraries,
    retries: verifyRetries,
    delayMs: verifyDelayMs,
  });

  const configHash = ethers.keccak256(
    ethers.toUtf8Bytes(
      JSON.stringify(
        stableObject({ constructorArgs, libraries: linkedLibraries, finalOwner })
      )
    )
  );

  const record = {
    chainId,
    network: network.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    finalOwner,
    contracts: Object.fromEntries(
      Object.entries(deployments).map(([name, deployed]) => [name, {
        address: deployed.address,
        txHash: deployed.txHash,
        blockNumber: deployed.blockNumber,
      }])
    ),
    constructorArgs,
    libraries: linkedLibraries,
    ownershipTransfer,
    verification,
    configHash,
  };

  const outDir = path.join(__dirname, '..', 'deployments', network.name);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `deployment.${chainId}.${deployments.AGIJobManager.blockNumber}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

  exportManualVerificationArtifacts({ outDir, deployments });

  const explorerBase = getExplorerBase(chainId);
  console.log('\n=== Deployment Summary ===');
  Object.entries(record.contracts).forEach(([name, data]) => {
    const link = explorerBase ? ` ${explorerBase}${data.address}` : '';
    console.log(`${name}: ${data.address}${link}`);
  });
  console.log('Verification status:');
  Object.entries(verification).forEach(([name, status]) => {
    console.log(`- ${name}: ${status.status} (attempts=${status.attempts})`);
  });
  console.log(`Receipt: ${outFile}`);
  console.log(`Manual fallback: ${path.join(outDir, 'solc-input.json')} + ${path.join(outDir, 'verify-targets.json')}`);
  console.log('Reminder: only deploy + verify + optional ownership transfer were executed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
