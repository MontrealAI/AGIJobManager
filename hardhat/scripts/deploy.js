/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers, network, run } = require('hardhat');

const MAINNET_CONFIRMATION_VALUE = 'I_UNDERSTAND_MAINNET_DEPLOYMENT';
const VERIFY_DELAY_MS = 3000;
const VERIFY_ATTEMPTS = 3;

const LIBRARY_FQNS = {
  UriUtils: 'contracts/UriUtils.sol:UriUtils',
  TransferUtils: 'contracts/TransferUtils.sol:TransferUtils',
  BondMath: 'contracts/BondMath.sol:BondMath',
  ReputationMath: 'contracts/ReputationMath.sol:ReputationMath',
  ENSOwnership: 'contracts/ENSOwnership.sol:ENSOwnership',
};
const MANAGER_FQN = 'contracts/AGIJobManager.sol:AGIJobManager';

function loadConfigFile() {
  const configPath = process.env.DEPLOY_CONFIG
    ? path.resolve(process.cwd(), process.env.DEPLOY_CONFIG)
    : path.resolve(process.cwd(), 'deploy.config.example.js');
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const loaded = require(configPath);
  return { loaded, configPath };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function isHexAddress(v) {
  return /^0x[a-fA-F0-9]{40}$/.test(v || '');
}

function isBytes32(v) {
  return /^0x[a-fA-F0-9]{64}$/.test(v || '');
}

function assertAddress(name, value) {
  if (!isHexAddress(value)) throw new Error(`${name} must be 0x + 40 hex chars. received=${value}`);
}

function assertBytes32(name, value) {
  if (!isBytes32(value)) throw new Error(`${name} must be 0x + 64 hex chars. received=${value}`);
}

function nonEmpty(name, value) {
  if (!value || !String(value).trim()) throw new Error(`${name} must be non-empty.`);
}

function applyEnvOverrides(profile) {
  const out = JSON.parse(JSON.stringify(profile));
  const setIf = (setter, envKey) => {
    const v = process.env[envKey];
    if (v !== undefined && v !== null && v !== '') setter(v);
  };

  setIf((v) => {
    out.agiTokenAddress = v;
  }, 'AGI_TOKEN_ADDRESS');
  setIf((v) => {
    out.baseIpfsUrl = v;
  }, 'BASE_IPFS_URL');
  setIf((v) => {
    out.ensConfig.ensRegistry = v;
  }, 'ENS_REGISTRY');
  setIf((v) => {
    out.ensConfig.nameWrapper = v;
  }, 'NAME_WRAPPER');
  setIf((v) => {
    out.rootNodes.clubRootNode = v;
  }, 'CLUB_ROOT_NODE');
  setIf((v) => {
    out.rootNodes.agentRootNode = v;
  }, 'AGENT_ROOT_NODE');
  setIf((v) => {
    out.rootNodes.alphaClubRootNode = v;
  }, 'ALPHA_CLUB_ROOT_NODE');
  setIf((v) => {
    out.rootNodes.alphaAgentRootNode = v;
  }, 'ALPHA_AGENT_ROOT_NODE');
  setIf((v) => {
    out.merkleRoots.validatorMerkleRoot = v;
  }, 'VALIDATOR_MERKLE_ROOT');
  setIf((v) => {
    out.merkleRoots.agentMerkleRoot = v;
  }, 'AGENT_MERKLE_ROOT');

  if (process.env.FINAL_OWNER) out.finalOwner = process.env.FINAL_OWNER;
  return out;
}

function toConstructorArgs(profile) {
  return {
    agiTokenAddress: profile.agiTokenAddress,
    baseIpfsUrl: profile.baseIpfsUrl,
    ensConfig: [profile.ensConfig.ensRegistry, profile.ensConfig.nameWrapper],
    rootNodes: [
      profile.rootNodes.clubRootNode,
      profile.rootNodes.agentRootNode,
      profile.rootNodes.alphaClubRootNode,
      profile.rootNodes.alphaAgentRootNode,
    ],
    merkleRoots: [
      profile.merkleRoots.validatorMerkleRoot,
      profile.merkleRoots.agentMerkleRoot,
    ],
  };
}

function validateProfile(profile, chainId) {
  assertAddress('agiTokenAddress', profile.agiTokenAddress);
  assertAddress('ensConfig.ensRegistry', profile.ensConfig.ensRegistry);
  assertAddress('ensConfig.nameWrapper', profile.ensConfig.nameWrapper);
  assertBytes32('rootNodes.clubRootNode', profile.rootNodes.clubRootNode);
  assertBytes32('rootNodes.agentRootNode', profile.rootNodes.agentRootNode);
  assertBytes32('rootNodes.alphaClubRootNode', profile.rootNodes.alphaClubRootNode);
  assertBytes32('rootNodes.alphaAgentRootNode', profile.rootNodes.alphaAgentRootNode);
  assertBytes32('merkleRoots.validatorMerkleRoot', profile.merkleRoots.validatorMerkleRoot);
  assertBytes32('merkleRoots.agentMerkleRoot', profile.merkleRoots.agentMerkleRoot);
  nonEmpty('baseIpfsUrl', profile.baseIpfsUrl);

  if (chainId === 1) {
    if (process.env.DEPLOY_CONFIRM_MAINNET !== MAINNET_CONFIRMATION_VALUE) {
      throw new Error(`Mainnet deployment blocked. Set DEPLOY_CONFIRM_MAINNET=${MAINNET_CONFIRMATION_VALUE}`);
    }
    nonEmpty('FINAL_OWNER', profile.finalOwner);
    assertAddress('finalOwner', profile.finalOwner);
  } else if (profile.finalOwner) {
    assertAddress('finalOwner', profile.finalOwner);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryVerify(message) {
  const m = message.toLowerCase();
  return m.includes('failed to send') || m.includes('timeout') || m.includes('connection') || m.includes('temporarily') || m.includes('try again');
}

async function verifyWithRetry({ address, constructorArguments, contract }) {
  let attempt = 0;
  while (attempt < VERIFY_ATTEMPTS) {
    attempt += 1;
    try {
      await run('verify:verify', { address, constructorArguments, contract });
      return { ok: true, status: 'verified', attempts: attempt };
    } catch (error) {
      const message = error?.message || String(error);
      if (/already verified/i.test(message) || /Contract source code already verified/i.test(message)) {
        return { ok: true, status: 'already-verified', attempts: attempt, note: message };
      }
      if (attempt < VERIFY_ATTEMPTS && shouldRetryVerify(message)) {
        await wait(VERIFY_DELAY_MS);
        continue;
      }
      return { ok: false, status: 'failed', attempts: attempt, error: message };
    }
  }
  return { ok: false, status: 'failed', attempts: VERIFY_ATTEMPTS, error: 'unknown verify failure' };
}

function explorerBase(chainId) {
  if (chainId === 1) return 'https://etherscan.io/address';
  if (chainId === 11155111) return 'https://sepolia.etherscan.io/address';
  return '';
}

function blockExplorerName(chainId) {
  return chainId === 11155111 ? 'Sepolia Etherscan' : 'Etherscan';
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const providerNetwork = await ethers.provider.getNetwork();
  const chainId = Number(providerNetwork.chainId);
  const networkName = network.name;

  const { loaded, configPath } = loadConfigFile();
  if (!loaded[networkName]) {
    throw new Error(`Missing network profile '${networkName}' in ${configPath}`);
  }

  const profile = applyEnvOverrides(loaded[networkName]);
  validateProfile(profile, chainId);

  const constructorArgs = toConstructorArgs(profile);

  console.log('=== AGIJobManager Hardhat Deployment Plan ===');
  console.log(`network: ${networkName}`);
  console.log(`chainId: ${chainId}`);
  console.log(`deployer: ${deployer.address}`);
  console.log(`finalOwner: ${profile.finalOwner || deployer.address}`);
  console.log(`config: ${configPath}`);
  console.log('constructorArgs:');
  console.log(JSON.stringify(constructorArgs, null, 2));
  console.log('============================================');

  if (process.env.DRY_RUN === '1') {
    console.log('DRY_RUN=1 set. Deployment skipped.');
    return;
  }

  const links = {};

  console.log('[1/5] Deploy UriUtils');
  const UriUtils = await ethers.getContractFactory('UriUtils');
  const uriUtils = await UriUtils.deploy();
  await uriUtils.waitForDeployment();
  links.UriUtils = { address: await uriUtils.getAddress(), txHash: uriUtils.deploymentTransaction().hash };

  console.log('[2/5] Deploy TransferUtils');
  const TransferUtils = await ethers.getContractFactory('TransferUtils');
  const transferUtils = await TransferUtils.deploy();
  await transferUtils.waitForDeployment();
  links.TransferUtils = { address: await transferUtils.getAddress(), txHash: transferUtils.deploymentTransaction().hash };

  console.log('[3/5] Deploy BondMath');
  const BondMath = await ethers.getContractFactory('BondMath');
  const bondMath = await BondMath.deploy();
  await bondMath.waitForDeployment();
  links.BondMath = { address: await bondMath.getAddress(), txHash: bondMath.deploymentTransaction().hash };

  console.log('[4/5] Deploy ReputationMath');
  const ReputationMath = await ethers.getContractFactory('ReputationMath');
  const reputationMath = await ReputationMath.deploy();
  await reputationMath.waitForDeployment();
  links.ReputationMath = { address: await reputationMath.getAddress(), txHash: reputationMath.deploymentTransaction().hash };

  console.log('[5/5] Deploy ENSOwnership');
  const ENSOwnership = await ethers.getContractFactory('ENSOwnership');
  const ensOwnership = await ENSOwnership.deploy();
  await ensOwnership.waitForDeployment();
  links.ENSOwnership = { address: await ensOwnership.getAddress(), txHash: ensOwnership.deploymentTransaction().hash };

  console.log('[6/6] Deploy AGIJobManager');
  const AGIJobManager = await ethers.getContractFactory('AGIJobManager', {
    libraries: {
      UriUtils: links.UriUtils.address,
      TransferUtils: links.TransferUtils.address,
      BondMath: links.BondMath.address,
      ReputationMath: links.ReputationMath.address,
      ENSOwnership: links.ENSOwnership.address,
    },
  });

  const manager = await AGIJobManager.deploy(
    constructorArgs.agiTokenAddress,
    constructorArgs.baseIpfsUrl,
    constructorArgs.ensConfig,
    constructorArgs.rootNodes,
    constructorArgs.merkleRoots
  );
  await manager.waitForDeployment();

  const managerInfo = {
    address: await manager.getAddress(),
    txHash: manager.deploymentTransaction().hash,
  };

  console.log('Verifying contracts (standard JSON flow via Hardhat)...');
  const verification = {};

  for (const [name, info] of Object.entries(links)) {
    await wait(VERIFY_DELAY_MS);
    verification[name] = await verifyWithRetry({
      address: info.address,
      constructorArguments: [],
      contract: LIBRARY_FQNS[name],
    });
    console.log(`verify ${name}: ${verification[name].status}`);
  }

  await wait(VERIFY_DELAY_MS);
  verification.AGIJobManager = await verifyWithRetry({
    address: managerInfo.address,
    constructorArguments: [
      constructorArgs.agiTokenAddress,
      constructorArgs.baseIpfsUrl,
      constructorArgs.ensConfig,
      constructorArgs.rootNodes,
      constructorArgs.merkleRoots,
    ],
    contract: MANAGER_FQN,
  });
  console.log(`verify AGIJobManager: ${verification.AGIJobManager.status}`);

  const finalOwner = profile.finalOwner || deployer.address;
  let ownershipTransfer = null;
  if (finalOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    const tx = await manager.transferOwnership(finalOwner);
    const rc = await tx.wait();
    ownershipTransfer = {
      txHash: tx.hash,
      blockNumber: rc.blockNumber,
    };
    console.log(`ownership transferred -> ${finalOwner}`);
  }

  const latestBlock = await ethers.provider.getBlock('latest');
  const deploymentDir = path.resolve(process.cwd(), 'deployments', networkName);
  fs.mkdirSync(deploymentDir, { recursive: true });

  const configHash = ethers.keccak256(ethers.toUtf8Bytes(stableStringify({
    constructorArgs,
    libraries: Object.fromEntries(Object.entries(links).map(([k, v]) => [k, v.address])),
    finalOwner,
  })));

  const receipt = {
    chainId,
    network: networkName,
    deployer: deployer.address,
    finalOwner,
    contracts: {
      ...links,
      AGIJobManager: managerInfo,
    },
    constructorArgs,
    libraries: Object.fromEntries(Object.entries(links).map(([k, v]) => [k, v.address])),
    verification,
    ownershipTransfer,
    timestamp: new Date().toISOString(),
    configHash,
  };

  const receiptPath = path.join(deploymentDir, `deployment.${chainId}.${latestBlock.number}.json`);
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

  const explorer = explorerBase(chainId);
  if (explorer) {
    console.log(`\n${blockExplorerName(chainId)} links:`);
    Object.entries(receipt.contracts).forEach(([name, info]) => {
      console.log(`${name}: ${explorer}/${info.address}`);
    });
  }

  console.log('\nManual verify fallback commands:');
  Object.entries(LIBRARY_FQNS).forEach(([name, fqn]) => {
    console.log(`npx hardhat verify --network ${networkName} --contract ${fqn} ${links[name].address}`);
  });
  console.log(
    `npx hardhat verify --network ${networkName} --contract ${MANAGER_FQN} ${managerInfo.address} `
    + `${constructorArgs.agiTokenAddress} "${constructorArgs.baseIpfsUrl}" `
    + `"[${constructorArgs.ensConfig.join(',')}]" "[${constructorArgs.rootNodes.join(',')}]" "[${constructorArgs.merkleRoots.join(',')}]"`
  );

  console.log(`\nDeployment receipt: ${receiptPath}`);
  console.log(`Deployer nonce-safe summary id: ${crypto.createHash('sha256').update(receiptPath).digest('hex')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
