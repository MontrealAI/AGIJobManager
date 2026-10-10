'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveRegistryLayout, validateLayout, parseLength, readRegistrySnapshot } = require('../scripts/nft-registry-snapshot.cjs');
const SOURCE = 'project/contracts/AGIJobManager.sol';
const VERSION = '0.8.37+commit.f401782d';
const MANAGER = '0xCFA78f9980eA9B55c705B3E44467baE383cE1fA7';
const word = n => `0x${BigInt(n).toString(16).padStart(64, '0')}`;
function fixture(length = 0) {
  const layout = { storage: [{ label: 'agiTypes', contract: `${SOURCE}:AGIJobManager`, offset: 0, slot: '77', type: 'array' }], types: {
    array: { encoding: 'dynamic_array', numberOfBytes: '32', base: 'entry' },
    entry: { encoding: 'inplace', numberOfBytes: '64', members: [
      { label: 'nftAddress', slot: '0', offset: 0, type: 'addr' },
      { label: 'payoutPercentage', slot: '1', offset: 0, type: 'uint' }] },
    addr: { encoding: 'inplace', label: 'address', numberOfBytes: '20' },
    uint: { encoding: 'inplace', label: 'uint256', numberOfBytes: '32' } } };
  const abi = [{ type: 'function', name: 'agiTypes', stateMutability: 'view', inputs: [{type: 'uint256'}], outputs: [{name: 'nftAddress', type: 'address'}, {name: 'payoutPercentage', type: 'uint256'}] }];
  const target = { abi, storageLayout: layout, evm: { bytecode: { object: '60016000', linkReferences: {} }, deployedBytecode: { object: '60026000', linkReferences: {} } } };
  const buildInfo = { solcVersion: '0.8.37', solcLongVersion: VERSION, input: {
    language: 'Solidity', sources: { [SOURCE]: {content: 'synthetic source; compiler output is mocked in this unit suite'} },
    settings: { optimizer: {enabled: true, runs: 40}, viaIR: true, evmVersion: 'shanghai', metadata: {bytecodeHash: 'none'}, debug: {revertStrings: 'strip'}, outputSelection: {'*': {'*': ['abi', 'evm.bytecode']}} } },
    output: { contracts: { [SOURCE]: { AGIJobManager: structuredClone(target) } } } };
  const artifact = { contractName: 'AGIJobManager', sourceName: 'contracts/AGIJobManager.sol', inputSourceName: SOURCE,
    abi: structuredClone(abi), bytecode: '0x60016000', deployedBytecode: '0x60026000', linkReferences: {}, deployedLinkReferences: {} };
  const requests = [], compilations = [];
  const compiler = { version: () => `${VERSION}.Emscripten.clang`, compile: text => {
    compilations.push(JSON.parse(text)); return JSON.stringify({contracts: {[SOURCE]: {AGIJobManager: target}}}); } };
  const calls = { blockTag: 26161720 };
  const entries = Array.from({length}, (_, i) => ({nftAddress: `0x${(i + 1).toString(16).padStart(40, '0')}`, payoutPercentage: BigInt(i % 2 ? 0 : 1)}));
  const manager = { getAddress: async () => MANAGER,
    MAX_AGI_TYPES: async at => {requests.push(['cap', at.blockTag]); return 32n;},
    agentNftRequired: async at => {requests.push(['policy', at.blockTag]); return false;},
    agiTypes: async (i, at) => {requests.push(['entry', i, at.blockTag]); if (i >= entries.length) throw Object.assign(new Error('execution reverted'), {code: 3, data: undefined}); return entries[i];} };
  const provider = {getStorage: async (addr, slot, block) => {requests.push(['storage', addr, slot.toString(), block]); return word(length);}};
  return {layout, target, artifact, buildInfo, requests, compilations, compiler, calls, entries, manager, provider};
}
test('reproduces the screenshot error in the old sentinel reader; new zero-length read never calls agiTypes(0)', async () => {
  const f = fixture();
  async function oldRead(instance, calls = {}) {
    const items = [];
    for (let index = 0; ; index += 1) {
      try { const e = await instance.agiTypes(index, calls); items.push({nftAddress:e.nftAddress, payoutPercentage:e.payoutPercentage.toString()}); }
      catch (error) { if (error.code === 'CALL_EXCEPTION' && ['0x', `0x4e487b71${'0'.repeat(62)}32`].includes(error.data?.toLowerCase())) return items; throw error; }
    }
  }
  await assert.rejects(oldRead(f.manager, f.calls), e => e.code === 3 && e.data === undefined);
  f.requests.length = 0;
  const result = await readRegistrySnapshot(f);
  assert.deepEqual(result.agiTypes, []); assert.equal(result.evidence.count, 0);
  assert.equal(result.evidence.slot, '77'); assert.equal(result.evidence.endOfArrayRevertAssumptions, false);
  assert.equal(f.requests.some(r => r[0] === 'entry'), false);
});
for (const length of [1, 2, 31, 32]) test(`reads exactly ${length} entries, including disabled slots, without probing the next index`, async () => {
  const f = fixture(length), result = await readRegistrySnapshot(f);
  assert.equal(result.agiTypes.length, length);
  assert.deepEqual(f.requests.filter(r => r[0] === 'entry').map(r => r[1]), Array.from({length}, (_, i) => i));
  assert.deepEqual(result.agiTypes.map(e => e.payoutPercentage), f.entries.map(e => String(e.payoutPercentage)));
});
test('all storage and getter reads use one pinned numeric block and the compiler-derived slot', async () => {
  const f = fixture(2); await readRegistrySnapshot(f);
  for (const request of f.requests) assert.equal(request.at(-1), f.calls.blockTag);
  for (const request of f.requests.filter(r => r[0] === 'storage')) assert.deepEqual(request.slice(1), [MANAGER, '77', f.calls.blockTag]);
});
test('changes only outputSelection in memory and preserves input, artifact and compiler output', async () => {
  const f = fixture(), before = JSON.stringify([f.buildInfo, f.artifact, f.target]);
  const output = deriveRegistryLayout(f.buildInfo, f.artifact, f.compiler);
  assert.equal(JSON.stringify([f.buildInfo, f.artifact, f.target]), before);
  const expected = structuredClone(f.buildInfo.input);
  expected.settings.outputSelection = {[SOURCE]: {AGIJobManager:['abi','storageLayout','evm.bytecode','evm.deployedBytecode']}};
  assert.deepEqual(f.compilations, [expected]); assert.equal(output.bytecodesReconstructedExactly, true);
  assert.match(output.originalInputSha256, /^[a-f0-9]{64}$/);
});
for (const version of ['0.8.36+commit.f401782d','0.8.37+commit.aaaaaaaa','0.8.37+commit.f401782d.unknown','not-solc'])
  test(`rejects wrong or unsupported compiler identity ${version} before RPC`, async () => {
    const f = fixture(); f.compiler.version = () => version;
    await assert.rejects(readRegistrySnapshot(f), /compiler/); assert.equal(f.requests.length, 0);
  });
test('refuses an inconsistent short compiler version', () => {const f=fixture(); f.buildInfo.solcVersion='0.8.36'; assert.throws(()=>deriveRegistryLayout(f.buildInfo,f.artifact,f.compiler), /compiler/);});
for (const kind of ['bytecode', 'deployedBytecode']) test(`rejects changed rebuilt ${kind}`, async () => {
  const f=fixture(); f.target.evm[kind].object += '00'; await assert.rejects(readRegistrySnapshot(f), /differ/); assert.equal(f.requests.length, 0);
});
test('rejects changed ABI and link references instead of trusting only a storage label', () => {
  for (const mutation of [f=>f.target.abi.push({type:'error',name:'Changed',inputs:[]}), f=>f.target.evm.bytecode.linkReferences={changed:{L:[{start:0,length:20}]}}, f=>f.artifact.deployedLinkReferences={extra:{X:[]}}]) {
    const f=fixture(); mutation(f); assert.throws(()=>deriveRegistryLayout(f.buildInfo,f.artifact,f.compiler), /differ/);
  }
});
test('rejects compiler error/malformed result/throw', () => {
  for (const output of ['bad json', 'null', JSON.stringify({errors:[{severity:'error'}]}), JSON.stringify({errors:{bad:true}})]) {
    const f=fixture(); f.compiler.compile=()=>output; assert.throws(()=>deriveRegistryLayout(f.buildInfo,f.artifact,f.compiler), /NFT_REGISTRY_READ_BLOCKED/);
  }
  const f=fixture(); f.compiler.compile=()=>{throw new Error('not accepted');}; assert.throws(()=>deriveRegistryLayout(f.buildInfo,f.artifact,f.compiler), /compilation failed/);
});
test('rejects absent/URL-only source text and unresolved manager source', () => {
  for (const mutation of [f=>delete f.buildInfo.input.sources[SOURCE].content, f=>delete f.buildInfo.input.sources[SOURCE], f=>f.artifact.contractName='Other']) {
    const f=fixture(); mutation(f); assert.throws(()=>deriveRegistryLayout(f.buildInfo,f.artifact,f.compiler), /NFT_REGISTRY_READ_BLOCKED/);
  }
});
for (const [label, mutate] of [
  ['missing array', f=>f.layout.storage=[]], ['duplicate declaration', f=>f.layout.storage.push({...f.layout.storage[0]})],
  ['wrong contract', f=>f.layout.storage[0].contract='Elsewhere:AGIJobManager'], ['nonzero offset', f=>f.layout.storage[0].offset=1],
  ['negative slot', f=>f.layout.storage[0].slot='-1'], ['overflow slot', f=>f.layout.storage[0].slot=(1n<<256n).toString()],
  ['mapping type', f=>f.layout.types.array.encoding='mapping'], ['wrong struct size', f=>f.layout.types.entry.numberOfBytes='32'],
  ['wrong member type', f=>f.layout.types.uint.label='uint128'], ['wrong member offset', f=>f.layout.types.entry.members[1].offset=1],
  ['wrong member slot', f=>f.layout.types.entry.members[1].slot='2'], ['extra member', f=>f.layout.types.entry.members.push({})]])
  test(`rejects ${label}`, () => {const f=fixture();mutate(f);assert.throws(()=>validateLayout(f.layout,SOURCE), /NFT_REGISTRY_READ_BLOCKED/);});
for (const value of [undefined, null, '0x', '0x0', '0x00', `0x${'0'.repeat(63)}`, `0x${'0'.repeat(65)}`, `0x${'z'.repeat(64)}`, word(33), word((1n<<256n)-1n)])
  test(`does not treat malformed or excessive length ${String(value).slice(0,18)} as an empty array`, () => assert.throws(()=>parseLength(value), /NFT_REGISTRY_READ_BLOCKED/));
for (const calls of [{}, {blockTag:'latest'}, {blockTag:'0x1'}, {blockTag:-1}, {blockTag:1.5}, {blockTag:1, from:MANAGER}])
  test(`requires explicit safe blockTag ${JSON.stringify(calls)}`, async () => {
    const f=fixture(); f.calls=calls; await assert.rejects(readRegistrySnapshot(f), /blockTag/); assert.equal(f.requests.length,0);
  });
test('does not swallow RPC code 3 or ethers call exceptions for an in-range collection', async () => {
  for (const error of [Object.assign(new Error('execution reverted'),{code:3}), Object.assign(new Error('execution reverted'),{code:'CALL_EXCEPTION',data:'0x'}), Object.assign(new Error('timeout'),{code:'TIMEOUT'})]) {
    const f=fixture(1); f.manager.agiTypes=async()=>{throw error;}; await assert.rejects(readRegistrySnapshot(f), e=>e===error);
  }
});
test('storage RPC errors and absent provider support block the read', async () => {
  const f=fixture(), error=Object.assign(new Error('execution reverted'),{code:3,data:undefined});
  f.provider.getStorage=async()=>{throw error;}; await assert.rejects(readRegistrySnapshot(f), e=>e===error);
  delete f.provider.getStorage; await assert.rejects(readRegistrySnapshot(f), /methods/);
});
test('detects inconsistent length replies for the same pinned block', async () => {
  const f=fixture(); let read=0; f.provider.getStorage=async()=>word(read++);
  await assert.rejects(readRegistrySnapshot(f), /changed/);
});
test('rejects a different on-chain registry cap', async () => {const f=fixture(); f.manager.MAX_AGI_TYPES=async()=>64n; await assert.rejects(readRegistrySnapshot(f), /cap/);});
test('rejects malformed requirement and registry entries, including duplicates', async () => {
  const f=fixture(); f.manager.agentNftRequired=async()=>'false'; await assert.rejects(readRegistrySnapshot(f), /boolean/);
  for (const entry of [{nftAddress:'0x'+'0'.repeat(40),payoutPercentage:1n},{nftAddress:MANAGER,payoutPercentage:101n},{nftAddress:MANAGER,payoutPercentage:undefined}]) {
    const g=fixture(1); g.manager.agiTypes=async()=>entry; await assert.rejects(readRegistrySnapshot(g), /invalid/);
  }
  const g=fixture(2); g.entries[1]={...g.entries[0]}; await assert.rejects(readRegistrySnapshot(g), /duplicate/);
});
test('no signer, sendTransaction or write interface is required', async () => {
  const f=fixture(2), result=await readRegistrySnapshot(f);
  assert.equal(result.evidence.transactionsBroadcast,0);
  assert.deepEqual(Object.keys(f.provider), ['getStorage']);
});
