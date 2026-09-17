const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const ethers = require('ethers');
const safety = require('../scripts/deployment-safety.cjs');

const A = `0x${'11'.repeat(20)}`;
const B = `0x${'22'.repeat(20)}`;
const C = `0x${'33'.repeat(20)}`;
const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const CODE = '0x6000';
const BLOCK = { number: 123, hash: `0x${'aa'.repeat(32)}` };
const LIBRARIES = ['UriUtils', 'TransferUtils', 'BondMath', 'ReputationMath', 'ENSOwnership', 'NftEligibility'];
const NAMES = [...LIBRARIES, 'AGIJobManager'];
const FQNS = Object.fromEntries(NAMES.map(name => [name, `source:${name}`]));
const NFT_POLICY = { agentNftRequired: true, agiTypes: [{ nftAddress: C, payoutPercentage: '1' }] };
const CONFIG_GETTERS = {
  ensConfig: ['ens', 'nameWrapper'],
  rootNodes: ['clubRootNode', 'agentRootNode', 'alphaClubRootNode', 'alphaAgentRootNode'],
  merkleRoots: ['validatorMerkleRoot', 'agentMerkleRoot'],
};

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

function makeReceipt() {
  const receipt = {
    status: 'deployed_paused', chainId: 1, network: 'mainnet', finalOwner: A,
    constructorArgs: { usdcTokenAddress: TOKEN, baseIpfsUrl: 'ipfs://', settlementWallets: [A, B], ensConfig: [B, ethers.ZeroAddress],
      rootNodes: [1, 2, 3, 4].map(value => ethers.zeroPadValue(ethers.toBeHex(value), 32)),
      merkleRoots: [5, 6].map(value => ethers.zeroPadValue(ethers.toBeHex(value), 32)) },
    contracts: Object.fromEntries(NAMES.map((name, index) => [name, {
      address: `0x${String(index + 100).padStart(40, '0')}`, txHash: ethers.zeroPadValue(ethers.toBeHex(index + 1), 32),
      blockNumber: 100 + index, runtimeCodeHash: ethers.keccak256(CODE),
    }])),
    libraries: {}, verification: Object.fromEntries(NAMES.map(name => [name, { status: 'verified' }])),
  };
  for (const name of LIBRARIES) receipt.libraries[FQNS[name]] = receipt.contracts[name].address;
  receipt.configHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(canonical({
    constructorArgs: receipt.constructorArgs, libraries: receipt.libraries, finalOwner: receipt.finalOwner,
  }))));
  return receipt;
}

function harness({ mutateReceipt = () => {}, observed = {}, override, endBlock = BLOCK, initialBlock = BLOCK, owner = A, code = CODE, nftPolicy = NFT_POLICY, nftEntries = NFT_POLICY.agiTypes, omitNftConfig = false } = {}) {
  const receipt = makeReceipt();
  mutateReceipt(receipt);
  const calls = [], writes = [];
  const values = {
    agentNftRequired: true, usdcToken: TOKEN, owner, pendingOwner: ethers.ZeroAddress, paused: true, settlementPaused: false, wallet30: A, wallet10: B,
    lockedEscrow: 0n, lockedAgentBonds: 0n, lockedValidatorBonds: 0n, lockedDisputeBonds: 0n,
  };
  const originalArgs = makeReceipt().constructorArgs;
  for (const [field, getters] of Object.entries(CONFIG_GETTERS)) getters.forEach((getter, index) => { values[getter] = originalArgs[field][index]; });
  Object.assign(values, observed);
  const manager = Object.fromEntries(Object.entries(values).map(([method, value]) => [method, async options => {
    calls.push({ method, options });
    return value;
  }]));
  manager.agiTypes = async (index, options) => {
    calls.push({ method: 'agiTypes', options });
    if (index < nftEntries.length) return nftEntries[index];
    throw Object.assign(new Error('Array boundary'), { code: 'CALL_EXCEPTION', data: '0x' });
  };
  const token = {
    decimals: async options => { calls.push({ method: 'decimals', options }); return 6; },
    paused: async options => { calls.push({ method: 'USDC.paused', options }); return false; },
    isBlacklisted: async (address, options) => { calls.push({ method: 'isBlacklisted', options }); return false; },
    balanceOf: async (address, options) => { calls.push({ method: 'balanceOf', options }); return 0n; },
  };
  const provider = {
    getNetwork: async () => { calls.push({ method: 'getNetwork' }); return { chainId: 1n }; },
    getBlock: async tag => { calls.push({ method: 'getBlock', tag }); return tag === 'latest' ? initialBlock : endBlock; },
    getCode: async (address, tag) => { calls.push({ method: 'getCode', tag }); return code; },
  };
  const receiptPath = '/tmp/agi-readiness/receipt.json';
  const overridePath = '/tmp/agi-readiness/reviewed.json';
  const overrideText = JSON.stringify(override, null, 2);
  const mockedFs = {
    readFileSync: file => {
      if (file === receiptPath) return JSON.stringify(receipt);
      if (file === overridePath) return overrideText;
      if (file === '/tmp/agi-readiness/nft.json') return JSON.stringify(nftPolicy);
      throw new Error(`Unexpected file read: ${file}`);
    },
    writeFileSync: (file, text, options) => writes.push({ file, text, options }),
  };
  const buildInfo = { output: { contracts: { source: Object.fromEntries(NAMES.map(name => [name, { evm: { deployedBytecode: {} } }])) } } };
  const mockRequire = name => {
    if (name === 'fs') return mockedFs;
    if (name === './runtime.cjs') return { getRuntime: async () => mockRequire('hardhat') };
    if (name === 'hardhat') return {
      ethers: { ...ethers, provider, Contract: function () { return token; }, getContractAt: async () => manager },
      network: { name: 'mainnet' },
      artifacts: { readArtifact: async fqn => ({ sourceName: 'source', contractName: fqn.split(':')[1], deployedBytecode: CODE }) },
    };
    if (name === './deploy.cjs') return { FQNS, LIBRARIES, qualifiedBuild: async () => ({ buildInfo }) };
    if (name === './deployment-safety.cjs') return safety;
    if (name === './nft-policy.cjs') return require('../scripts/nft-policy.cjs');
    return require(name);
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/check-readiness.cjs'), 'utf8'), {
    module, exports: module.exports, require: mockRequire,
    process: { env: { DEPLOYMENT_RECEIPT: receiptPath, ...(omitNftConfig ? {} : { READINESS_NFT_CONFIG: '/tmp/agi-readiness/nft.json' }), ...(override === undefined ? {} : { READINESS_CONFIG: overridePath }) }, cwd: () => '/tmp/agi-readiness' },
    console: { log() {}, error() {} },
  });
  return { main: module.exports.main, calls, writes, receipt, overrideText, report: () => JSON.parse(writes[0].text) };
}

test('readiness reports observed identity configuration, receipt-only verification and zero broadcasts', async () => {
  const run = harness();
  await run.main();
  const report = run.report();
  assert.equal(report.checksPassed, true);
  assert.equal(report.transactionsBroadcast, 0);
  assert.equal(report.blockHash, BLOCK.hash);
  assert.deepEqual(report.identityConfig.observed, report.identityConfig.expected);
  assert.equal(report.identityConfig.reviewedOverride, null);
  assert.equal(report.membership.roots.length, 4);
  assert.equal(report.membership.roots[0].role, 'validators');
  assert.equal(report.membership.roots[0].name, null);
  assert.deepEqual(report.membership.merkleExceptions.map(value => value.enabled), [true, true]);
  assert.match(report.membership.scope, /additional allowlist entries are not verified/);
  assert.match(report.explorerVerification.source, /receipt; no fresh explorer query/);
  assert.match(report.configurationScope, /Private baseIpfsUrl.*not validated/);
  assert.equal(run.writes[0].options.flag, 'wx');
});

test('a reconciled awaiting-readiness receipt is accepted', async () => {
  const run = harness({ mutateReceipt: receipt => { receipt.status = 'awaiting_readiness_review'; } });
  await run.main();
  assert.equal(run.writes.length, 1);
});

test('missing, failed and malformed receipt statuses fail before any RPC query', async () => {
  for (const status of [undefined, null, 'failed', 'started', 'success', {}]) {
    const run = harness({ mutateReceipt: receipt => { receipt.status = status; } });
    await assert.rejects(run.main(), /Reconcile an incomplete or failed deployment journal/);
    assert.equal(run.calls.length, 0);
    assert.equal(run.writes.length, 0);
  }
});

test('missing receipt objects and malformed deployment evidence fail clearly', async () => {
  for (const mutateReceipt of [
    receipt => { delete receipt.contracts; },
    receipt => { receipt.contracts.AGIJobManager = null; },
    receipt => { receipt.contracts.AGIJobManager.txHash = '0x123'; },
    receipt => { receipt.contracts.AGIJobManager.runtimeCodeHash = 'invalid'; },
    receipt => { receipt.contracts.AGIJobManager.blockNumber = '123'; },
    receipt => { receipt.finalOwner = ethers.ZeroAddress; },
  ]) {
    const run = harness({ mutateReceipt });
    await assert.rejects(run.main(), /Deployment receipt/);
    assert.equal(run.calls.length, 0);
    assert.equal(run.writes.length, 0);
  }
});

test('missing, malformed and unsuccessful explorer statuses cannot produce readiness', async () => {
  for (const value of [undefined, null, 'verified', {}, { status: 'failed' }, { status: 'pending' }]) {
    const run = harness({ mutateReceipt: receipt => { receipt.verification.AGIJobManager = value; } });
    await assert.rejects(run.main(), /verification|verification incomplete/);
    assert.equal(run.calls.length, 0);
  }
});

test('receipt config hash detects changes to constructor data, libraries or final owner', async () => {
  for (const mutateReceipt of [
    receipt => { receipt.configHash = ethers.ZeroHash; },
    receipt => { receipt.constructorArgs.baseIpfsUrl = 'ipfs://changed'; },
    receipt => { receipt.constructorArgs.rootNodes[0] = ethers.ZeroHash; },
    receipt => { receipt.libraries[FQNS.TransferUtils] = C; },
    receipt => { receipt.finalOwner = C; },
  ]) {
    const run = harness({ mutateReceipt });
    await assert.rejects(run.main(), /configHash does not match/);
    assert.equal(run.calls.length, 0);
  }
});

for (const [field, getters] of Object.entries(CONFIG_GETTERS)) {
  getters.forEach((getter, index) => {
    test(`readiness rejects unreviewed ${getter} changes with an actionable message`, async () => {
      const run = harness({ observed: { [getter]: field === 'ensConfig' ? C : ethers.ZeroHash } });
      await assert.rejects(run.main(), error => error.message.includes(`${field}[${index}]`) && /READINESS_CONFIG/.test(error.message));
      assert.equal(run.writes.length, 0);
    });
  });
}

test('an explicitly reviewed partial identity override is honored and identified by its exact file hash', async () => {
  const override = { ensConfig: [C, B] };
  const run = harness({ override, observed: { ens: C, nameWrapper: B } });
  const originalHash = run.receipt.configHash;
  await run.main();
  const report = run.report();
  assert.deepEqual(report.identityConfig.observed.ensConfig, [C, B]);
  assert.equal(report.identityConfig.reviewedOverride.path, '/tmp/agi-readiness/reviewed.json');
  assert.equal(report.identityConfig.reviewedOverride.sha256, createHash('sha256').update(run.overrideText).digest('hex'));
  assert.deepEqual(report.identityConfig.reviewedOverride.fields, ['ensConfig']);
  assert.equal(run.receipt.configHash, originalHash);
  assert.equal(run.receipt.constructorArgs.ensConfig[0], B);
});

test('reviewed root and Merkle changes use constructor ordering', async () => {
  const override = { rootNodes: [7, 8, 9, 10].map(value => ethers.zeroPadValue(ethers.toBeHex(value), 32)), merkleRoots: [ethers.ZeroHash, ethers.ZeroHash] };
  const observed = {};
  for (const [field, values] of Object.entries(override)) CONFIG_GETTERS[field].forEach((getter, index) => { observed[getter] = values[index]; });
  const run = harness({ override, observed });
  await run.main();
  assert.deepEqual(run.report().identityConfig.expected.rootNodes, override.rootNodes);
  assert.deepEqual(run.report().identityConfig.observed.merkleRoots, override.merkleRoots);
});

test('readiness overrides reject unknown policy fields and malformed arrays before RPC queries', async () => {
  for (const override of [{}, [], { finalOwner: C }, { validationRewardPercentage: 8 }, { ensConfig: [C] }, { rootNodes: ['0x00', '0x00', '0x00', '0x00'] }, { merkleRoots: null }]) {
    const run = harness({ override });
    await assert.rejects(run.main(), /READINESS_CONFIG/);
    assert.equal(run.calls.length, 0);
    assert.equal(run.writes.length, 0);
  }
});

test('an override cannot excuse a different observed configuration', async () => {
  const run = harness({ override: { ensConfig: [C, B] } });
  await assert.rejects(run.main(), /On-chain ensConfig\[0\] differs/);
  assert.equal(run.writes.length, 0);
});

test('changed, disappeared or incorrectly numbered blocks never produce a readiness report', async () => {
  for (const endBlock of [null, { ...BLOCK, hash: `0x${'bb'.repeat(32)}` }, { ...BLOCK, number: 124 }]) {
    const run = harness({ endBlock });
    await assert.rejects(run.main(), /block changed or disappeared/);
    assert.equal(run.writes.length, 0);
    assert.deepEqual(run.calls.filter(call => call.method === 'getBlock').map(call => call.tag), ['latest', BLOCK.number]);
  }
});

test('all configuration, accounting, issuer and code reads use the same reviewed block number', async () => {
  const run = harness();
  await run.main();
  for (const call of run.calls) {
    if (call.method === 'getCode') assert.equal(call.tag, BLOCK.number);
    if (call.options) assert.equal(call.options.blockTag, BLOCK.number);
  }
  const getters = Object.values(CONFIG_GETTERS).flat();
  assert.equal(run.calls.filter(call => getters.includes(call.method)).length, 8);
  assert.deepEqual(run.calls.filter(call => call.method === 'getBlock').map(call => call.tag), ['latest', BLOCK.number]);
});

test('missing initial block identity, ownership mismatch and substituted runtime remain blocking', async () => {
  for (const [options, message] of [
    [{ initialBlock: { number: 123 } }, /readiness block and hash/],
    [{ owner: C }, /not accepted ownership/],
    [{ code: '0x6001' }, /runtime differs/],
  ]) {
    const run = harness(options);
    await assert.rejects(run.main(), message);
    assert.equal(run.writes.length, 0);
  }
});


test('readiness requires an explicit NFT policy file before querying the chain', async () => {
  const run = harness({ omitNftConfig: true });
  await assert.rejects(run.main(), /Set READINESS_NFT_CONFIG/);
  assert.equal(run.calls.length, 0);
});

test('NFT-required readiness records the exact registry, code hashes and reviewed file hash', async () => {
  const run = harness(); await run.main();
  const policy = run.report().nftPolicy;
  assert.deepEqual(policy.expected, NFT_POLICY);
  assert.deepEqual(policy.observed, NFT_POLICY);
  assert.equal(policy.runtimeCodeHashes[C], ethers.keccak256(CODE));
  assert.equal(policy.reviewedConfig.sha256, createHash('sha256').update(JSON.stringify(NFT_POLICY)).digest('hex'));
});

test('an explicitly reviewed optional NFT policy permits an empty registry', async () => {
  const nftPolicy = { agentNftRequired: false, agiTypes: [] };
  const run = harness({ nftPolicy, nftEntries: [], observed: { agentNftRequired: false } });
  await run.main(); assert.deepEqual(run.report().nftPolicy.observed, nftPolicy);
});

test('NFT-required readiness rejects empty or entirely disabled registries', async () => {
  for (const agiTypes of [[], [{ nftAddress: C, payoutPercentage: '0' }]]) {
    const run = harness({ nftPolicy: { agentNftRequired: true, agiTypes } });
    await assert.rejects(run.main(), /NFTs are required but no collection is enabled/);
    assert.equal(run.calls.length, 0);
  }
});

test('NFT readiness fails on unreviewed default changes, extra collections and score changes', async () => {
  for (const options of [
    { observed: { agentNftRequired: false } },
    { nftEntries: [...NFT_POLICY.agiTypes, { nftAddress: B, payoutPercentage: '0' }] },
    { nftEntries: [{ nftAddress: C, payoutPercentage: '2' }] },
  ]) {
    const run = harness(options);
    await assert.rejects(run.main(), /NFT policy differs/);
    assert.equal(run.writes.length, 0);
  }
});

test('NFT policy rejects malformed booleans, scores, duplicates and unknown fields before RPC reads', async () => {
  for (const nftPolicy of [
    {}, { ...NFT_POLICY, agentNftRequired: 'false' }, { ...NFT_POLICY, surprise: true },
    { ...NFT_POLICY, agiTypes: [{ nftAddress: C, payoutPercentage: '101' }] },
    { ...NFT_POLICY, agiTypes: [{ nftAddress: C, payoutPercentage: -1 }] },
    { ...NFT_POLICY, agiTypes: [{ nftAddress: ethers.ZeroAddress, payoutPercentage: 1 }] },
    { ...NFT_POLICY, agiTypes: [...NFT_POLICY.agiTypes, ...NFT_POLICY.agiTypes] },
  ]) {
    const run = harness({ nftPolicy });
    await assert.rejects(run.main(), /READINESS_NFT_CONFIG/);
    assert.equal(run.calls.length, 0);
  }
});
