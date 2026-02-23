const fs = require('fs');
const path = require('path');
const { ethers, network, run } = require('hardhat');

const MAINNET_CONFIRMATION_VALUE = 'I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET';
const VERIFY_DELAY_MS = 7000;

const MAINNET_CONSTRUCTOR_ARGS = {
  agiTokenAddress: '0xa61a3b3a130a9c20768eebf97e21515a6046a1fa',
  baseIpfsUrl: 'https://ipfs.io/ipfs/',
  ensConfig: ['0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e', '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401'],
  rootNodes: [
    '0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16',
    '0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d',
    '0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e',
    '0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e',
  ],
  merkleRoots: [
    '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
    '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
  ],
};

const LIBRARIES = ['UriUtils', 'TransferUtils', 'BondMath', 'ReputationMath', 'ENSOwnership'];

function parseConstructorConfigFromEnv() {
  const raw = process.env.CONSTRUCTOR_CONFIG_JSON;
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid CONSTRUCTOR_CONFIG_JSON: ${String(error?.message || error)}`);
  }
}

function requireAddress(label, value) {
  if (!ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error(`${label} must be a valid non-zero address. Received: ${String(value)}`);
  }
}

function requireAddressAllowZero(label, value) {
  if (!ethers.isAddress(value)) {
    throw new Error(`${label} must be a valid address (zero allowed). Received: ${String(value)}`);
  }
}

function requireBytes32(label, value) {
  if (!ethers.isHexString(value, 32)) {
    throw new Error(`${label} must be a bytes32 hex string. Received: ${String(value)}`);
  }
}

function validateConstructorArgs(args) {
  if (!args || typeof args !== 'object') {
    throw new Error('constructor args must be an object.');
  }
  requireAddress('agiTokenAddress', args.agiTokenAddress);
  if (typeof args.baseIpfsUrl !== 'string' || args.baseIpfsUrl.length === 0) {
    throw new Error('baseIpfsUrl must be a non-empty string.');
  }
  if (!Array.isArray(args.ensConfig) || args.ensConfig.length !== 2) {
    throw new Error('ensConfig must be an array with [ensRegistry, nameWrapper].');
  }
  requireAddress('ensConfig[0]', args.ensConfig[0]);
  requireAddressAllowZero('ensConfig[1]', args.ensConfig[1]);

  if (!Array.isArray(args.rootNodes) || args.rootNodes.length !== 4) {
    throw new Error('rootNodes must be an array of 4 bytes32 values.');
  }
  args.rootNodes.forEach((value, idx) => requireBytes32(`rootNodes[${idx}]`, value));

  if (!Array.isArray(args.merkleRoots) || args.merkleRoots.length !== 2) {
    throw new Error('merkleRoots must be an array of 2 bytes32 values.');
  }
  args.merkleRoots.forEach((value, idx) => requireBytes32(`merkleRoots[${idx}]`, value));

  return args;
}

function resolveConstructorArgs(chainId) {
  const override = parseConstructorConfigFromEnv();
  if (chainId === 1) {
    return validateConstructorArgs(override || MAINNET_CONSTRUCTOR_ARGS);
  }
  if (!override) {
    throw new Error('Non-mainnet deployment requires CONSTRUCTOR_CONFIG_JSON to be set.');
  }
  return validateConstructorArgs(override);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stableObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableObject);
  }
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

function computeConfigHash(payload) {
  const canonical = JSON.stringify(stableObject(payload));
  return ethers.keccak256(ethers.toUtf8Bytes(canonical));
}

async function deployContract(name, options = {}) {
  const factory = await ethers.getContractFactory(name, options);
  const contract = await factory.deploy(...(options.args || []));
  await contract.waitForDeployment();
  const tx = contract.deploymentTransaction();
  const receipt = await tx.wait();
  return {
    contract,
    address: await contract.getAddress(),
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
  };
}

async function verifySequential({ name, address, constructorArguments = [], libraries, verification }) {
  await sleep(VERIFY_DELAY_MS);
  try {
    await run('verify:verify', {
      address,
      constructorArguments,
      libraries,
    });
    verification[name] = { status: 'verified', address };
    return verification[name];
  } catch (error) {
    const message = String(error?.message || error);
    if (message.toLowerCase().includes('already verified')) {
      verification[name] = { status: 'already_verified', address };
      return verification[name];
    }
    verification[name] = { status: 'failed', address, error: message };
    return verification[name];
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const providerNetwork = await ethers.provider.getNetwork();
  const chainId = Number(providerNetwork.chainId);
  const constructorArgsConfig = resolveConstructorArgs(chainId);

  if (chainId === 1 && process.env.DEPLOY_CONFIRM_MAINNET !== MAINNET_CONFIRMATION_VALUE) {
    throw new Error(`Mainnet deployment blocked. Set DEPLOY_CONFIRM_MAINNET=${MAINNET_CONFIRMATION_VALUE}.`);
  }

  const finalOwner = chainId === 1
    ? process.env.FINAL_OWNER
    : (process.env.FINAL_OWNER || deployer.address);

  if (!finalOwner) {
    throw new Error('FINAL_OWNER is required on mainnet.');
  }
  if (!ethers.isAddress(finalOwner) || finalOwner === ethers.ZeroAddress) {
    throw new Error(`FINAL_OWNER must be a valid non-zero address. Received: ${String(finalOwner)}`);
  }

  const deployments = {};
  const verification = {};

  for (const libName of LIBRARIES) {
    const deployed = await deployContract(libName);
    deployments[libName] = deployed;
    await verifySequential({ name: libName, address: deployed.address, verification });
  }

  const linkedLibraries = {
    'contracts/utils/UriUtils.sol:UriUtils': deployments.UriUtils.address,
    'contracts/utils/TransferUtils.sol:TransferUtils': deployments.TransferUtils.address,
    'contracts/utils/BondMath.sol:BondMath': deployments.BondMath.address,
    'contracts/utils/ReputationMath.sol:ReputationMath': deployments.ReputationMath.address,
    'contracts/utils/ENSOwnership.sol:ENSOwnership': deployments.ENSOwnership.address,
  };

  const managerArgs = [
    constructorArgsConfig.agiTokenAddress,
    constructorArgsConfig.baseIpfsUrl,
    constructorArgsConfig.ensConfig,
    constructorArgsConfig.rootNodes,
    constructorArgsConfig.merkleRoots,
  ];

  const agiJobManager = await deployContract('AGIJobManager', {
    libraries: linkedLibraries,
    args: managerArgs,
  });
  deployments.AGIJobManager = agiJobManager;

  const manager = await ethers.getContractAt('AGIJobManager', agiJobManager.address, deployer);
  const transferTx = await manager.transferOwnership(finalOwner);
  const transferReceipt = await transferTx.wait();

  await verifySequential({
    name: 'AGIJobManager',
    address: agiJobManager.address,
    constructorArguments: managerArgs,
    libraries: linkedLibraries,
    verification,
  });

  const configHash = computeConfigHash({ constructorArgs: constructorArgsConfig, libraries: linkedLibraries });

  const output = {
    chainId,
    network: network.name,
    deployer: deployer.address,
    deployedAtBlock: agiJobManager.blockNumber,
    contracts: Object.fromEntries(
      Object.entries(deployments).map(([name, data]) => [name, {
        address: data.address,
        txHash: data.txHash,
        blockNumber: data.blockNumber,
      }])
    ),
    constructorArgs: constructorArgsConfig,
    libraries: linkedLibraries,
    ownershipTransfer: {
      finalOwner,
      txHash: transferTx.hash,
      blockNumber: transferReceipt.blockNumber,
    },
    verification,
    configHash,
  };

  const dir = path.join(__dirname, '..', 'deployments', network.name);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `deployment.${chainId}.${agiJobManager.blockNumber}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log('\n=== Deployment Summary ===');
  console.log(`network: ${network.name} (chainId=${chainId})`);
  console.log(`deployer: ${deployer.address}`);
  Object.entries(output.contracts).forEach(([name, c]) => {
    console.log(`${name}: ${c.address} (tx: ${c.txHash})`);
  });
  console.log(`ownership transfer -> ${finalOwner} (tx: ${transferTx.hash})`);
  console.log(`configHash: ${configHash}`);
  console.log(`receipt: ${filePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
