import { createHash } from 'node:crypto';
import { getAddress, keccak256, ZeroAddress } from 'ethers';
import { canonicalJson } from './explorer.mjs';

const sha256 = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const stop = () => { throw Object.assign(new Error('EXACT_RUNTIME_EVIDENCE_REQUIRED'), { code: 'EXACT_RUNTIME_EVIDENCE_REQUIRED' }); };
const need = value => { if (!value) stop(); };
const hash32 = value => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value);
const digest = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const libraries = new Set(['UriUtils', 'TransferUtils', 'BondMath', 'ReputationMath', 'ENSOwnership', 'NftEligibility', 'JobSettlement', 'JobValidation']);
const address = value => { try { const parsed = getAddress(value); need(parsed !== ZeroAddress); return parsed; } catch { stop(); } };
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
function libraryMap(value) {
  need(plain(value)); const result = {};
  for (const [source, names] of Object.entries(value)) {
    if (typeof names === 'string') { need(source.includes(':')); result[source] = address(names); }
    else { need(plain(names)); for (const [name, target] of Object.entries(names)) result[`${source}:${name}`] = address(target); }
  }
  return result;
}

// Substitutions are exact values from the locally checked native build/plan.
// Nothing is masked, and undeclared code bytes must match byte for byte.
export function instantiateRuntime({ runtimeTemplate, linkReferences = {}, libraries: suppliedLibraries = {}, immutableReferences = {}, immutableValues = {}, librarySelfAddressReference, address: target, qualifiedName, source }) {
  need(typeof runtimeTemplate === 'string' && runtimeTemplate.startsWith('0x') && runtimeTemplate.length <= 2 + 24576 * 2 && runtimeTemplate.length > 2 && runtimeTemplate.length % 2 === 0);
  need(plain(linkReferences) && plain(immutableReferences) && plain(immutableValues));
  const bytes = runtimeTemplate.slice(2).toLowerCase().match(/../g), applied = new Map(), map = libraryMap(suppliedLibraries), used = new Set();
  const replace = (reference, value, length) => {
    need(plain(reference) && Object.keys(reference).length === 2 && Number.isSafeInteger(reference.start) && reference.start >= 0 && reference.length === length && reference.start + length <= bytes.length && typeof value === 'string' && new RegExp(`^0x[0-9a-f]{${length * 2}}$`, 'i').test(value));
    const selected = value.slice(2).toLowerCase().match(/../g);
    for (let i = 0; i < length; i++) { const offset = reference.start + i; need(!applied.has(offset) || applied.get(offset) === selected[i]); applied.set(offset, selected[i]); bytes[offset] = selected[i]; }
  };
  for (const [path, names] of Object.entries(linkReferences)) {
    need(plain(names));
    for (const [name, positions] of Object.entries(names)) {
      const key = `${path}:${name}`; need(map[key] && Array.isArray(positions) && positions.length > 0 && positions.length <= 1024); used.add(key);
      for (const position of positions) replace(position, map[key], 20);
    }
  }
  need(same(Object.keys(immutableReferences).sort(), Object.keys(immutableValues).sort()));
  for (const [id, positions] of Object.entries(immutableReferences)) {
    need(Array.isArray(positions) && positions.length > 0 && positions.length <= 1024);
    const self = id === 'library_deploy_address';
    if (self) { need(source?.repository === 'MontrealAI/AGIJobManager' && libraries.has(qualifiedName?.split(':').at(-1))); need(typeof immutableValues[id] === 'string' && /^0x(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(immutableValues[id]) && BigInt(immutableValues[id]) === BigInt(address(target))); }
    for (const position of positions) {
      const length = self && position.length === 20 ? 20 : 32;
      const value = self ? `0x${immutableValues[id].slice(2).padStart(64, '0').slice(-length * 2)}` : immutableValues[id];
      replace(position, value, length);
    }
  }
  if (librarySelfAddressReference !== undefined) {
    need(source?.repository === 'MontrealAI/AGIJobManager' && libraries.has(qualifiedName?.split(':').at(-1)) && runtimeTemplate.slice(2).toLowerCase().startsWith(`73${'00'.repeat(20)}3014`) && librarySelfAddressReference.start === 1 && librarySelfAddressReference.length === 20);
    replace(librarySelfAddressReference, address(target), 20);
  }
  const expected = `0x${bytes.join('')}`; need(/^0x(?:[0-9a-f]{2})+$/.test(expected)); return expected;
}

export function verifyRuntimeEvidence(evidence, { task, expectedSource } = {}) {
  try {
    const keys = ['schema', 'chainId', 'address', 'source', 'qualifiedName', 'compilerVersion', 'standardInputSha256', 'compilerOutputSha256', 'runtimeTemplate', 'linkReferences', 'libraries', 'immutableReferences', 'immutableValues', 'actualRuntime', 'creation', 'observedBlock', ...(evidence?.librarySelfAddressReference === undefined ? [] : ['librarySelfAddressReference'])];
    need(plain(evidence) && Object.keys(evidence).length === keys.length && keys.every(key => Object.hasOwn(evidence, key)) && evidence.schema === 'manual-ledger-runtime-evidence-v1' && evidence.chainId === 1 && task?.chainId === 1);
    need(plain(expectedSource) && /^[0-9a-f]{40}$/.test(expectedSource.commit) && /^[0-9a-f]{40}$/.test(expectedSource.tree) && same(evidence.source, expectedSource));
    need(address(evidence.address) === address(task.address) && evidence.qualifiedName === task.qualifiedName && evidence.compilerVersion === task.compilerVersion && evidence.standardInputSha256 === task.standardInputSha256 && digest(evidence.standardInputSha256) && digest(evidence.compilerOutputSha256));
    need(same(libraryMap(evidence.libraries), libraryMap(task.libraries)));
    const creation = evidence.creation, wanted = task.creation;
    need(plain(creation) && Object.keys(creation).length === 3 && hash32(creation.transactionHash) && hash32(creation.blockHash) && Number.isSafeInteger(creation.blockNumber) && creation.blockNumber >= 0 && creation.transactionHash.toLowerCase() === wanted.transactionHash.toLowerCase() && creation.blockHash.toLowerCase() === wanted.blockHash.toLowerCase() && creation.blockNumber === wanted.blockNumber);
    need(plain(evidence.observedBlock) && Object.keys(evidence.observedBlock).length === 2 && hash32(evidence.observedBlock.hash) && Number.isSafeInteger(evidence.observedBlock.number) && evidence.observedBlock.number >= creation.blockNumber);
    need(evidence.observedBlock.number !== creation.blockNumber || evidence.observedBlock.hash.toLowerCase() === creation.blockHash.toLowerCase());
    const expectedRuntime = instantiateRuntime(evidence);
    need(typeof evidence.actualRuntime === 'string' && /^0x(?:[a-f0-9]{2})+$/i.test(evidence.actualRuntime) && expectedRuntime === evidence.actualRuntime.toLowerCase());
    return Object.freeze({ schema: 'manual-ledger-runtime-result-v1', chainId: 1, address: address(evidence.address), source: Object.freeze({ ...expectedSource }), qualifiedName: evidence.qualifiedName, standardInputSha256: evidence.standardInputSha256, compilerOutputSha256: evidence.compilerOutputSha256, runtimeCodeHash: keccak256(expectedRuntime), substitutionsSha256: sha256({ linkReferences: evidence.linkReferences, libraries: evidence.libraries, immutableReferences: evidence.immutableReferences, immutableValues: evidence.immutableValues, librarySelfAddressReference: evidence.librarySelfAddressReference || null }), creation: Object.freeze({ ...creation }), observedBlock: Object.freeze({ ...evidence.observedBlock }), evidenceSha256: sha256(evidence), scope: 'EXACT_SUBSTITUTION_CHECK_AFTER_TRUSTED_LOCAL_NATIVE_SOURCE_BUILD_AND_CANONICAL_READS', authorityComplete: false, activationReady: false });
  } catch { stop(); }
}
