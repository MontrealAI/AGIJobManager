const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const realEthers = require('ethers');
const compilerOptimizer = require('../compiler-optimizer.cjs').optimizer;
const temporaryFolders = new Set();
test.after(() => { for (const folder of temporaryFolders) fs.rmSync(folder, { recursive: true, force: true }); });
const hash = value => realEthers.zeroPadValue(realEthers.toBeHex(value), 32);
const { describeMembershipConfig, parseBooleanSetting, requireExplorerEnabled, requireConfirmedReceipt, requireDeploymentNetwork, requireRuntimeSize, requireInitcodeSize, prepareDeployment, requireCode, requireOperationalUSDC, requireVerified, requireReadinessState, requireArtifactMatch } = require('../scripts/deployment-safety.cjs');

const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const A = `0x${'11'.repeat(20)}`;
const B = `0x${'22'.repeat(20)}`;
const C = `0x${'33'.repeat(20)}`;
const D = `0x${'44'.repeat(20)}`;
const ZERO = `0x${'00'.repeat(20)}`;
const state = () => ({ owner: A, finalOwner: A, pendingOwner: ZERO, paused: true, settlementPaused: false,
  wallets: [A, B], expectedWallets: [A, B], reserves: [0n, 0n, 0n, 0n, 0n], balance: 0n });
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

test('runtime checks distinguish compiler link templates from canonical deployed bytes', () => {
  const placeholder = `__$${'a'.repeat(34)}$__`;
  for (const malformed of ['0xzz', '0x60__bad-template__00', `0x${placeholder}`]) {
    assert.throws(() => requireRuntimeSize('observed-runtime', malformed), /malformed/);
  }
  assert.equal(requireRuntimeSize('compiler-template', `0x60${placeholder}00`, { allowUnlinked: true }), 22);
  for (const malformed of ['0xzz', '0x60__bad-template__00', `0x60__$${'g'.repeat(34)}$__00`]) {
    assert.throws(() => requireRuntimeSize('compiler-template', malformed, { allowUnlinked: true }), /malformed/);
  }
});

test('artifact matching cannot treat an unresolved link template as observed runtime', () => {
  const code = `0x60__$${'a'.repeat(34)}$__00`;
  const artifact = { sourceName: 'Synthetic.sol', contractName: 'Synthetic', deployedBytecode: code };
  const buildInfo = { output: { contracts: { 'Synthetic.sol': { Synthetic: { evm: { deployedBytecode: { immutableReferences: {} } } } } } } };
  assert.throws(() => requireArtifactMatch({ artifact, buildInfo, code }), /malformed/);
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
  assert.throws(() => requireReadinessState({ ...state(), reserves: [1n, 0n, 0n, 0n, 0n] }), /below reserved/);
  assert.throws(() => requireReadinessState({ ...state(), reserves: [0n, 0n, 1n, 0n, 0n], balance: 1n }), /no existing job/);
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

function deploymentHarness({ dryRun = false, failConfirmation = false, failConfirmationAt = 2, failManagerRuntimeRead = false, failVerification = false, noSigner = false, deployerAddress = '', dryRunValue, verifierEnabled = true, verificationError, verificationResult = true, estimatedGas = 100000n, creationData = '0x6000', receiptOverride = {}, finalOwner = A, initialNftRequired = false, optimizer = compilerOptimizer } = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'agi-deployment-preflight-'));
  const scriptsDir = path.join(folder, 'scripts');
  fs.mkdirSync(scriptsDir);
  const configPath = path.join(folder, 'config.cjs');
  fs.writeFileSync(configPath, `module.exports = ${JSON.stringify({ mainnet: { usdcTokenAddress: TOKEN, finalOwner, creator: {address:A,transactionMode:'eoa-create'},
    baseIpfsUrl: 'ipfs://', ensConfig: [D, ZERO], rootNodes: Array(4).fill(`0x${'00'.repeat(32)}`),
    merkleRoots: Array(2).fill(`0x${'00'.repeat(32)}`), settlementWallets: [A, B] } })}`);
  let broadcasts = 0;
  const logs = [];
  let managerRuntimeReadFailed = false;
  const managerAbi = ['function usdcToken() view returns(address)','function owner() view returns(address)',
    'function pendingOwner() view returns(address)','function paused() view returns(bool)',
    'function moderators(address) view returns(bool)','function additionalAgents(address) view returns(bool)',
    'function additionalValidators(address) view returns(bool)','function ensJobPages() view returns(address)',
    'function useEnsJobTokenURI() view returns(bool)',
    {type:'constructor',inputs:['address','string','address[2]','bytes32[4]','bytes32[2]','address[2]','address'].map(type=>({type})),stateMutability:'nonpayable'}];
  const input = { settings: { optimizer: structuredClone(optimizer), evmVersion: 'shanghai', viaIR: true,
    metadata: { bytecodeHash: 'none' }, debug: { revertStrings: 'strip' } } };
  const buildInfo = { solcVersion: '0.8.37', solcLongVersion: '0.8.37+commit.f401782d', input, output: { contracts: {} } };
  const mockArtifacts = {
    getBuildInfo: async () => buildInfo,
    readArtifact: async fqn => {
      const [sourceName, contractName] = fqn.split(':');
      buildInfo.output.contracts[sourceName] ||= {};
      buildInfo.output.contracts[sourceName][contractName] = { evm: { bytecode: { object: '6000' }, deployedBytecode: { object: '6000', immutableReferences: {} } } };
      return { sourceName, contractName, bytecode: '0x6000', deployedBytecode: '0x6000', deployedLinkReferences: {}, abi:managerAbi };
    },
  };
  const provider = { getNetwork: async () => ({ chainId: 1n }), getBlock: async tag => ({ number: tag === 'latest' ? 1000 : tag, hash: hash(tag === 'latest' ? 1000 : tag) }), getBlockNumber: async()=>1000, getTransactionCount: async()=>broadcasts, estimateGas: async () => estimatedGas, getCode: async address => {
      if(address.toLowerCase()===A.toLowerCase()) return '0x';
      if (failManagerRuntimeRead && broadcasts === 9 && !managerRuntimeReadFailed) {
        managerRuntimeReadFailed = true;
        throw new Error('Manager runtime RPC failed');
      }
      return '0x6000';
    },
    getTransactionReceipt: async transactionHash => { const nonce = Number(BigInt(transactionHash)); return { hash: transactionHash, status: 1, blockNumber: 123 + nonce, blockHash: hash(123 + nonce), contractAddress: realEthers.getCreateAddress({from:A,nonce:nonce-1}) }; },
    getTransaction: async transactionHash => ({hash:transactionHash,to:null,from:A,data:creationData,chainId:1,nonce:Number(BigInt(transactionHash))-1,value:0n,gasLimit:120000n}) };
  const manager = { agentNftRequired: async () => initialNftRequired, paused: async () => true, owner: async () => finalOwner, moderators:async()=>false, additionalAgents:async()=>false, additionalValidators:async()=>false, ensJobPages:async()=>ZERO, useEnsJobTokenURI:async()=>false, pendingOwner: async () => ZERO, usdcToken: async () => TOKEN };
  provider.send = async (method, params) => {
    assert.deepEqual(params.at(-1), {blockHash:hash(1000),requireCanonical:true});
    if (method==='eth_getCode') return provider.getCode(params[0],params[1]);
    assert.equal(method,'eth_call');
    const isToken = params[0].to.toLowerCase() === TOKEN.toLowerCase();
    const iface = new realEthers.Interface(isToken ? require('../scripts/deployment-safety.cjs').USDC_ABI : managerAbi);
    const parsed = iface.parseTransaction(params[0]);
    return iface.encodeFunctionResult(parsed.name, [await (isToken ? token() : manager)[parsed.name](...parsed.args)]);
  };
  const mockEthers = { ...realEthers, provider, getSigners: async () => noSigner ? [] : [{ address: A }],
    Contract: function () { return token(); }, getContractAt: async () => manager,
    getContractFactory: async () => ({ runner: { getAddress: async () => A }, getDeployTransaction: async () => ({ data: creationData }), deploy: async (...args) => {
      assert.ok(args.at(-1).gasLimit <= 16777216n);
      broadcasts += 1;
      const nonce = broadcasts;
      const address = realEthers.getCreateAddress({from:A,nonce:nonce-1});
      const tx = { from:A,to:null,data:creationData,chainId:1,nonce:nonce-1,value:0n,gasLimit:args.at(-1).gasLimit, hash: hash(nonce), wait: async () => ({ hash: hash(nonce), status: 1, gasUsed: 100000n, blockHash: hash(123 + nonce), blockNumber: 123 + nonce, contractAddress: address, ...receiptOverride }) };
      return { getAddress: async () => address, deploymentTransaction: () => tx,
        waitForDeployment: async () => { if (failConfirmation && nonce === failConfirmationAt) throw new Error('Confirmation RPC failed'); } };
    } }),
  };
  const module = { exports: {} };
  const mockRequire = name => {
    if (name === 'hardhat') return { ethers: mockEthers, network: { name: 'mainnet' }, artifacts: mockArtifacts, config: { verify: { etherscan: { enabled: verifierEnabled, apiKey: 'test-key' } } },
      run: async (task, params) => { logs.push(['verifier call',params]); if (verificationError) throw verificationError; if (failVerification) throw new Error('Explorer unavailable'); return verificationResult; } };
    if (name === './governance-deployment.cjs') return require('../scripts/governance-deployment.cjs');
    if (name === './creator-transaction.cjs') return require('../scripts/creator-transaction.cjs');
    if (name === './runtime.cjs') return { getRuntime: async () => mockRequire('hardhat') };
    if (name === './deployment-safety.cjs') return require('../scripts/deployment-safety.cjs');
    if (name === './canonical-state.cjs') return require('../scripts/canonical-state.cjs');
    return require(name);
  };
  mockRequire.cache = require.cache;
  const context = { module, exports: module.exports, require: mockRequire, __dirname: scriptsDir,
    process: { env: { DEPLOY_CONFIG: configPath, DEPLOYMENT_LOCK_DIRECTORY:folder, VERIFY_DELAY_MS: '0', DRY_RUN: dryRunValue ?? (dryRun ? '1' : '0'),
      DEPLOY_CONFIRM_MAINNET: dryRun ? '' : 'I_UNDERSTAND_MAINNET_DEPLOYMENT', DEPLOYER_ADDRESS: deployerAddress }, cwd: () => folder },
    console: { log: (...args) => logs.push(args), error() {} }, setTimeout };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/deploy.cjs'), 'utf8'), context);
  return { main: module.exports.main, broadcasts: () => broadcasts, folder, configPath, env: context.process.env, logs, program: module.exports, hardhat: mockRequire('hardhat'),
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
    assert.throws(() => harness.constructor('mainnet', { ...harness.profile, settlementWallets: [A, D] }), /cannot be configured ENS dependencies/);
  } finally { harness.cleanup(); }
});

test('mainnet dry-run validates the full plan without confirmation phrase, files or broadcasts', async () => {
  const harness = deploymentHarness({ dryRun: true });
  try {
    await harness.main();
    assert.equal(harness.broadcasts(), 0);
    assert.equal(fs.existsSync(path.join(harness.folder, 'deployments')), false);
    const plan = JSON.parse(harness.logs.find(args => typeof args[0] === 'string' && args[0].startsWith('{'))[0]);
    assert.equal(plan.finalOwnerSource, 'deployment config profile');
    assert.equal(plan.membership.roots.length, 4);
    assert.equal(plan.membership.merkleExceptions.every(value => value.enabled === false), true);
  } finally { harness.cleanup(); }
});

test('default manager setup requires the reviewed config and never silently uses the example', async () => {
  const harness = deploymentHarness({ dryRun: true });
  try {
    harness.env.DEPLOY_CONFIG = '';
    fs.copyFileSync(harness.configPath, path.join(harness.folder, 'deploy.config.example.cjs'));
    await assert.rejects(harness.main(), /Copy hardhat\/deploy.config.example.cjs.*example is never selected automatically/);
    assert.equal(harness.broadcasts(), 0);
    fs.copyFileSync(harness.configPath, path.join(harness.folder, 'deploy.config.cjs'));
    await harness.main();
    assert.equal(harness.broadcasts(), 0);
  } finally { harness.cleanup(); }
});

test('manager reports malformed config exports and missing owner before broadcasting', async () => {
  for (const config of ['null', '[]', JSON.stringify({ mainnet: { ...deploymentProfile(), finalOwner: '' } })]) {
    const harness = deploymentHarness({ dryRun: true });
    try {
      fs.writeFileSync(harness.configPath, `module.exports = ${config}`);
      await assert.rejects(harness.main(), /config must export an object|Unable to resolve finalOwner/);
      assert.equal(harness.broadcasts(), 0);
    } finally { harness.cleanup(); }
  }
});

function deploymentProfile() {
  return { creator:{address:A,transactionMode:'eoa-create'}, usdcTokenAddress: TOKEN, finalOwner: A, baseIpfsUrl: 'ipfs://', ensConfig: [D, ZERO],
    rootNodes: Array(4).fill(realEthers.ZeroHash), merkleRoots: Array(2).fill(realEthers.ZeroHash), settlementWallets: [A, B] };
}

test('manager rejects a configured dependency as owner and identifies an explicit owner override', async () => {
  const harness = deploymentHarness({ dryRun: true });
  try {
    for (const owner of [TOKEN, D]) {
      harness.env.FINAL_OWNER = owner;
      await assert.rejects(harness.main(), /finalOwner cannot be the USDC token or a configured ENS dependency/);
      assert.equal(harness.broadcasts(), 0);
    }
    harness.env.FINAL_OWNER = C;
    await harness.main();
    const plan = JSON.parse(harness.logs.find(args => typeof args[0] === 'string' && args[0].startsWith('{'))[0]);
    assert.equal(plan.finalOwner, C);
    assert.equal(plan.finalOwnerSource, 'FINAL_OWNER environment setting');
  } finally { harness.cleanup(); }
});

test('example preserves canonical and alpha membership roots without historical owner or Merkle defaults', () => {
  const example = require('../deploy.config.example.cjs');
  const names = ['club.agi.eth', 'agent.agi.eth', 'alpha.club.agi.eth', 'alpha.agent.agi.eth'];
  assert.deepEqual(example.mainnet.rootNodes, names.map(realEthers.namehash));
  assert.deepEqual(example.mainnet.merkleRoots, [realEthers.ZeroHash, realEthers.ZeroHash]);
  for (const profile of [example.mainnet, example.sepolia]) {
    assert.equal(profile.finalOwner, '');
    assert.deepEqual(profile.settlementWallets, ['', '']);
  }
  assert.deepEqual(example.sepolia.ensConfig, ['', '']);
  assert.match(fs.readFileSync(path.join(__dirname, '../.env.example'), 'utf8'), /^FINAL_OWNER=$/m);
  const summary = describeMembershipConfig(example.mainnet);
  assert.deepEqual(summary.roots.map(root => root.name), names);
  assert.match(summary.authorization, /alternative admission paths/);
  assert.match(summary.scope, /Identity locking does not disable/);
  const custom = describeMembershipConfig({ rootNodes: [hash(1), realEthers.ZeroHash, hash(3), hash(4)], merkleRoots: [hash(5), realEthers.ZeroHash] });
  assert.equal(custom.roots[0].name, null);
  assert.equal(custom.roots[1].enabled, false);
  assert.deepEqual(custom.merkleExceptions.map(root => root.enabled), [true, false]);
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
    assert.equal(harness.broadcasts(), 9);
    assert.equal(receipt.status, 'failed');
    assert.equal(receipt.intakePaused, true);
    assert.equal(receipt.verification.AGIJobManager.status, 'failed');
    assert.equal(receipt.verification.AGIJobManager.attempts, 3);
    assert.equal(receipt.ownershipTransfer, undefined);
  } finally { harness.cleanup(); }
});

function ensHarness({ chainId = 1, networkName = 'mainnet', env = {}, verificationError, noSigner = false,
  verifierEnabled = true, verificationResult = true, estimatedGas = 100000n, creationData = '0x6000', runtimeCode = '0x6000', failAction, finalOwnerMismatch = false,
  managerPendingOwner = ZERO, managerIntakePaused = true, missingBuildInfo = false, artifactMismatch = false,
  compilerVersion = '0.8.37', optimizer = compilerOptimizer, observedRuntimeCode = '0x6000', previousHelper = ZERO, nextJobId = 0n,
  rootOwner = previousHelper, rootResolver = ZERO, previousManager = B, previousRoot = 'usdc-v092.alpha.jobs.agi.eth',
  previousPrefix = 'agijob', previousRootNode, previousRegistry = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
  finalPrefixMismatch = false, managerOwner = C } = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'agi-ens-deployment-')); temporaryFolders.add(folder);
  const helperAddress=realEthers.getCreateAddress({from:A,nonce:2}),actions=[];
  let broadcasts=0, constructorArgs, deploymentTx;
  const abi=['constructor(address,address,address,bytes32,string,address)',
    ...['owner','jobManager','ens','nameWrapper','publicResolver'].map(name=>`function ${name}() view returns(address)`),
    'function jobsRootName() view returns(string)','function jobsRootNode() view returns(bytes32)','function jobLabelPrefix() view returns(string)',
    'function useEnsJobTokenURI() view returns(bool)','function configLocked() view returns(bool)'];
  const helperValues=()=>({owner:finalOwnerMismatch?ZERO:constructorArgs[5],jobManager:ZERO,ens:constructorArgs[0],nameWrapper:constructorArgs[1],publicResolver:constructorArgs[2],jobsRootNode:constructorArgs[3],jobsRootName:constructorArgs[4],jobLabelPrefix:finalPrefixMismatch?'unexpected-':'agijob',useEnsJobTokenURI:false,configLocked:false});
  const managerToken=chainId===11155111?'0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238':TOKEN;
  const managerValues={usdcToken:managerToken,ensJobPages:previousHelper,nextJobId,owner:managerOwner,pendingOwner:managerPendingOwner,paused:managerIntakePaused};
  const managerAbi=['function usdcToken() view returns(address)','function ensJobPages() view returns(address)','function nextJobId() view returns(uint256)','function owner() view returns(address)','function pendingOwner() view returns(address)','function paused() view returns(bool)'];
  const registryAbi=['function owner(bytes32) view returns(address)','function resolver(bytes32) view returns(address)'];
  const receipt=()=>({hash:hash(1),gasUsed:100000n,status:failAction==='deploy'?0:1,blockHash:hash(124),blockNumber:124,contractAddress:helperAddress});
  const provider={getNetwork:async()=>({chainId:BigInt(chainId)}),estimateGas:async()=>estimatedGas,
    getCode:async address=>address===A?'0x':observedRuntimeCode,getTransactionCount:async()=>2,
    getTransactionReceipt:async()=>receipt(),getTransaction:async()=>deploymentTx,
    send:async(method,params)=>{
      if(method==='eth_chainId')return realEthers.toQuantity(chainId);
      if(method==='eth_getBlockByNumber')return {number:params[0]==='latest'?'0x7e':params[0],hash:hash(124)};
      if(method==='eth_getCode')return params[0]===A?'0x':observedRuntimeCode;
      if(method==='eth_call'){
        const address=params[0].to,iface=new realEthers.Interface(address===helperAddress?abi:address===B?managerAbi:registryAbi);
        const call=iface.parseTransaction({data:params[0].data});
        const value=address===helperAddress?helperValues()[call.name]:address===B?managerValues[call.name]:call.name==='owner'?rootOwner:rootResolver;
        return iface.encodeFunctionResult(call.fragment,[value]);
      }throw Error('Unexpected RPC '+method);
    }};
  const factory={getDeployTransaction:async(...args)=>({data:realEthers.concat([creationData,new realEthers.Interface(abi).encodeDeploy(args)])}),connect(){return this;},deploy:async(...args)=>{
    const overrides=args.pop();constructorArgs=args;assert.equal(overrides.nonce,2);assert(overrides.gasLimit<=16777216n);broadcasts++;actions.push('deploy');
    deploymentTx={hash:hash(1),from:A,to:null,nonce:2,chainId:BigInt(chainId),value:0n,gasLimit:overrides.gasLimit,data:(await factory.getDeployTransaction(...args)).data,wait:async()=>receipt()};
    return {deploymentTransaction:()=>deploymentTx,getAddress:async()=>helperAddress};
  }};
  const mockEthers={...realEthers,provider,getSigners:async()=>noSigner?[]:[{address:A,getAddress:async()=>A}],
    Contract:function(address){
      if(address===managerToken)return {decimals:async()=>6};
      if(address===previousHelper&&previousHelper!==ZERO)return {jobManager:async()=>previousManager,jobsRootName:async()=>previousRoot,jobsRootNode:async()=>previousRootNode||realEthers.namehash(previousRoot),jobLabelPrefix:async()=>previousPrefix,ens:async()=>previousRegistry};
      return Object.fromEntries(Object.entries(managerValues).map(([key,value])=>[key,async()=>value]));
    },getContractAt:async(_abi,address)=>({getAddress:async()=>address,owner:async()=>rootOwner,resolver:async()=>rootResolver}),getContractFactory:async()=>factory};
  const artifact={sourceName:'contracts/ens/ENSJobPages.sol',contractName:'ENSJobPages',abi,bytecode:creationData,deployedBytecode:runtimeCode};
  const buildInfo={solcVersion:compilerVersion,solcLongVersion:'fixture',input:{language:'Solidity',sources:{[artifact.sourceName]:{content:'// reviewed fixture'}},settings:{optimizer: structuredClone(optimizer),evmVersion:'shanghai',viaIR:true,metadata:{bytecodeHash:'none'},debug:{revertStrings:'strip'}}},output:{contracts:{[artifact.sourceName]:{ENSJobPages:{abi,evm:{bytecode:{object:artifactMismatch?'6001':creationData.slice(2)},deployedBytecode:{object:runtimeCode.slice(2)}}}}}}};
  const hardhat={ethers:mockEthers,network:{name:networkName},artifacts:{readArtifact:async()=>artifact,getBuildInfo:async()=>missingBuildInfo?undefined:buildInfo},config:{verify:{etherscan:{enabled:verifierEnabled,apiKey:'test-key'}}},run:async()=>{actions.push('verify');if(verificationError)throw typeof verificationError==='string'?new Error(verificationError):verificationError;return verificationResult;}};
  const mockRequire=name=>name==='./runtime.cjs'?{getRuntime:async()=>hardhat}:name.startsWith('./')?require(path.join(__dirname,'../scripts',name)):name==='../../scripts/lib/usdc'?require('../../scripts/lib/usdc'):require(name);
  const module={exports:{}};
  const locks=path.join(folder,'locks');fs.mkdirSync(locks);
  let buildDigest='a'.repeat(64);try{buildDigest=require('../scripts/deploy-job-pages.cjs').qualifiedArtifact(artifact,buildInfo,'contracts/ens/ENSJobPages.sol:ENSJobPages',['address','address','address','bytes32','string','address']);}catch{}
  const environment={JOB_MANAGER:B,VERIFY:'1',FINAL_OWNER:C,DEPLOYER_ADDRESS:A,CREATOR_TRANSACTION_MODE:'eoa-create',ENS_JOURNAL:path.join(folder,'ens.json'),DEPLOYMENT_LOCK_DIRECTORY:locks,ENS_BUILD_DIGEST:buildDigest,ENS_MANAGER_CODE_HASH:realEthers.keccak256(observedRuntimeCode),DRY_RUN:'0',VERIFY_DELAY_MS:'0',DEPLOY_CONFIRM_MAINNET:'I_UNDERSTAND_MAINNET_DEPLOYMENT',...env};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../scripts/deploy-ens-job-pages.cjs'),'utf8'),{module,exports:module.exports,require:mockRequire,__dirname:path.join(folder,'scripts'),process:{env:environment},console:{log(){},error(){}},setTimeout,Buffer});
  return {main:module.exports.main,broadcasts:()=>broadcasts,actions,receipt:()=>JSON.parse(fs.readFileSync(environment.ENS_JOURNAL,'utf8')),environment,hardhat,folder};
}

test('ENS deployment derives a fresh namespace from chain and full manager address and sets job- prefix', async () => {
  const harness = ensHarness({ env: { JOBS_ROOT_NAME: '' } });
  await harness.main();
  const plan = harness.receipt().namespace;
  assert.equal(plan.jobsRootName, `usdc-1-${B.slice(2)}.alpha.jobs.agi.eth`);
  assert.equal(plan.exampleJobName, `job-0.${plan.jobsRootName}`);
  assert.equal(plan.jobsRootNode, realEthers.namehash(plan.jobsRootName));
  assert.equal(plan.jobLabelPrefix, 'job-');
});

test('ENS deployment requires a reviewed owner, enabled verification and an accepted paused manager', async () => {
  for (const [options, message] of [
    [{ env: { FINAL_OWNER: '', NEW_OWNER: '' } }, /Set NEW_OWNER or FINAL_OWNER/],
    [{ env: { VERIFY: 'false' } }, /Explorer verification is required/],
    [{ managerPendingOwner: C }, /pending ownership acceptance/],
    [{ managerIntakePaused: false }, /must already have paused intake/],
  ]) {
    const harness = ensHarness(options);
    await assert.rejects(harness.main(), message);
    assert.equal(harness.broadcasts(), 0);
  }
  const defaultVerification = ensHarness({ env: { VERIFY: '' } });
  await defaultVerification.main();
  assert.equal(defaultVerification.receipt().verification.status, 'verified');
  assert.equal(defaultVerification.receipt().currentOwner, C);
});

test('Sepolia ENS requires network-specific contracts and accepts an explicit unwrapped-root plan', async () => {
  for (const env of [{}, { ENS_REGISTRY: A }, { ENS_REGISTRY: A, NAME_WRAPPER: ZERO }]) {
    const harness = ensHarness({ chainId: 11155111, networkName: 'sepolia', env: { DRY_RUN: '1', ...env } });
    await assert.rejects(harness.main(), /is required on sepolia/);
    assert.equal(harness.broadcasts(), 0);
  }
  const complete = ensHarness({ chainId: 11155111, networkName: 'sepolia', env: {
    DRY_RUN: '1', ENS_REGISTRY: D, NAME_WRAPPER: ZERO, PUBLIC_RESOLVER: D,
  } });
  await complete.main();
  assert.equal(complete.broadcasts(), 0);
});

test('ENS deployment refuses the legacy manager namespace for a fresh mainnet USDC manager', async () => {
  const harness = ensHarness({ env: { JOBS_ROOT_NAME: 'alpha.jobs.agi.eth' } });
  await assert.rejects(harness.main(), /Historical namespaces must not be reused/);
  assert.equal(harness.broadcasts(), 0);
});

test('ENS deployment rejects mismatched RPC chains and unsafe confirmation counts before broadcasting', async () => {
  for (const args of [{ networkName: 'sepolia' }, { env: { CONFIRMATIONS: '0' } }, { env: { CONFIRMATIONS: '1' } }]) {
    const harness = ensHarness(args);
    await assert.rejects(harness.main(), /must use chain|integer >= 1|at least 3/);
    assert.equal(harness.broadcasts(), 0);
  }
});

test('ENS requested verification failure returns an actionable error instead of deployment success', async () => {
  const harness = ensHarness({ verificationError: 'Explorer unavailable' });
  await assert.rejects(harness.main(), /creation or verification incomplete/);
  assert.equal(harness.broadcasts(), 1);
  const successful = ensHarness({ verificationResult: true });
  await successful.main();
  assert.equal(successful.broadcasts(), 1);
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

test('unset and empty deployment modes never broadcast even with a signer and mainnet confirmation', async () => {
  for (const value of [undefined, '']) {
    const manager = deploymentHarness();
    if (value === undefined) delete manager.env.DRY_RUN;
    else manager.env.DRY_RUN = value;
    const helper = ensHarness({ env: { DRY_RUN: value } });
    try {
      await manager.main();
      await helper.main();
      assert.equal(manager.broadcasts(), 0);
      assert.equal(helper.broadcasts(), 0);
      assert.deepEqual(helper.actions, []);
      assert.equal(fs.existsSync(path.join(manager.folder, 'deployments')), false);
    } finally { manager.cleanup(); }
  }
});

test('ENS rejects unrecognized dry-run, verification and locking settings before broadcasting', async () => {
  for (const key of ['DRY_RUN', 'VERIFY', 'LOCK_CONFIG']) {
    const harness = ensHarness({ env: { [key]: 'tru' } });
    await assert.rejects(harness.main(), /must be an explicit/);
    assert.equal(harness.broadcasts(), 0);
  }
});

test('only an explicit successful explorer verifier result establishes verification', async () => {
  for (const verificationResult of [undefined, null, false, 'true', {}]) {
    const manager = deploymentHarness({ verificationResult: verificationResult === undefined ? null : verificationResult });
    const ens = ensHarness({ verificationResult: verificationResult === undefined ? null : verificationResult });
    try {
      await assert.rejects(manager.main(), /verification incomplete/);
      await assert.rejects(ens.main(), /creation or verification incomplete/);
      assert.equal(manager.receipt().verification.AGIJobManager.status, 'failed');
      assert.equal(ens.receipt().verification.status, 'pending');
    } finally { manager.cleanup(); }
  }
});

test('unrelated or legacy already-verified error text cannot establish verification', async () => {
  for (const error of [new Error('Unable to determine whether contract is already verified'),
    Object.assign(new Error('already verified'), { name: 'ContractAlreadyVerifiedError', pluginName: '@nomicfoundation/hardhat-verify', _isNomicLabsHardhatPluginError: true })]) {
    const failure = deploymentHarness({ verificationError: error });
    try {
      await assert.rejects(failure.main(), /verification incomplete/);
      assert.equal(failure.receipt().verification.AGIJobManager.status, 'failed');
    } finally { failure.cleanup(); }
  }
});

test('disabled explorer verification cannot silently pass a requested verification', async () => {
  assert.throws(() => requireExplorerEnabled({ verify: { etherscan: { enabled: false } } }), /must be enabled/);
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

test('ENS verifies constructor governor and leaves configuration as a separate action plan', async () => {
  const harness = ensHarness({ env: { LOCK_CONFIG: '1', FINAL_OWNER: C } });
  await harness.main();
  assert.deepEqual(harness.actions, ['deploy', 'verify']);
  const receipt = harness.receipt();
  assert.equal(receipt.status, 'verified_unconfigured');
  assert.equal(receipt.currentOwner, C);
  assert.equal(receipt.configLocked, false);
  assert.equal(receipt.verification.status, 'verified');
  assert.equal(receipt.transactions.length, 1);
  assert.equal(receipt.runtimeCodeHash, realEthers.keccak256('0x6000'));
  assert.equal(receipt.expectedRuntimeCodeHash, receipt.runtimeCodeHash);
  assert.equal(receipt.compiler.version, '0.8.37');
  const input = JSON.parse(fs.readFileSync(receipt.solcInputPath, 'utf8'));
  assert.equal(input.language, 'Solidity');
  assert.equal(input.sources['contracts/ens/ENSJobPages.sol'].content, '// reviewed fixture');
  assert.equal(input.settings.optimizer.runs, 40);
});

test('ENS rejects missing or substituted compiler artifacts before deployment and preserves runtime mismatch evidence', async () => {
  for (const [options, message] of [
    [{ missingBuildInfo: true }, /build info missing/],
    [{ compilerVersion: '0.8.36' }, /compiler settings do not match/],
    [{ artifactMismatch: true }, /artifact differs from its compiler build/],
  ]) {
    const harness = ensHarness(options);
    await assert.rejects(harness.main(), message);
    assert.equal(harness.broadcasts(), 0);
  }
  const substituted = ensHarness({ observedRuntimeCode: '0x6001' });
  await assert.rejects(substituted.main(), /creation or verification incomplete/);
  assert.deepEqual(substituted.actions, ['deploy']);
  assert.equal(substituted.receipt().status, 'incomplete');
  assert.equal(substituted.receipt().address, realEthers.getCreateAddress({from:A,nonce:2}));
  assert.equal(fs.existsSync(substituted.receipt().solcInputPath), true);
});

test('ENS verifier outage leaves locking and ownership untouched with a recoverable journal', async () => {
  const harness = ensHarness({ env: { LOCK_CONFIG: '1', FINAL_OWNER: C }, verificationError: 'not already verified; explorer unavailable' });
  await assert.rejects(harness.main(), /creation or verification incomplete/);
  assert.deepEqual(harness.actions, ['deploy', 'verify']);
  const receipt = harness.receipt();
  assert.equal(receipt.status, 'incomplete');
  assert.equal(receipt.address, realEthers.getCreateAddress({from:A,nonce:2}));
  assert.equal(receipt.verification.status, 'pending');
  assert.equal(receipt.transactions[0].txHash, hash(1));
});

test('ENS transaction failures and wrong final owner cannot be reported as configured', async () => {
  const failedTransaction = ensHarness({ failAction: 'deploy' });
  await assert.rejects(failedTransaction.main(), /creation or verification incomplete/);
  assert.equal(failedTransaction.receipt().transactionHash, hash(1));
  assert.equal(failedTransaction.receipt().status, 'incomplete');
  const wrongOwner = ensHarness({ finalOwnerMismatch: true });
  await assert.rejects(wrongOwner.main(), /creation or verification incomplete/);
  assert.equal(wrongOwner.receipt().status, 'incomplete');
});

test('ENS read-only plan works without a key while public-network writes still need a signer', async () => {
  const readOnly = ensHarness({ noSigner: true, env: { DRY_RUN: 'true', DEPLOYER_ADDRESS: A } });
  await readOnly.main();
  assert.equal(readOnly.broadcasts(), 0);
  const missingSigner = ensHarness({ noSigner: true, env: { DEPLOYER_ADDRESS: A } });
  await assert.rejects(missingSigner.main(), /Signing account differs/);
  assert.equal(missingSigner.broadcasts(), 0);
});

test('ENS cannot transfer ownership to the USDC token or a configured protocol dependency', async () => {
  for (const finalOwner of [TOKEN, B, '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e', '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401']) {
    const harness = ensHarness({ managerOwner: finalOwner, env: { FINAL_OWNER: finalOwner } });
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
    if (name === './governance-deployment.cjs') return require('../scripts/governance-deployment.cjs');
    if (name === './creator-transaction.cjs') return require('../scripts/creator-transaction.cjs');
    if (name === './runtime.cjs') return { getRuntime: async () => mockRequire('hardhat') };
    if (name === './deployment-safety.cjs') return require('../scripts/deployment-safety.cjs');
    if (name === './canonical-state.cjs') return require('../scripts/canonical-state.cjs');
    if (name === '../../scripts/lib/usdc') return require('../../scripts/lib/usdc');
    if (name === './deploy.cjs') return { ...deployment.program, verifyWithRetry: async params => {
      assert.equal(params.blockReference.hash,hash(1000));assert.equal(params.blockReference.number,1000);
      verificationCalls.push(params.name); return { contract: params.name, status: failVerification ? 'failed' : 'verified', attempts: 1, error: failVerification ? 'Explorer unavailable' : null };
    } };
    return require(name);
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/reverify-deployment.cjs'), 'utf8'), {
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
    assert.equal(deployment.broadcasts(), 9);
    assert.deepEqual(fs.readFileSync(deployment.receiptPath()), original);
    assert.equal(recovered.status, 'awaiting_readiness_review');
    assert.equal(recovered.recovery.blockchainTransactionsBroadcast, 0);
    assert.equal(recovered.ownershipTransfer.accepted, true);
    assert.equal(recovery.verificationCalls.length, 9);
    assert.match(recovered.configHash, /^0x[a-f0-9]{64}$/);
    await assert.rejects(recovery.main(), /EEXIST/);
  } finally { deployment.cleanup(); }
});

test('verification recovery requires hash-bound code and calls and rejects unsupported RPCs without a number fallback', async () => {
  for (const rejected of ['eth_getCode','eth_call']) {
    const deployment=deploymentHarness({failVerification:true});
    try {
      await assert.rejects(deployment.main(),/verification incomplete/);
      const original=fs.readFileSync(deployment.receiptPath()),send=deployment.hardhat.ethers.provider.send;
      let failures=0;
      deployment.hardhat.ethers.provider.send=async(method,params)=>{
        assert.deepEqual(params.at(-1),{blockHash:hash(1000),requireCanonical:true});
        if(method===rejected){failures++;throw new Error('canonical hash unavailable');}
        return send(method,params);
      };
      const recovery=recoveryHarness(deployment);
      await assert.rejects(recovery.main(),/CANONICAL_STATE_READ_BLOCKED.*No block-number fallback/);
      assert.equal(failures,rejected==='eth_call'?4:1);assert.equal(fs.existsSync(recovery.recoveredPath()),false);
      assert.deepEqual(fs.readFileSync(deployment.receiptPath()),original);assert.equal(deployment.broadcasts(),9);
    } finally {deployment.cleanup();}
  }
});

test('verification retry forwards a recovery hash without changing default deployment verification', async () => {
  const deployment=deploymentHarness({dryRun:true}),blockReference={number:1000,hash:hash(1000)};
  try {
    await deployment.program.verifyWithRetry({name:'AGIJobManager',record:{address:A},blockReference},0);
    await deployment.program.verifyWithRetry({name:'AGIJobManager',record:{address:A}},0);
    const calls=deployment.logs.filter(([label])=>label==='verifier call').map(([,params])=>params);
    assert.deepEqual(calls[0].blockReference,blockReference);assert.equal(calls[1].blockReference,undefined);
  } finally {deployment.cleanup();}
});

test('explicit-governor recovery requires no creator proposal or owner acceptance', async () => {
  const deployment = deploymentHarness({ failVerification: true, finalOwner: C });
  try {
    await assert.rejects(deployment.main(), /verification incomplete/);
    const recovery = recoveryHarness(deployment);
    await recovery.main();
    assert.equal(deployment.broadcasts(), 9);
    assert.equal(recovery.recovered().ownershipTransfer.proposalRequired, false);
    assert.equal(recovery.recovered().ownershipTransfer.acceptanceRequired, false);
    assert.equal(recovery.recovered().ownershipTransfer.currentOwner, C);
  } finally { deployment.cleanup(); }
});

test('manager confirmation and runtime RPC failures retain links for keyless verification recovery', async () => {
  for (const [options, message] of [
    [{ failConfirmation: true, failConfirmationAt: 9 }, /Confirmation RPC failed/],
    [{ failManagerRuntimeRead: true }, /Manager runtime RPC failed/],
  ]) {
    const deployment = deploymentHarness({ ...options, finalOwner: C });
    try {
      await assert.rejects(deployment.main(), message);
      const failed = deployment.receipt();
      assert.equal(deployment.broadcasts(), 9);
      assert.equal(failed.status, 'failed');
      assert.equal(failed.contracts.AGIJobManager.txHash, hash(9));
      const original = fs.readFileSync(deployment.receiptPath());
      deployment.hardhat.ethers.getSigners = async () => [];
      const recovery = recoveryHarness(deployment);
      await recovery.main();
      const recovered = recovery.recovered();
      assert.equal(deployment.broadcasts(), 9);
      assert.deepEqual(fs.readFileSync(deployment.receiptPath()), original);
      assert.equal(recovered.status, 'awaiting_readiness_review');
      assert.equal(recovered.recovery.blockchainTransactionsBroadcast, 0);
      assert.equal(recovered.contracts.AGIJobManager.blockNumber, 132);
      assert.equal(recovered.contracts.AGIJobManager.runtimeCodeHash, realEthers.keccak256('0x6000'));
      for (const name of deployment.program.LIBRARIES) {
        assert.equal(recovered.libraries[deployment.program.FQNS[name]], recovered.contracts[name].address);
      }
      assert.equal(recovered.ownershipTransfer.proposalRequired, false);
      assert.equal(recovered.ownershipTransfer.acceptanceRequired, false);
      assert.equal(recovery.verificationCalls.length, 9);
    } finally { deployment.cleanup(); }
  }
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
    assert.equal(outage.broadcasts(), 9);
    assert.equal(fs.existsSync(recovery.recoveredPath()), false);
  } finally { incomplete.cleanup(); outage.cleanup(); }
});

test('creation checks include constructor bytes and block oversize before any gas estimation', async () => {
  assert.equal(requireInitcodeSize('example', `0x${'00'.repeat(49152)}`), 49152);
  let estimates = 0;
  await assert.rejects(prepareDeployment({ name: 'example', from: A, factory: { getDeployTransaction: async () => ({ data: `0x${'00'.repeat(49153)}` }) },
    provider: { estimateGas: async () => { estimates += 1; return 100000n; } } }), /EIP-3860/);
  assert.equal(estimates, 0);
});

test('manager and ENS deployments reject oversized initcode and gas before broadcasting', async () => {
  for (const options of [{ creationData: `0x${'00'.repeat(49153)}` }, { estimatedGas: 16777217n }, { estimatedGas: 0n }]) {
    const manager = deploymentHarness(options), ens = ensHarness(options);
    try {
      await assert.rejects(manager.main(), /EIP-3860|EIP-7825/);
      await assert.rejects(ens.main(), /EIP-3860|EIP-7825/);
      assert.equal(manager.broadcasts(), 0);
      assert.equal(ens.broadcasts(), 0);
    } finally { manager.cleanup(); }
  }
});

test('gas buffer stays within the protocol transaction cap and preserves the exact deployer', async () => {
  let observed;
  const prepared = await prepareDeployment({ name: 'example', from: A, factory: { getDeployTransaction: async () => ({ data: '0x6000' }) },
    provider: { estimateGas: async request => { observed = request; return 16000000n; } } });
  assert.equal(observed.from, A);
  assert.equal(prepared.estimatedGas, 16000000n);
  assert.equal(prepared.gasLimit, 16777216n);
});

test('missing explorer API credentials fail before production deployment', () => {
  for (const apiKey of [undefined, null, '', ' ']) assert.throws(() => requireExplorerEnabled({ verify: { etherscan: { enabled: true, apiKey } } }), /ETHERSCAN_API_KEY/);
});


test('successful deployment records all eight libraries, disabled NFT default and paused intake', async () => {
  const harness = deploymentHarness();
  try {
    await harness.main();
    const receipt = harness.receipt();
    assert.equal(harness.broadcasts(), 9);
    assert.equal(Object.keys(receipt.libraries).length, 8);
    assert.equal(receipt.agentNftRequiredAtDeployment, false);
    assert.equal(receipt.intakePaused, true);
    assert.equal(receipt.ownershipTransfer.accepted, true);
    assert.equal(receipt.verification.NftEligibility.status, 'verified');
    assert.equal(receipt.verification.AGIJobManager.status, 'verified');
  } finally { harness.cleanup(); }
});

test('an unexpected initial NFT policy blocks deployment completion before explorer verification', async () => {
  const harness = deploymentHarness({ initialNftRequired: true });
  try {
    await assert.rejects(harness.main(), /did not start with NFT eligibility disabled/);
    assert.equal(harness.broadcasts(), 9);
    assert.equal(harness.receipt().status, 'failed');
    assert.equal(harness.receipt().verification.AGIJobManager, undefined);
  } finally { harness.cleanup(); }
});

test('ENS namespace uses every manager-address byte, distinguishes chains and normalizes address case', () => {
  const { deriveJobsRootName } = require('../scripts/deploy-ens-job-pages.cjs');
  const address = '0x123456780000000000000000000000009abcdef0';
  const collision = '0x12345678ffffffffffffffffffffffff9abcdef0';
  const root = deriveJobsRootName(1, address);
  assert.equal(root, deriveJobsRootName(1, realEthers.getAddress(address)));
  assert.notEqual(root, deriveJobsRootName(1, collision));
  assert.notEqual(root, deriveJobsRootName(11155111, address));
  assert.equal(realEthers.ensNormalize(root), root);
  assert.equal(root.split('.')[0].length, 47);
  for (const chain of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => deriveJobsRootName(chain, address), /chain ID/);
  for (const address of [ZERO, '0x1234', 'not-an-address']) assert.throws(() => deriveJobsRootName(1, address));
});

test('ENS fresh setup rejects occupied roots, resolver remnants and existing job history without broadcasts', async () => {
  for (const options of [{ rootOwner: A }, { rootResolver: A }, { previousHelper: D }, { nextJobId: 1n }]) {
    const harness = ensHarness(options);
    await assert.rejects(harness.main(), /already occupied|no existing helper and no posted jobs/);
    assert.equal(harness.broadcasts(), 0);
  }
});

test('ENS fresh setup rejects arbitrary namespace, prefix and node overrides', async () => {
  for (const env of [{ JOBS_ROOT_NAME: 'usdc-001.alpha.jobs.agi.eth' }, { JOB_LABEL_PREFIX: 'agijob' },
    { JOBS_ROOT_NODE: realEthers.ZeroHash }, { ENS_DEPLOYMENT_MODE: 'replace' }]) {
    const harness = ensHarness({ env });
    await assert.rejects(harness.main(), /must match|must be|mismatch/);
    assert.equal(harness.broadcasts(), 0);
  }
  const matching = ensHarness({ env: { JOBS_ROOT_NAME: `USDC-1-${B.slice(2)}.ALPHA.JOBS.AGI.ETH`, JOB_LABEL_PREFIX: 'job-',
    JOBS_ROOT_NODE: realEthers.namehash(`usdc-1-${B.slice(2)}.alpha.jobs.agi.eth`) } });
  await matching.main();
  assert.equal(matching.receipt().namespace.jobLabelPrefix, 'job-');
});

test('ENS same-manager replacement preserves the active root and prefix with existing jobs', async () => {
  const harness = ensHarness({ previousHelper: D, nextJobId: 42n, previousPrefix: 'old-job-', env: { ENS_DEPLOYMENT_MODE: 'replacement' } });
  await harness.main();
  const plan = harness.receipt().namespace;
  assert.equal(plan.previousHelper, D);
  assert.equal(plan.jobsRootName, 'usdc-v092.alpha.jobs.agi.eth');
  assert.equal(plan.jobLabelPrefix, 'old-job-');
  assert.equal(plan.exampleJobName, 'old-job-0.usdc-v092.alpha.jobs.agi.eth');
});

test('ENS replacement refuses a foreign helper, namespace drift, malformed state or a missing root', async () => {
  for (const options of [{ previousHelper: ZERO }, { previousManager: C }, { previousRegistry: A },
    { previousRootNode: realEthers.ZeroHash }, { previousPrefix: 'job1' }, { rootOwner: ZERO },
    { env: { JOBS_ROOT_NAME: 'other.alpha.jobs.agi.eth' } }, { env: { JOB_LABEL_PREFIX: 'job-' } }]) {
    const harness = ensHarness({ previousHelper: D, ...options, env: { ENS_DEPLOYMENT_MODE: 'replacement', ...options.env } });
    await assert.rejects(harness.main(), /requires an existing helper|another manager|preserve the existing ENS registry|inconsistent|invalid|no owner|must match|must be/);
    assert.equal(harness.broadcasts(), 0);
  }
});

test('ENS creation never executes governor prefix, locking or ownership transactions', async () => {
  const harness=ensHarness({failAction:'setJobLabelPrefix',env:{LOCK_CONFIG:'1'}});
  await harness.main();
  assert.deepEqual(harness.actions,['deploy','verify']);
  const receipt=harness.receipt();
  assert.equal(receipt.status,'verified_unconfigured');assert.equal(receipt.configLocked,false);
  assert.equal(receipt.configuredManager,ZERO);assert.equal(receipt.governorActionPlan.actions.length,3);
  const altered=ensHarness({finalPrefixMismatch:true});
  await assert.rejects(altered.main(),/creation or verification incomplete/);
  assert.deepEqual(altered.actions,['deploy']);
});


test('deployment preflight rejects unsupported canonical reads before files or broadcasts', async () => {
  const harness = deploymentHarness();
  try {
    harness.hardhat.ethers.provider.send = async () => { throw new Error('unsupported blockHash'); };
    await assert.rejects(harness.main(), /CANONICAL_STATE_READ_BLOCKED.*No block-number fallback/);
    assert.equal(harness.broadcasts(), 0);
    assert.equal(fs.existsSync(path.join(harness.folder, 'deployments')), false);
  } finally { harness.cleanup(); }
});

test('deployment preflight rejects a reorg before files or broadcasts', async () => {
  const harness = deploymentHarness();
  try {
    harness.hardhat.ethers.provider.getBlock = async tag => ({ number: 1000, hash: hash(tag === 'latest' ? 1000 : 1001) });
    await assert.rejects(harness.main(), /Preflight block changed or disappeared/);
    assert.equal(harness.broadcasts(), 0);
    assert.equal(fs.existsSync(path.join(harness.folder, 'deployments')), false);
  } finally { harness.cleanup(); }
});

test('deployment plan records canonical preflight scope', async () => {
  const harness = deploymentHarness({ dryRun: true });
  try {
    await harness.main();
    const plan = JSON.parse(harness.logs.find(args => typeof args[0] === 'string' && args[0].startsWith('{'))[0]);
    assert.equal(plan.preflight.stateReference, 'EIP-1898 canonical block hash; no number fallback');
    assert.deepEqual(plan.preflight.tokenState.blockTag, { blockHash: hash(1000), requireCanonical: true });
  } finally { harness.cleanup(); }
});


test('activation fails closed on incomplete reserves, malformed flags or amounts', () => {
  for (const reserves of [[], [0n, 0n, 0n, 0n], Array(6).fill(0n)]) {
    assert.throws(() => requireReadinessState({ ...state(), reserves }), /all five reserves/);
  }
  for (const value of [-1n, '0x00', ' 0', true, null, 1.5, Number.MAX_SAFE_INTEGER + 1, 1n << 256n]) {
    assert.throws(() => requireReadinessState({ ...state(), balance: value }), /exact unsigned integer|outside uint256/);
    assert.throws(() => requireReadinessState({ ...state(), reserves: [value, 0n, 0n, 0n, 0n] }), /exact unsigned integer|outside uint256/);
  }
  for (const paused of [1, 'true', null]) assert.throws(() => requireReadinessState({ ...state(), paused }), /explicit booleans/);
  assert.throws(() => requireReadinessState({ ...state(), owner: ZERO, finalOwner: ZERO }), /non-zero/);
  assert.throws(() => requireReadinessState({ ...state(), reserves: [0n, 0n, 0n, 0n, 1n], balance: 1n }), /no existing job escrow, bonds or payment claims/);
  assert.throws(() => requireReadinessState({ ...state(), wallets: [A] }), /exactly two/);
});


test('concurrent intake activation cannot be reported as a paused deployment', async () => {
  const harness = deploymentHarness();
  try {
    const getContractAt = harness.hardhat.ethers.getContractAt;
    let reads = 0;
    harness.hardhat.ethers.getContractAt = async (...args) => ({
      ...await getContractAt(...args),
      paused: async () => ++reads === 1,
    });
    await assert.rejects(harness.main(), /intake is no longer paused|paused intake must match/);
    assert.equal(harness.broadcasts(), 9);
    assert.equal(harness.receipt().status, 'failed');
    assert.equal(harness.receipt().contracts.AGIJobManager.status, 'confirmed');
  } finally { harness.cleanup(); }
});

test('ENS keyless recovery preserves original journal and never configures or redeploys', async () => {
  const harness=ensHarness();await harness.main();const original=fs.readFileSync(harness.environment.ENS_JOURNAL);
  harness.environment.ENS_REVERIFY='1';harness.environment.ENS_REPORT=path.join(harness.folder,'recovery.json');
  harness.hardhat.ethers.getSigners=async()=>{throw Error('Recovery must not request a signer');};
  const report=await harness.main();assert.equal(report.status,'verified_unconfigured');assert.equal(report.blockchainTransactionsBroadcast,0);
  assert.equal(report.configuredManager,ZERO);assert.equal(report.configLocked,false);assert.equal(harness.broadcasts(),1);
  assert.deepEqual(harness.actions,['deploy','verify','verify']);assert.deepEqual(fs.readFileSync(harness.environment.ENS_JOURNAL),original);
  await assert.rejects(harness.main(),/already exists/);assert.equal(harness.broadcasts(),1);
});

test('ENS historical recovery cannot silently select the new constructor or current source', async () => {
  const harness=ensHarness();await harness.main();const journal=harness.receipt();delete journal.schema;delete journal.constructorSchema;delete journal.ownershipInitialization;journal.constructorArgs=journal.constructorArgs.slice(0,5);
  fs.writeFileSync(harness.environment.ENS_JOURNAL,JSON.stringify(journal));
  harness.environment.ENS_REVERIFY='1';harness.environment.ENS_REPORT=path.join(harness.folder,'legacy.json');
  await assert.rejects(harness.main(),/explicit original artifact, compiler build and reviewed buildDigest/);
  assert.equal(harness.broadcasts(),1);assert(!fs.existsSync(harness.environment.ENS_REPORT));
});

test('ENS live creation requires separately reviewed creator, owner, source and manager identity', async () => {
  for(const [env,pattern] of [[{DEPLOYER_ADDRESS:''},/separately reviewed/],[{CREATOR_TRANSACTION_MODE:'factory'},/Unsupported/],[{ENS_BUILD_DIGEST:''},/ENS_BUILD_DIGEST/],[{ENS_MANAGER_CODE_HASH:''},/ENS_MANAGER_CODE_HASH/],[{FINAL_OWNER:C,NEW_OWNER:A},/conflict/]]){
    const harness=ensHarness({env});await assert.rejects(harness.main(),pattern);assert.equal(harness.broadcasts(),0);
  }
});

for (const [label, optimizer] of [
  ['default optimizer without the mitigation', { enabled: true, runs: 40 }],
  ...['E', 'L'].map(step => {
    const optimizer = structuredClone(compilerOptimizer);
    optimizer.details.yulDetails.optimizerSteps = step + optimizer.details.yulDetails.optimizerSteps;
    return [`reintroduced ${step} optimizer pass`, optimizer];
  }),
]) test(`manager and ENS creation reject ${label} before broadcasting`, async () => {
  const manager = deploymentHarness({ optimizer });
  const ens = ensHarness({ optimizer });
  try {
    await assert.rejects(manager.main(), /Compiler settings do not match/);
    await assert.rejects(ens.main(), /compiler settings do not match/);
    assert.equal(manager.broadcasts(), 0);
    assert.equal(ens.broadcasts(), 0);
  } finally { manager.cleanup(); }
});
