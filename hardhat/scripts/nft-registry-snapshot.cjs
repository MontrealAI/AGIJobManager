'use strict';
const { createHash } = require('node:crypto');
const MAX_TYPES = 32n;
const UINT256 = 1n << 256n;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const object = x => !!x && typeof x === 'object' && !Array.isArray(x);
const canonical = x => Array.isArray(x) ? x.map(canonical) : object(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
const json = x => JSON.stringify(canonical(x));
const sha = x => createHash('sha256').update(x).digest('hex');
const address = x => typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x) && BigInt(x) !== 0n;
function fail(message) { throw new Error(`NFT_REGISTRY_READ_BLOCKED: ${message}`); }
function compilerIdentity(version) {
  if (typeof version !== 'string') fail('missing compiler version.');
  const match = /^(0\.8\.\d+\+commit\.[0-9a-f]{8})(?:\.Emscripten\.clang)?$/.exec(version);
  if (!match) fail('unsupported compiler version format.');
  return match[1];
}
function validateLayout(layout, source) {
  if (!object(layout) || !Array.isArray(layout.storage) || !object(layout.types)) fail('missing compiler storage layout.');
  const matches = layout.storage.filter(x => object(x) && x.label === 'agiTypes');
  if (matches.length !== 1) fail('agiTypes storage declaration is missing or ambiguous.');
  const variable = matches[0];
  if (variable.contract !== `${source}:AGIJobManager` || variable.offset !== 0 ||
      typeof variable.slot !== 'string' || !/^(0|[1-9][0-9]*)$/.test(variable.slot) || BigInt(variable.slot) >= UINT256) {
    fail('agiTypes storage identity, offset or slot is unsupported.');
  }
  const array = layout.types[variable.type];
  const entry = array && layout.types[array.base];
  if (!object(array) || array.encoding !== 'dynamic_array' || array.numberOfBytes !== '32' ||
      !object(entry) || entry.encoding !== 'inplace' || entry.numberOfBytes !== '64' ||
      !Array.isArray(entry.members) || entry.members.length !== 2) fail('unsupported agiTypes array/element layout.');
  const wanted = [['nftAddress', '0', 'address', '20'], ['payoutPercentage', '1', 'uint256', '32']];
  for (let i = 0; i < wanted.length; i += 1) {
    const [label, slot, typeLabel, bytes] = wanted[i], member = entry.members[i];
    const type = member && layout.types[member.type];
    if (!object(member) || member.label !== label || member.slot !== slot || member.offset !== 0 ||
        !object(type) || type.encoding !== 'inplace' || type.label !== typeLabel || type.numberOfBytes !== bytes) {
      fail('unsupported agiTypes member layout.');
    }
  }
  return { slot: variable.slot, source, contract: 'AGIJobManager' };
}

// In-memory compilation only. No compiler download, source callback, artifact write or RPC.
// Reconstruct BOTH unlinked bytecodes before trusting the compiler-derived length slot.
function deriveRegistryLayout(buildInfo, artifact, compiler) {
  if (!object(buildInfo) || !object(artifact) || artifact.contractName !== 'AGIJobManager') fail('missing reviewed manager build.');
  if (!object(buildInfo.input) || buildInfo.input.language !== 'Solidity' || !object(buildInfo.input.sources) ||
      !object(buildInfo.input.settings)) fail('incomplete saved Solidity input.');
  for (const source of Object.values(buildInfo.input.sources)) {
    if (!object(source) || typeof source.content !== 'string') fail('saved sources must contain complete text.');
  }
  const source = artifact.inputSourceName || buildInfo.userSourceNameMap?.[artifact.sourceName] || artifact.sourceName;
  if (typeof source !== 'string' || !own(buildInfo.input.sources, source)) fail('manager input source is missing.');
  const expectedCompiler = compilerIdentity(buildInfo.solcLongVersion);
  if (buildInfo.solcVersion !== expectedCompiler.split('+')[0]) fail('inconsistent saved compiler version.');
  if (!compiler) {
    try { compiler = require('solc'); } catch { fail('the checkout\'s pinned solc package is unavailable. Do not change the compiler version.'); }
  }
  if (typeof compiler.version !== 'function' || typeof compiler.compile !== 'function' ||
      compilerIdentity(compiler.version()) !== expectedCompiler) fail('installed compiler does not match the reviewed build.');
  const input = structuredClone(buildInfo.input);
  input.settings.outputSelection = { [source]: { AGIJobManager: ['abi', 'storageLayout', 'evm.bytecode', 'evm.deployedBytecode'] } };
  let result;
  try { result = JSON.parse(compiler.compile(JSON.stringify(input))); }
  catch { fail('local layout compilation failed.'); }
  if (!object(result) || (result.errors !== undefined && (!Array.isArray(result.errors) || result.errors.some(e =>
      !object(e) || !['info', 'warning'].includes(e.severity))))) fail('local compiler returned an error or malformed diagnostics.');
  const rebuilt = result.contracts?.[source]?.AGIJobManager;
  const reviewed = buildInfo.output?.contracts?.[source]?.AGIJobManager;
  if (!object(rebuilt) || !object(reviewed) || !Array.isArray(artifact.abi) || !Array.isArray(rebuilt.abi) ||
      json(rebuilt.abi) !== json(artifact.abi) || !Array.isArray(reviewed.abi) || json(reviewed.abi) !== json(artifact.abi)) {
    fail('rebuilt ABI differs from the reviewed manager.');
  }
  for (const [kind, field, refs] of [['bytecode', 'bytecode', 'linkReferences'],
                                   ['deployedBytecode', 'deployedBytecode', 'deployedLinkReferences']]) {
    const actual = rebuilt.evm?.[kind], saved = reviewed.evm?.[kind];
    if (!object(actual) || typeof actual.object !== 'string' || !actual.object ||
        !object(saved) || actual.object !== saved.object || `0x${actual.object}` !== artifact[field] ||
        !object(actual.linkReferences) || !object(saved.linkReferences) || !object(artifact[refs]) ||
        json(actual.linkReferences) !== json(saved.linkReferences) || json(actual.linkReferences) !== json(artifact[refs])) {
      fail(`rebuilt ${kind} or link references differ from the reviewed release.`);
    }
  }
  const layout = validateLayout(rebuilt.storageLayout, source);
  return { ...layout, compiler: expectedCompiler, originalInputSha256: sha(json(buildInfo.input)),
    storageLayoutSha256: sha(json(rebuilt.storageLayout)), bytecodesReconstructedExactly: true };
}
function parseLength(word) {
  if (typeof word !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(word)) fail('eth_getStorageAt did not return one full 32-byte word.');
  const count = BigInt(word);
  if (count > MAX_TYPES) fail('on-chain registry length exceeds the supported 32-entry cap.');
  return Number(count);
}
function normalizeEntry(entry) {
  if (!entry || !address(entry.nftAddress)) fail('registry getter returned an invalid collection address.');
  const value = entry.payoutPercentage;
  if (!['bigint', 'number', 'string'].includes(typeof value) ||
      !/^(0|[1-9][0-9]*)$/.test(String(value)) || BigInt(value) > 100n) fail('registry getter returned an invalid collection score.');
  return { nftAddress: entry.nftAddress, payoutPercentage: String(value) };
}
async function readRegistrySnapshot({ manager, provider, buildInfo, artifact, calls, compiler }) {
  if (!object(calls) || Object.keys(calls).some(k => k !== 'blockTag') ||
      !Number.isSafeInteger(calls.blockTag) || calls.blockTag < 0) fail('a single explicit numeric blockTag is required.');
  if (!manager || typeof manager.getAddress !== 'function' || typeof manager.agiTypes !== 'function' ||
      typeof manager.agentNftRequired !== 'function' || typeof manager.MAX_AGI_TYPES !== 'function' ||
      !provider || typeof provider.getStorage !== 'function') fail('required read-only manager/provider methods are unavailable.');
  const at = Object.freeze({ blockTag: calls.blockTag });
  const layout = deriveRegistryLayout(buildInfo, artifact, compiler);
  const managerAddress = await manager.getAddress();
  if (!address(managerAddress)) fail('manager address is invalid.');
  const maximum = await manager.MAX_AGI_TYPES(at);
  if (!['bigint', 'number', 'string'].includes(typeof maximum) || String(maximum) !== '32') fail('on-chain registry cap differs from 32.');
  const before = await provider.getStorage(managerAddress, BigInt(layout.slot), at.blockTag);
  const count = parseLength(before);
  const required = await manager.agentNftRequired(at);
  if (typeof required !== 'boolean') fail('on-chain NFT requirement is not a boolean.');
  const items = [], seen = new Set();
  for (let index = 0; index < count; index += 1) {
    // No exception is interpreted as end-of-array. Any failed in-range read blocks readiness.
    const entry = normalizeEntry(await manager.agiTypes(index, at));
    if (seen.has(entry.nftAddress.toLowerCase())) fail('on-chain registry contains duplicate collections.');
    seen.add(entry.nftAddress.toLowerCase());
    items.push(entry);
  }
  const after = await provider.getStorage(managerAddress, BigInt(layout.slot), at.blockTag);
  if (parseLength(after) !== count || after.toLowerCase() !== before.toLowerCase()) fail('registry length changed within the same pinned block.');
  return { agentNftRequired: required, agiTypes: items,
    evidence: { method: 'compiler-derived-length-and-bounded-getters', ...layout,
      manager: managerAddress, blockNumber: at.blockTag, count, lengthWord: before.toLowerCase(),
      endOfArrayRevertAssumptions: false, transactionsBroadcast: 0 } };
}
module.exports = { deriveRegistryLayout, validateLayout, parseLength, readRegistrySnapshot };
