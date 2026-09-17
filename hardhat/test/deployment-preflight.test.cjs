const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const realEthers = require('ethers');
const { ContractAlreadyVerifiedError } = require('@nomicfoundation/hardhat-verify/internal/errors');
const temporaryFolders = new Set();
test.after(() => { for (const folder of temporaryFolders) fs.rmSync(folder, { recursive: true, force: true }); });
const hash = value => realEthers.zeroPadValue(realEthers.toBeHex(value), 32);
const { parseBooleanSetting, isAlreadyVerifiedError, requireExplorerEnabled, requireConfirmedReceipt, requireDeploymentNetwork, requireRuntimeSize, requireCode, requireOperationalUSDC, requireVerified, requireReadinessState, requireArtifactMatch } = require('../scripts/deployment-safety');

const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const A = `0x${'11'.repeat(20)}`;
const B = `0x${'22'.repeat(20)}`;
const C = `0x${'33'.repeat(20)}`;
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

function deploymentHarness({ dryRun = false, failConfirmation = false, failVerification = false, noSigner = false, deployerAddress = '', dryRunValue, verifierEnabled = true, verificationError, receiptOverride = {}, finalOwner = A } = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'agi-deployment-preflight-'));
  const scriptsDir = path.join(folder, 'scripts');
  fs.mkdirSync(scriptsDir);
  const configPath = path.join(folder, 'config.js');
  fs.writeFileSync(configPath, `module.exports = ${JSON.stringify({ mainnet: { usdcTokenAddress: TOKEN, finalOwner,
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
  const provider = { getNetwork: async () => ({ chainId: 1n }), getBlock: async tag => ({ number: tag === 'latest' ? 1000 : tag, hash: hash(tag === 'latest' ? 1000 : tag) }), getCode: async () => '0x6000',
    getTransactionReceipt: async transactionHash => { const nonce = Number(BigInt(transactionHash)); return { hash: transactionHash, status: 1, blockNumber: 123 + nonce, blockHash: hash(123 + nonce), contractAddress: `0x${String(nonce + 100).padStart(40, '0')}` }; },
    getTransaction: async () => ({ to: null, from: A, data: '0x6000' }) };
  const manager = { paused: async () => true, owner: async () => A, pendingOwner: async () => ZERO, usdcToken: async () => TOKEN };
  const mockEthers = { ...realEthers, provider, getSigners: async () => noSigner ? [] : [{ address: A }],
    Contract: function () { return token(); }, getContractAt: async () => manager,
    getContractFactory: async () => ({ getDeployTransaction: async () => ({ data: '0x6000' }), deploy: async () => {
      broadcasts += 1;
      const nonce = broadcasts;
      const address = `0x${String(nonce + 100).padStart(40, '0')}`;
      const tx = { hash: hash(nonce), wait: async () => ({ hash: hash(nonce), status: 1, blockHash: hash(123 + nonce), blockNumber: 123 + nonce, contractAddress: address, ...receiptOverride }) };
      return { getAddress: async () => address, deploymentTransaction: () => tx,
        waitForDeployment: async () => { if (failConfirmation && nonce === 2) throw new Error('Confirmation RPC failed'); } };
    } }),
  };
  const module = { exports: {} };
  const mockRequire = name => {
    if (name === 'hardhat') return { ethers: mockEthers, network: { name: 'mainnet' }, artifacts: mockArtifacts, config: { etherscan: { enabled: verifierEnabled } },
      run: async () => { if (verificationError) throw verificationError; if (failVerification) throw new Error('Explorer unavailable'); } };
    if (name === './deployment-safety') return require('../scripts/deployment-safety');
    return require(name);
  };
  mockRequire.cache = require.cache;
  const context = { module, exports: module.exports, require: mockRequire, __dirname: scriptsDir,
    process: { env: { DEPLOY_CONFIG: configPath, VERIFY_DELAY_MS: '0', DRY_RUN: dryRunValue ?? (dryRun ? '1' : ''),
      DEPLOY_CONFIRM_MAINNET: dryRun ? '' : 'I_UNDERSTAND_MAINNET_DEPLOYMENT', DEPLOYER_ADDRESS: deployerAddress }, cwd: () => folder },
    console: { log() {}, error() {} }, setTimeout };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/deploy.js'), 'utf8'), context);
  return { main: module.exports.main, broadcasts: () => broadcasts, folder, program: module.exports, hardhat: mockRequire('hardhat'),
    receiptPath: () => { const directory = path.join(folder, 'deployments', 'mainnet'); return path.join(directory, fs.readdirSync(directory).find(name => name.startsWith('deployment.') && !name.endsWith('.solc-input.json'))); },
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
    assert.equal(receipt.contracts.TransferUtils.txHash, hash(2));
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
    assert.equal(receipt.ownershipTransfer, undefined);
  } finally { harness.cleanup(); }
});

function ensHarness({ chainId = 1, networkName = 'mainnet', env = {}, verificationError, noSigner = false,
  verifierEnabled = true, failAction, finalOwnerMismatch = false } = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'agi-ens-deployment-'));
  temporaryFolders.add(folder);
  let broadcasts = 0;
  let currentOwner = A;
  let configLocked = false;
  let configuredManager = ZERO;
  const actions = [];
  const makeTx = action => {
    actions.push(action);
    const nonce = actions.length;
    return { hash: hash(nonce), wait: async () => ({ hash: hash(nonce), status: failAction === action ? 0 : 1,
      blockHash: hash(124), blockNumber: 124, contractAddress: action === 'deploy' ? B : null }) };
  };
  let deploymentTx;
  const ensPages = { getAddress: async () => B, waitForDeployment: async () => {}, deploymentTransaction: () => deploymentTx,
    setJobManager: async value => { configuredManager = value; return makeTx('setJobManager'); },
    transferOwnership: async value => { currentOwner = value; return makeTx('transferOwnership'); },
    lockConfiguration: async () => { configLocked = true; return makeTx('lockConfiguration'); },
    owner: async () => finalOwnerMismatch ? ZERO : currentOwner, jobManager: async () => configuredManager, configLocked: async () => configLocked };
  const provider = { getNetwork: async () => ({ chainId: BigInt(chainId) }), getCode: async () => '0x6000' };
  const mockEthers = { ...realEthers, provider, getSigners: async () => noSigner ? [] : [{ address: A }],
    Contract: function (address) { return address === TOKEN ? { decimals: async () => 6 } : { usdcToken: async () => TOKEN }; },
    getContractAt: async () => ({ owner: async () => A }),
    getContractFactory: async () => ({ deploy: async () => { broadcasts += 1; deploymentTx = makeTx('deploy'); return ensPages; } }),
  };
  const module = { exports: {} };
  const mockRequire = name => {
    if (name === 'hardhat') return { ethers: mockEthers, network: { name: networkName }, config: { etherscan: { enabled: verifierEnabled } },
      run: async () => { actions.push('verify'); if (verificationError) throw typeof verificationError === 'string' ? new Error(verificationError) : verificationError; } };
    if (name === './deployment-safety') return require('../scripts/deployment-safety');
    if (name === '../../scripts/lib/usdc') return require('../../scripts/lib/usdc');
    return require(name);
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/deploy-ens-job-pages.js'), 'utf8'), {
    module, exports: module.exports, require: mockRequire, __dirname: path.join(folder, 'scripts'), process: { env: { JOB_MANAGER: B, VERIFY: '1',
      VERIFY_DELAY_MS: '0', DEPLOY_CONFIRM_MAINNET: 'I_UNDERSTAND_MAINNET_DEPLOYMENT', ...env } },
    console: { log() {}, error() {} }, setTimeout,
  });
  return { main: module.exports.main, broadcasts: () => broadcasts, actions, receipt: () => {
    const directory = path.join(folder, 'deployments', networkName);
    return JSON.parse(fs.readFileSync(path.join(directory, fs.readdirSync(directory).find(name => name.endsWith('.json'))), 'utf8'));
  } };
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
  const alreadyVerified = ensHarness({ verificationError: new ContractAlreadyVerifiedError('contracts/ens/ENSJobPages.sol:ENSJobPages', B) });
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

test('boolean settings accept explicit conventional values and reject unknown text', () => {
  for (const value of ['1', 'true', 'TRUE', 'yes', 'on']) assert.equal(parseBooleanSetting(value, 'DRY_RUN'), true);
  for (const value of ['0', 'false', 'FALSE', 'no', 'off']) assert.equal(parseBooleanSetting(value, 'DRY_RUN'), false);
  for (const value of ['tru', '2', 'enabled', ' ']) assert.throws(() => parseBooleanSetting(value, 'DRY_RUN'), /must be an explicit/);
});

test('manager true-valued dry-run and malformed flags cannot broadcast', async () => {
  for (const value of ['true', 'tru']) {
    const harness = deploymentHarness({ dryRunValue: value });
    try {
      if (value === 'true') await harness.main();
      else await assert.rejects(harness.main(), /DRY_RUN must be an explicit/);
      assert.equal(harness.broadcasts(), 0);
    } finally { harness.cleanup(); }
  }
});

test('ENS rejects unrecognized dry-run, verification and locking settings before broadcasting', async () => {
  for (const key of ['DRY_RUN', 'VERIFY', 'LOCK_CONFIG']) {
    const harness = ensHarness({ env: { [key]: 'tru' } });
    await assert.rejects(harness.main(), /must be an explicit/);
    assert.equal(harness.broadcasts(), 0);
  }
});

test('only a typed Hardhat verifier result establishes an already-verified outcome', () => {
  assert.equal(isAlreadyVerifiedError(new ContractAlreadyVerifiedError('source:Manager', A)), true);
  for (const message of ['not already verified', 'failed to check whether already verified', 'Contract has already been verified']) {
    assert.equal(isAlreadyVerifiedError(new Error(message)), false);
  }
  assert.equal(isAlreadyVerifiedError({ name: 'ContractAlreadyVerifiedError', message: 'already verified' }), false);
});

test('unrelated verifier error text cannot turn manager deployment into a verified result', async () => {
  const failure = deploymentHarness({ verificationError: new Error('Unable to determine whether contract is already verified') });
  const success = deploymentHarness({ verificationError: new ContractAlreadyVerifiedError('source:Manager', A) });
  try {
    await assert.rejects(failure.main(), /verification incomplete/);
    assert.equal(failure.receipt().verification.AGIJobManager.status, 'failed');
    await success.main();
    assert.equal(success.receipt().verification.AGIJobManager.status, 'already_verified');
  } finally { failure.cleanup(); success.cleanup(); }
});

test('disabled explorer verification cannot silently pass a requested verification', async () => {
  assert.throws(() => requireExplorerEnabled({ etherscan: { enabled: false } }), /must be enabled/);
  const manager = deploymentHarness({ verifierEnabled: false });
  const ens = ensHarness({ verifierEnabled: false });
  try {
    await assert.rejects(manager.main(), /must be enabled/);
    await assert.rejects(ens.main(), /must be enabled/);
    assert.equal(manager.broadcasts(), 0);
    assert.equal(ens.broadcasts(), 0);
  } finally { manager.cleanup(); }
});

test('receipt validation rejects failure, missing confirmations and mismatched transaction identity', () => {
  const receipt = { hash: hash(1), status: 1, blockNumber: 10, blockHash: hash(10), contractAddress: A };
  requireConfirmedReceipt(receipt, hash(1), A);
  for (const value of [null, { ...receipt, status: 0 }, { ...receipt, blockNumber: undefined }]) {
    assert.throws(() => requireConfirmedReceipt(value, hash(1), A), /no successful mined receipt/);
  }
  assert.throws(() => requireConfirmedReceipt({ ...receipt, hash: hash(2) }, hash(1), A), /identity is inconsistent/);
  assert.throws(() => requireConfirmedReceipt({ ...receipt, blockHash: null }, hash(1), A), /identity is inconsistent/);
  assert.throws(() => requireConfirmedReceipt({ ...receipt, contractAddress: B }, hash(1), A), /unexpected contract address/);
});

test('manager stops on unsuccessful mined receipt and preserves the pending transaction identity', async () => {
  const harness = deploymentHarness({ receiptOverride: { status: 0 } });
  try {
    await assert.rejects(harness.main(), /no successful mined receipt/);
    assert.equal(harness.broadcasts(), 1);
    assert.equal(harness.receipt().contracts.UriUtils.txHash, hash(1));
    assert.equal(harness.receipt().status, 'failed');
  } finally { harness.cleanup(); }
});

test('ENS verifies before irreversible locking and ownership handoff and preserves the final receipt', async () => {
  const harness = ensHarness({ env: { LOCK_CONFIG: '1', FINAL_OWNER: C } });
  await harness.main();
  assert.deepEqual(harness.actions, ['deploy', 'setJobManager', 'verify', 'lockConfiguration', 'transferOwnership']);
  const receipt = harness.receipt();
  assert.equal(receipt.status, 'configured');
  assert.equal(receipt.currentOwner, C);
  assert.equal(receipt.configLocked, true);
  assert.equal(receipt.verification.status, 'verified');
  assert.equal(receipt.transactions.length, 4);
});

test('ENS verifier outage leaves locking and ownership untouched with a recoverable journal', async () => {
  const harness = ensHarness({ env: { LOCK_CONFIG: '1', FINAL_OWNER: C }, verificationError: 'not already verified; explorer unavailable' });
  await assert.rejects(harness.main(), /was deployed but explorer verification failed/);
  assert.deepEqual(harness.actions, ['deploy', 'setJobManager', 'verify']);
  const receipt = harness.receipt();
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.address, B);
  assert.equal(receipt.verification.status, 'failed');
  assert.equal(receipt.transactions[0].txHash, hash(1));
});

test('ENS transaction failures and wrong final owner cannot be reported as configured', async () => {
  const failedTransaction = ensHarness({ failAction: 'setJobManager' });
  await assert.rejects(failedTransaction.main(), /no successful mined receipt/);
  assert.equal(failedTransaction.receipt().transactions[1].status, 'broadcast');
  assert.equal(failedTransaction.receipt().status, 'failed');
  const wrongOwner = ensHarness({ finalOwnerMismatch: true });
  await assert.rejects(wrongOwner.main(), /final configuration did not match/);
  assert.equal(wrongOwner.receipt().status, 'failed');
});

test('ENS read-only plan works without a key while public-network writes still need a signer', async () => {
  const readOnly = ensHarness({ noSigner: true, env: { DRY_RUN: 'true', DEPLOYER_ADDRESS: A } });
  await readOnly.main();
  assert.equal(readOnly.broadcasts(), 0);
  const missingSigner = ensHarness({ noSigner: true, env: { DEPLOYER_ADDRESS: A } });
  await assert.rejects(missingSigner.main(), /deployer account is required/);
  assert.equal(missingSigner.broadcasts(), 0);
});

test('ENS cannot transfer ownership to the USDC token or a configured protocol dependency', async () => {
  for (const finalOwner of [TOKEN, B, '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e', '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401']) {
    const harness = ensHarness({ env: { FINAL_OWNER: finalOwner } });
    await assert.rejects(harness.main(), /owner cannot be a configured protocol dependency/);
    assert.equal(harness.broadcasts(), 0);
  }
});

function recoveryHarness(deployment, { failVerification = false } = {}) {
  const module = { exports: {} };
  const verificationCalls = [];
  const hardhat = { ...deployment.hardhat, getSigners: undefined };
  const mockRequire = name => {
    if (name === 'hardhat') return hardhat;
    if (name === './deployment-safety') return require('../scripts/deployment-safety');
    if (name === '../../scripts/lib/usdc') return require('../../scripts/lib/usdc');
    if (name === './deploy') return { ...deployment.program, verifyWithRetry: async params => {
      verificationCalls.push(params.name); return { contract: params.name, status: failVerification ? 'failed' : 'verified', attempts: 1, error: failVerification ? 'Explorer unavailable' : null };
    } };
    return require(name);
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/reverify-deployment.js'), 'utf8'), {
    module, exports: module.exports, require: mockRequire, process: { env: { DEPLOYMENT_RECEIPT: deployment.receiptPath(), VERIFY_DELAY_MS: '0' }, cwd: () => deployment.folder },
    console: { log() {}, error() {} },
  });
  const recoveredPath = () => deployment.receiptPath().replace(/\.json$/, '') + '.reverified.1000.json';
  return { main: module.exports.main, verificationCalls, recoveredPath,
    recovered: () => JSON.parse(fs.readFileSync(recoveredPath(), 'utf8')) };
}

test('verification recovery reconciles receipts and runtime without redeployment or modifying the original journal', async () => {
  const deployment = deploymentHarness({ failVerification: true });
  try {
    await assert.rejects(deployment.main(), /verification incomplete/);
    const original = fs.readFileSync(deployment.receiptPath());
    const recovery = recoveryHarness(deployment);
    await recovery.main();
    const recovered = recovery.recovered();
    assert.equal(deployment.broadcasts(), 6);
    assert.deepEqual(fs.readFileSync(deployment.receiptPath()), original);
    assert.equal(recovered.status, 'awaiting_readiness_review');
    assert.equal(recovered.recovery.blockchainTransactionsBroadcast, 0);
    assert.equal(recovered.ownershipTransfer.accepted, true);
    assert.equal(recovery.verificationCalls.length, 6);
    assert.match(recovered.configHash, /^0x[a-f0-9]{64}$/);
    await assert.rejects(recovery.main(), /EEXIST/);
  } finally { deployment.cleanup(); }
});

test('verification recovery preserves the need for explicit ownership proposal and acceptance', async () => {
  const deployment = deploymentHarness({ failVerification: true, finalOwner: C });
  try {
    await assert.rejects(deployment.main(), /verification incomplete/);
    const recovery = recoveryHarness(deployment);
    await recovery.main();
    assert.equal(deployment.broadcasts(), 6);
    assert.equal(recovery.recovered().ownershipTransfer.proposalRequired, true);
    assert.equal(recovery.recovered().ownershipTransfer.acceptanceRequired, true);
    assert.equal(recovery.recovered().ownershipTransfer.currentOwner, A);
  } finally { deployment.cleanup(); }
});

test('verification recovery refuses reverted, noncanonical, underconfirmed or changed deployed code', async () => {
  const scenarios = [
    [runtime => { runtime.ethers.provider.getTransactionReceipt = async transactionHash => ({ hash: transactionHash, status: 0 }); }, /no successful mined receipt/],
    [runtime => { runtime.ethers.provider.getCode = async () => '0x6001'; }, /runtime differs/],
    [runtime => { runtime.ethers.provider.getTransaction = async () => ({ to: null, from: C, data: '0x6000' }); }, /creation transaction differs/],
    [runtime => { runtime.ethers.provider.getTransaction = async () => ({ to: null, from: A, data: '0x6001' }); }, /creation transaction differs/],
    [runtime => { runtime.ethers.provider.getBlock = async tag => ({ number: tag === 'latest' ? 124 : tag, hash: hash(tag === 'latest' ? 124 : tag) }); }, /not sufficiently confirmed/],
    [runtime => { runtime.ethers.provider.getBlock = async tag => ({ number: tag === 'latest' ? 1000 : tag, hash: hash(1000) }); }, /not in the canonical chain/],
  ];
  for (const [mutate, message] of scenarios) {
    const deployment = deploymentHarness({ failVerification: true });
    try {
      await assert.rejects(deployment.main(), /verification incomplete/);
      mutate(deployment.hardhat);
      const recovery = recoveryHarness(deployment);
      await assert.rejects(recovery.main(), message);
      assert.equal(recovery.verificationCalls.length, 0);
      assert.equal(fs.existsSync(recovery.recoveredPath()), false);
    } finally { deployment.cleanup(); }
  }
});

test('verification recovery refuses incomplete journals and never converts a repeated explorer failure to success', async () => {
  const incomplete = deploymentHarness({ failConfirmation: true });
  const outage = deploymentHarness({ failVerification: true });
  try {
    await assert.rejects(incomplete.main(), /Confirmation RPC failed/);
    await assert.rejects(recoveryHarness(incomplete).main(), /link differs|journal lacks/);
    await assert.rejects(outage.main(), /verification incomplete/);
    const recovery = recoveryHarness(outage, { failVerification: true });
    await assert.rejects(recovery.main(), /verification incomplete/);
    assert.equal(outage.broadcasts(), 6);
    assert.equal(fs.existsSync(recovery.recoveredPath()), false);
  } finally { incomplete.cleanup(); outage.cleanup(); }
});
