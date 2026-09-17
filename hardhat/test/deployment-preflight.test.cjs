const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const realEthers = require('ethers');
const { requireDeploymentNetwork, requireRuntimeSize, requireCode, requireOperationalUSDC, requireVerified, requireReadinessState, requireArtifactMatch } = require('../scripts/deployment-safety');

const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const A = `0x${'11'.repeat(20)}`;
const B = `0x${'22'.repeat(20)}`;
const ZERO = `0x${'00'.repeat(20)}`;
const state = () => ({ owner: A, finalOwner: A, pendingOwner: ZERO, paused: true, settlementPaused: false,
  wallets: [A, B], expectedWallets: [A, B], reserves: [0n, 0n, 0n, 0n], balance: 0n });
const token = (overrides = {}) => ({ decimals: async () => 6n, paused: async () => false, isBlacklisted: async () => false, ...overrides });
const usdc = (overrides = {}) => ({ chainId: 1, tokenAddress: TOKEN, token: token(), recipients: [A, B], blockTag: 123, ...overrides });

test('binds the deployment name to the actual RPC chain', () => {
  requireDeploymentNetwork('mainnet', 1n);
  requireDeploymentNetwork('sepolia', 11155111n);
  assert.throws(() => requireDeploymentNetwork('sepolia', 1), /must use chain/);
  assert.throws(() => requireDeploymentNetwork('mainnet', 11155111), /must use chain/);
  assert.throws(() => requireDeploymentNetwork('custom', 1), /unsupported/);
});

test('blocks empty and oversized runtime code before broadcasting', () => {
  assert.equal(requireRuntimeSize('manager', `0x${'00'.repeat(24576)}`), 24576);
  assert.throws(() => requireRuntimeSize('manager', `0x${'00'.repeat(24577)}`), /exceeds/);
  assert.throws(() => requireRuntimeSize('manager', '0x'), /valid/);
});

test('rejects EOA or missing contract dependencies', async () => {
  await assert.rejects(requireCode({ getCode: async () => '0x' }, A, 'ENS', 123), /no deployed bytecode/);
});

test('rejects noncanonical, wrong-decimal, paused or frozen Circle USDC', async () => {
  await assert.rejects(requireOperationalUSDC(usdc({ tokenAddress: A })), /Only Circle USDC/);
  await assert.rejects(requireOperationalUSDC(usdc({ token: token({ decimals: async () => 18 }) })), /six decimals/);
  await assert.rejects(requireOperationalUSDC(usdc({ token: token({ paused: async () => true }) })), /USDC is paused/);
  await assert.rejects(requireOperationalUSDC(usdc({ token: token({ isBlacklisted: async address => address === B }) })), /blacklisted/);
});

test('USDC status reads share the reviewed block and de-duplicate recipients', async () => {
  const calls = [];
  const value = token({ decimals: async opts => { calls.push(opts); return 6; }, paused: async opts => { calls.push(opts); return false; },
    isBlacklisted: async (address, opts) => { calls.push(opts); return false; } });
  const result = await requireOperationalUSDC(usdc({ token: value, recipients: [A, A, B] }));
  assert.equal(result.checkedAddresses.length, 2);
  assert.deepEqual(calls, Array(4).fill({ blockTag: 123 }));
});

test('USDC query failures block the preflight', async () => {
  await assert.rejects(requireOperationalUSDC(usdc({ token: token({ paused: async () => { throw new Error('RPC unavailable'); } }) })), /RPC unavailable/);
});

test('missing or failed explorer verification cannot pass', () => {
  assert.throws(() => requireVerified({}, ['Manager']), /verification incomplete/);
  assert.throws(() => requireVerified({ Manager: { status: 'failed' } }, ['Manager']), /verification incomplete/);
  requireVerified({ Manager: { status: 'verified' }, Library: { status: 'already_verified' } }, ['Manager', 'Library']);
});

test('ownership acceptance and no pending transfer are required', () => {
  assert.throws(() => requireReadinessState({ ...state(), owner: B }), /not accepted/);
  assert.throws(() => requireReadinessState({ ...state(), pendingOwner: B }), /pending ownership/);
});

test('activation preflight requires paused intake and functional settlement', () => {
  assert.throws(() => requireReadinessState({ ...state(), paused: false }), /intake to be paused/);
  assert.throws(() => requireReadinessState({ ...state(), settlementPaused: true }), /Settlement is paused/);
});

test('activation rejects changed recipients, insolvent reserves and existing jobs', () => {
  assert.throws(() => requireReadinessState({ ...state(), wallets: [B, A] }), /does not match/);
  assert.throws(() => requireReadinessState({ ...state(), reserves: [1n, 0n, 0n, 0n] }), /below reserved/);
  assert.throws(() => requireReadinessState({ ...state(), reserves: [0n, 0n, 1n, 0n], balance: 1n }), /no existing job/);
  assert.deepEqual(requireReadinessState({ ...state(), balance: 99n }), { balance: '99', reserved: '0' });
});

test('runtime comparison reconstructs linked addresses and rejects a substituted target', () => {
  const artifact = { sourceName: 'source', contractName: 'Manager', deployedBytecode: `0x60${'00'.repeat(20)}00`,
    deployedLinkReferences: { source: { Lib: [{ start: 1, length: 20 }] } } };
  const buildInfo = { output: { contracts: { source: { Manager: { evm: { deployedBytecode: { immutableReferences: {} } } } } } } };
  const args = { artifact, buildInfo, address: A, libraries: { 'source:Lib': B }, code: `0x60${B.slice(2)}00` };
  assert.equal(requireArtifactMatch(args), 22);
  assert.throws(() => requireArtifactMatch({ ...args, code: `0x60${A.slice(2)}00` }), /differs/);
  assert.throws(() => requireArtifactMatch({ ...args, libraries: {} }), /Missing linked library/);
});

test('runtime comparison checks immutable USDC and library self-address', () => {
  const artifact = { sourceName: 'source', contractName: 'AGIJobManager', deployedBytecode: `0x60${'00'.repeat(32)}` };
  const buildInfo = { output: { contracts: { source: {} } } };
  buildInfo.output.contracts.source.AGIJobManager = { evm: { deployedBytecode: { immutableReferences: { '1': [{ start: 1, length: 32 }] } } } };
  const args = { artifact, buildInfo, address: A, tokenAddress: TOKEN, code: `0x60${TOKEN.slice(2).toLowerCase().padStart(64, '0')}` };
  assert.equal(requireArtifactMatch(args), 33);
  assert.throws(() => requireArtifactMatch({ ...args, tokenAddress: B }), /differs/);
  const library = { sourceName: 'source', contractName: 'Lib', deployedBytecode: `0x73${'00'.repeat(20)}3014` };
  buildInfo.output.contracts.source.Lib = { evm: { deployedBytecode: {} } };
  assert.equal(requireArtifactMatch({ artifact: library, buildInfo, address: B, code: `0x73${B.slice(2)}3014` }), 23);
});

function deploymentHarness({ dryRun = false, failConfirmation = false, failVerification = false, noSigner = false, deployerAddress = '' } = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'agi-deployment-preflight-'));
  const scriptsDir = path.join(folder, 'scripts');
  fs.mkdirSync(scriptsDir);
  const configPath = path.join(folder, 'config.js');
  fs.writeFileSync(configPath, `module.exports = ${JSON.stringify({ mainnet: { usdcTokenAddress: TOKEN, finalOwner: A,
    baseIpfsUrl: 'ipfs://', ensConfig: [B, ZERO], rootNodes: Array(4).fill(`0x${'00'.repeat(32)}`),
    merkleRoots: Array(2).fill(`0x${'00'.repeat(32)}`), settlementWallets: [A, B] } })}`);
  let broadcasts = 0;
  const input = { settings: { optimizer: { enabled: true, runs: 40 }, evmVersion: 'shanghai', viaIR: false,
    metadata: { bytecodeHash: 'none' }, debug: { revertStrings: 'strip' } } };
  const buildInfo = { solcVersion: '0.8.23', input, output: { contracts: {} } };
  const mockArtifacts = {
    getBuildInfo: async () => buildInfo,
    readArtifact: async fqn => {
      const [sourceName, contractName] = fqn.split(':');
      buildInfo.output.contracts[sourceName] ||= {};
      buildInfo.output.contracts[sourceName][contractName] = { evm: { bytecode: { object: '6000' }, deployedBytecode: { object: '6000', immutableReferences: {} } } };
      return { sourceName, contractName, bytecode: '0x6000', deployedBytecode: '0x6000', deployedLinkReferences: {} };
    },
  };
  const provider = { getNetwork: async () => ({ chainId: 1n }), getBlock: async () => ({ number: 123, hash: '0xblock' }), getCode: async () => '0x6000' };
  const manager = { paused: async () => true, owner: async () => A, pendingOwner: async () => ZERO };
  const mockEthers = { ...realEthers, provider, getSigners: async () => noSigner ? [] : [{ address: A }],
    Contract: function () { return token(); }, getContractAt: async () => manager,
    getContractFactory: async () => ({ deploy: async () => {
      broadcasts += 1;
      const nonce = broadcasts;
      const tx = { hash: `0xtransaction${nonce}`, wait: async () => ({ blockNumber: 123 + nonce }) };
      return { getAddress: async () => `0x${String(nonce + 100).padStart(40, '0')}`, deploymentTransaction: () => tx,
        waitForDeployment: async () => { if (failConfirmation && nonce === 2) throw new Error('Confirmation RPC failed'); } };
    } }),
  };
  const module = { exports: {} };
  const mockRequire = name => {
    if (name === 'hardhat') return { ethers: mockEthers, network: { name: 'mainnet' }, artifacts: mockArtifacts,
      run: async () => { if (failVerification) throw new Error('Explorer unavailable'); } };
    if (name === './deployment-safety') return require('../scripts/deployment-safety');
    return require(name);
  };
  mockRequire.cache = require.cache;
  const context = { module, exports: module.exports, require: mockRequire, __dirname: scriptsDir,
    process: { env: { DEPLOY_CONFIG: configPath, VERIFY_DELAY_MS: '0', DRY_RUN: dryRun ? '1' : '',
      DEPLOY_CONFIRM_MAINNET: dryRun ? '' : 'I_UNDERSTAND_MAINNET_DEPLOYMENT', DEPLOYER_ADDRESS: deployerAddress }, cwd: () => folder },
    console: { log() {}, error() {} }, setTimeout };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/deploy.js'), 'utf8'), context);
  return { main: module.exports.main, broadcasts: () => broadcasts, folder,
    constructor: module.exports.resolveConstructor, profile: require(configPath).mainnet,
    receipt: () => {
      const directory = path.join(folder, 'deployments', 'mainnet');
      const file = fs.readdirSync(directory).find(name => name.startsWith('deployment.') && !name.endsWith('.solc-input.json'));
      return JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    }, cleanup: () => fs.rmSync(folder, { recursive: true, force: true }) };
}

test('constructor preflight rejects oversized UTF-8 metadata and invalid or duplicate settlement recipients', () => {
  const harness = deploymentHarness({ dryRun: true });
  try {
    assert.throws(() => harness.constructor('mainnet', { ...harness.profile, baseIpfsUrl: 'é'.repeat(257) }), /512 UTF-8 bytes/);
    for (const settlementWallets of [[A, A], [A, ZERO], [A, TOKEN], [A]]) {
      assert.throws(() => harness.constructor('mainnet', { ...harness.profile, settlementWallets }), /distinct|non-zero|settlementWallets/);
    }
  } finally { harness.cleanup(); }
});

test('mainnet dry-run validates the full plan without confirmation phrase, files or broadcasts', async () => {
  const harness = deploymentHarness({ dryRun: true });
  try {
    await harness.main();
    assert.equal(harness.broadcasts(), 0);
    assert.equal(fs.existsSync(path.join(harness.folder, 'deployments')), false);
  } finally { harness.cleanup(); }
});

test('read-only preflight accepts an explicit deployer address without a signing account; live deployment does not', async () => {
  const dryRun = deploymentHarness({ dryRun: true, noSigner: true, deployerAddress: A });
  const live = deploymentHarness({ noSigner: true, deployerAddress: A });
  const missingAddress = deploymentHarness({ dryRun: true, noSigner: true });
  try {
    await dryRun.main();
    assert.equal(dryRun.broadcasts(), 0);
    await assert.rejects(live.main(), /deployer account is required/);
    assert.equal(live.broadcasts(), 0);
    await assert.rejects(missingAddress.main(), /set DEPLOYER_ADDRESS/);
  } finally { dryRun.cleanup(); live.cleanup(); missingAddress.cleanup(); }
});

test('partial confirmation failure preserves previously mined contracts and pending transaction identity', async () => {
  const harness = deploymentHarness({ failConfirmation: true });
  try {
    await assert.rejects(harness.main(), /Confirmation RPC failed/);
    const receipt = harness.receipt();
    assert.equal(harness.broadcasts(), 2);
    assert.equal(receipt.status, 'failed');
    assert.equal(receipt.contracts.UriUtils.blockNumber, 124);
    assert.equal(receipt.contracts.TransferUtils.status, 'broadcast');
    assert.equal(receipt.contracts.TransferUtils.txHash, '0xtransaction2');
    assert.ok(fs.existsSync(receipt.solcInputPath));
  } finally { harness.cleanup(); }
});

test('explorer outage fails deployment outcome while preserving paused manager and verification evidence', async () => {
  const harness = deploymentHarness({ failVerification: true });
  try {
    await assert.rejects(harness.main(), /verification incomplete/);
    const receipt = harness.receipt();
    assert.equal(harness.broadcasts(), 6);
    assert.equal(receipt.status, 'failed');
    assert.equal(receipt.intakePaused, true);
    assert.equal(receipt.verification.AGIJobManager.status, 'failed');
    assert.equal(receipt.verification.AGIJobManager.attempts, 3);
    assert.equal(receipt.ownershipTransfer.currentOwner, A);
  } finally { harness.cleanup(); }
});

function ensHarness({ chainId = 1, networkName = 'mainnet', env = {}, verificationError = '' } = {}) {
  let broadcasts = 0;
  const tx = { hash: '0xensDeploy', wait: async () => ({ blockNumber: 124 }) };
  const ensPages = { getAddress: async () => B, waitForDeployment: async () => {}, deploymentTransaction: () => tx,
    setJobManager: async () => tx, transferOwnership: async () => tx };
  const provider = { getNetwork: async () => ({ chainId: BigInt(chainId) }), getCode: async () => '0x6000' };
  const mockEthers = { ...realEthers, provider, getSigners: async () => [{ address: A }],
    Contract: function (address) { return address === TOKEN ? { decimals: async () => 6 } : { usdcToken: async () => TOKEN }; },
    getContractAt: async () => ({ owner: async () => A }),
    getContractFactory: async () => ({ deploy: async () => { broadcasts += 1; return ensPages; } }),
  };
  const module = { exports: {} };
  const mockRequire = name => {
    if (name === 'hardhat') return { ethers: mockEthers, network: { name: networkName },
      run: async () => { if (verificationError) throw new Error(verificationError); } };
    if (name === './deployment-safety') return require('../scripts/deployment-safety');
    if (name === '../../scripts/lib/usdc') return require('../../scripts/lib/usdc');
    return require(name);
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/deploy-ens-job-pages.js'), 'utf8'), {
    module, exports: module.exports, require: mockRequire, process: { env: { JOB_MANAGER: B, VERIFY: '1',
      VERIFY_DELAY_MS: '0', DEPLOY_CONFIRM_MAINNET: 'I_UNDERSTAND_MAINNET_DEPLOYMENT', ...env } },
    console: { log() {}, error() {} }, setTimeout,
  });
  return { main: module.exports.main, broadcasts: () => broadcasts };
}

test('ENS deployment rejects mismatched RPC chains and unsafe confirmation counts before broadcasting', async () => {
  for (const args of [{ networkName: 'sepolia' }, { env: { CONFIRMATIONS: '0' } }, { env: { CONFIRMATIONS: '1' } }]) {
    const harness = ensHarness(args);
    await assert.rejects(harness.main(), /must use chain|integer >= 1|at least 3/);
    assert.equal(harness.broadcasts(), 0);
  }
});

test('ENS requested verification failure returns an actionable error instead of deployment success', async () => {
  const harness = ensHarness({ verificationError: 'Explorer unavailable' });
  await assert.rejects(harness.main(), /was deployed but explorer verification failed/);
  assert.equal(harness.broadcasts(), 1);
  const alreadyVerified = ensHarness({ verificationError: 'Contract has already been verified' });
  await alreadyVerified.main();
  assert.equal(alreadyVerified.broadcasts(), 1);
});

test('ENS dry-run requires no broadcast phrase and zero owner cannot be configured', async () => {
  const dryRun = ensHarness({ env: { DRY_RUN: '1', DEPLOY_CONFIRM_MAINNET: '' } });
  await dryRun.main();
  assert.equal(dryRun.broadcasts(), 0);
  const zeroOwner = ensHarness({ env: { FINAL_OWNER: ZERO } });
  await assert.rejects(zeroOwner.main(), /owner override is not a valid address/);
  assert.equal(zeroOwner.broadcasts(), 0);
});
