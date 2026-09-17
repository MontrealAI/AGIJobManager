const { USDC_ABI, requireDeploymentNetwork, requireRuntimeSize, requireCode, requireOperationalUSDC, requireVerified, requireArtifactMatch } = require('./deployment-safety');
const fs = require('fs');
const path = require('path');
const { ethers, network, run, artifacts } = require('hardhat');

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
  if (!Number.isSafeInteger(parsed) || parsed < min) {
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
    usdcTokenAddress: profile.usdcTokenAddress,
    baseIpfsUrl: profile.baseIpfsUrl,
    ensConfig: profile.ensConfig,
    rootNodes: profile.rootNodes,
    merkleRoots: profile.merkleRoots,
    settlementWallets: profile.settlementWallets,
  };

  validateAddress('usdcTokenAddress', constructorArgs.usdcTokenAddress);
  if (typeof constructorArgs.baseIpfsUrl !== 'string' || constructorArgs.baseIpfsUrl.trim() === '') {
    throw new Error('baseIpfsUrl must be a non-empty string.');
  }
  if (ethers.toUtf8Bytes(constructorArgs.baseIpfsUrl).length > 512) throw new Error('baseIpfsUrl must not exceed 512 UTF-8 bytes.');
  if (!Array.isArray(constructorArgs.ensConfig) || constructorArgs.ensConfig.length !== 2) {
    throw new Error('ensConfig must be an array of exactly 2 addresses.');
  }
  if (!Array.isArray(constructorArgs.rootNodes) || constructorArgs.rootNodes.length !== 4) {
    throw new Error('rootNodes must be an array of exactly 4 bytes32 values.');
  }
  if (!Array.isArray(constructorArgs.merkleRoots) || constructorArgs.merkleRoots.length !== 2) {
    throw new Error('merkleRoots must be an array of exactly 2 bytes32 values.');
  }

  if (!Array.isArray(constructorArgs.settlementWallets) || constructorArgs.settlementWallets.length !== 2) {
    throw new Error('settlementWallets must contain the 30% recipient followed by the 10% recipient.');
  }
  constructorArgs.settlementWallets.forEach((value, index) => validateAddress(`settlementWallets[${index}]`, value));
  const wallets = constructorArgs.settlementWallets.map(value => value.toLowerCase());
  if (wallets[0] === wallets[1] || wallets.includes(constructorArgs.usdcTokenAddress.toLowerCase())) {
    throw new Error('Settlement wallets must be distinct and must not be the USDC token contract.');
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

async function deployContract(name, args = [], options = {}, confirmations = DEFAULT_CONFIRMATIONS, onBroadcast = () => {}) {
  const factory = await ethers.getContractFactory(name, options);
  const contract = await factory.deploy(...args);
  const tx = contract.deploymentTransaction();
  onBroadcast({ name, address: await contract.getAddress(), txHash: tx.hash, status: 'broadcast' });
  await contract.waitForDeployment();
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

async function qualifiedBuild() {
  const buildInfo = await artifacts.getBuildInfo(FQNS.AGIJobManager);
  if (!buildInfo) throw new Error('Manager build info missing. Run `npm run compile` first.');
  const settings = buildInfo.input.settings;
  const actualSettings = {
    version: buildInfo.solcVersion,
    optimizer: settings.optimizer,
    evmVersion: settings.evmVersion,
    viaIR: settings.viaIR || false,
    metadata: settings.metadata,
    debug: settings.debug,
  };
  if (JSON.stringify(stableObject(actualSettings)) !== JSON.stringify(stableObject(COMPILER_SETTINGS))) {
    throw new Error('Compiler settings do not match the release-qualified deployment profile.');
  }
  const runtimeBytes = {};
  for (const name of [...LIBRARIES, 'AGIJobManager']) {
    const artifact = await artifacts.readArtifact(FQNS[name]);
    runtimeBytes[name] = requireRuntimeSize(name, artifact.deployedBytecode);
    const compiled = buildInfo.output.contracts[artifact.sourceName]?.[artifact.contractName];
    if (!compiled || `0x${compiled.evm.bytecode.object}` !== artifact.bytecode || `0x${compiled.evm.deployedBytecode.object}` !== artifact.deployedBytecode) {
      throw new Error(`${name} artifact differs from the manager build. Clean and recompile the complete release.`);
    }
  }
  return { buildInfo, runtimeBytes };
}

function writeRecord(filePath, record) {
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, filePath);
}

async function main() {
  const confirmations = parsePositiveInt(process.env.CONFIRMATIONS, 'CONFIRMATIONS', DEFAULT_CONFIRMATIONS, 1);
  const verifyDelayMs = parsePositiveInt(process.env.VERIFY_DELAY_MS, 'VERIFY_DELAY_MS', DEFAULT_VERIFY_DELAY_MS, 0);
  const dryRun = process.env.DRY_RUN === '1';
  let [deployer] = await ethers.getSigners();
  if (!deployer && dryRun && process.env.DEPLOYER_ADDRESS) {
    validateAddress('DEPLOYER_ADDRESS', process.env.DEPLOYER_ADDRESS);
    deployer = { address: ethers.getAddress(process.env.DEPLOYER_ADDRESS) };
  }
  const providerNetwork = await ethers.provider.getNetwork();
  const chainId = Number(providerNetwork.chainId);
  requireDeploymentNetwork(network.name, chainId);
  if (!deployer) throw new Error('A deployer account is required. For a read-only DRY_RUN=1 without a key, set DEPLOYER_ADDRESS.');
  if (chainId === 1 && confirmations < DEFAULT_CONFIRMATIONS) throw new Error(`Mainnet requires at least ${DEFAULT_CONFIRMATIONS} confirmations.`);
  const explorerBase = getExplorerBase(chainId);
  const explorerAddressBase = getExplorerAddressBase(chainId);

  const { config, configPath } = loadDeployConfig();
  const profile = config[network.name];
  const constructorArgs = resolveConstructor(network.name, profile);
  const resolvedFinalOwner = resolveFinalOwner(profile);
  if (resolvedFinalOwner.toLowerCase() === constructorArgs.usdcTokenAddress.toLowerCase()) throw new Error('finalOwner cannot be the USDC token contract.');
  const block = await ethers.provider.getBlock('latest');
  if (!block) throw new Error('Unable to resolve the preflight block.');
  const tokenCode = await requireCode(ethers.provider, constructorArgs.usdcTokenAddress, 'USDC', block.number);
  for (const [index, address] of constructorArgs.ensConfig.entries()) {
    if (address !== ethers.ZeroAddress) await requireCode(ethers.provider, address, `ensConfig[${index}]`, block.number);
  }
  const usdc = new ethers.Contract(constructorArgs.usdcTokenAddress, USDC_ABI, ethers.provider);
  const tokenState = await requireOperationalUSDC({ chainId, tokenAddress: constructorArgs.usdcTokenAddress, token: usdc,
    recipients: [...constructorArgs.settlementWallets, resolvedFinalOwner, deployer.address], blockTag: block.number });
  const { buildInfo, runtimeBytes } = await qualifiedBuild();

  if (chainId === 1 && !dryRun) {
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
    runtimeBytes,
    preflight: { blockNumber: block.number, blockHash: block.hash, tokenCodeHash: ethers.keccak256(tokenCode), tokenState },
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
  const outDir = path.join(__dirname, '..', 'deployments', network.name);
  fs.mkdirSync(outDir, { recursive: true });
  const receiptPath = path.join(outDir, `deployment.${chainId}.${Date.now()}.${deployer.address}.json`);
  const solcInputPath = receiptPath.replace(/\.json$/, '.solc-input.json');
  fs.writeFileSync(solcInputPath, `${JSON.stringify(buildInfo.input, null, 2)}\n`, { flag: 'wx' });
  const journal = { ...plan, status: 'started', timestamp: new Date().toISOString(), contracts: deployments, verification: verificationResults, solcInputPath };
  writeRecord(receiptPath, journal);
  console.log(`Durable deployment journal: ${receiptPath}`);
  const checkpoint = () => writeRecord(receiptPath, journal);
  const onBroadcast = (record) => { deployments[record.name] = record; checkpoint(); };
  try {
    for (const libName of LIBRARIES) {
      const result = await deployContract(libName, [], {}, confirmations, onBroadcast);
      const code = await requireCode(ethers.provider, result.address, libName);
      requireArtifactMatch({ artifact: await artifacts.readArtifact(FQNS[libName]), buildInfo, address: result.address, code });
      result.runtimeCodeHash = ethers.keccak256(code);
      deployments[libName] = result;
      checkpoint();
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
      constructorArgs.usdcTokenAddress,
      constructorArgs.baseIpfsUrl,
      constructorArgs.ensConfig,
      constructorArgs.rootNodes,
      constructorArgs.merkleRoots,
      constructorArgs.settlementWallets,
    ];

    const managerDeployment = await deployContract('AGIJobManager', managerArgs, { libraries: linkedLibraries }, confirmations, onBroadcast);
    const managerCode = await requireCode(ethers.provider, managerDeployment.address, 'AGIJobManager');
    requireArtifactMatch({ artifact: await artifacts.readArtifact(FQNS.AGIJobManager), buildInfo, address: managerDeployment.address, libraries: linkedLibraries, tokenAddress: constructorArgs.usdcTokenAddress, code: managerCode });
    managerDeployment.runtimeCodeHash = ethers.keccak256(managerCode);
    deployments.AGIJobManager = managerDeployment;
    journal.libraries = linkedLibraries;
    checkpoint();
    const manager = await ethers.getContractAt('AGIJobManager', managerDeployment.address, deployer);
    if (!(await manager.paused())) throw new Error('New manager did not start with intake paused. Do not activate this deployment.');
    journal.intakePaused = true;
    checkpoint();
    console.log('[intake] paused atomically by the constructor.');
    console.log(`[deployed] AGIJobManager ${managerDeployment.address} tx=${managerDeployment.txHash}`);

    for (const libName of LIBRARIES) {
      await sleep(verifyDelayMs);
      verificationResults[libName] = await verifyWithRetry({ name: libName, record: deployments[libName] }, verifyDelayMs);
      checkpoint();
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

    checkpoint();

    let ownershipTransfer = {
      executed: false,
      txHash: null,
      blockNumber: null,
      reason: 'deployer_is_final_owner',
    };
    if (deployer.address.toLowerCase() !== resolvedFinalOwner.toLowerCase()) {
      const tx = await manager.transferOwnership(resolvedFinalOwner);
      journal.ownershipTransfer = { executed: true, txHash: tx.hash, status: 'broadcast', finalOwner: resolvedFinalOwner };
      checkpoint();
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

    const currentOwner = await manager.owner();
    const pendingOwner = await manager.pendingOwner();
    const ownershipAccepted = currentOwner.toLowerCase() === resolvedFinalOwner.toLowerCase();
    if (!ownershipAccepted && pendingOwner.toLowerCase() !== resolvedFinalOwner.toLowerCase()) {
      throw new Error('Ownership proposal did not match the intended final owner.');
    }
    ownershipTransfer.accepted = ownershipAccepted;
    ownershipTransfer.currentOwner = currentOwner;
    ownershipTransfer.pendingOwner = pendingOwner;
    ownershipTransfer.acceptanceRequired = !ownershipAccepted;

    const stablePayload = stableObject({ constructorArgs, libraries: linkedLibraries, finalOwner: resolvedFinalOwner });
    const configHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(stablePayload)));

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
          runtimeCodeHash: deployment.runtimeCodeHash,
        }])
      ),
      constructorArgs,
      libraries: linkedLibraries,
      ownershipTransfer,
      intakePaused: await manager.paused(),
      intakePausedAtDeployment: true,
      verification: verificationResults,
      configHash,
    };

    Object.assign(journal, record, { status: 'awaiting_readiness_review' });
    checkpoint();

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
    console.log('Intake is paused. Configure and verify the manager before unpausing.');
    if (!ownershipAccepted) console.log(`ACTION REQUIRED: ${resolvedFinalOwner} must call acceptOwnership(). Current owner remains ${currentOwner} until acceptance.`);
    requireVerified(verificationResults, [...LIBRARIES, 'AGIJobManager']);
    journal.status = 'deployed_paused';
    checkpoint();
    console.log('Post-deploy: accept ownership, review configuration, then run the read-only check-readiness.js before owner activation.');
    console.log('All other operational configuration is manual via Etherscan runbook.');
  } catch (error) {
    journal.status = 'failed';
    journal.error = String(error?.message || error);
    checkpoint();
    console.error(`Deployment incomplete. Preserve ${receiptPath}; do not rerun deployment blindly.`);
    throw error;
  }
}

if (require.main === module) main().catch((error) => {
  console.error(error);
  process.exit(1);
});

module.exports = { resolveConstructor, parsePositiveInt, qualifiedBuild, FQNS, LIBRARIES, main };
