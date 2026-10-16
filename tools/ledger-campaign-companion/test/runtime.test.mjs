import test from 'node:test';
import assert from 'node:assert/strict';
import { instantiateRuntime, verifyRuntimeEvidence } from '../verification/runtime.mjs';

const target = '0x1111111111111111111111111111111111111111', library = '0x2222222222222222222222222222222222222222';
const source = { repository: 'MontrealAI/AGIJobManager', commit: 'c2f72180d2f0d6ecd5b92d8e5197c5344be2c699', tree: '8b0d8816ce3cdaa1103d37eaa34f4d40bf72972f' };
function fixture() {
  const creation = { transactionHash: `0x${'aa'.repeat(32)}`, blockHash: `0x${'bb'.repeat(32)}`, blockNumber: 5 };
  const evidence = { schema: 'manual-ledger-runtime-evidence-v1', chainId: 1, address: target, source, qualifiedName: 'contracts/AGIJobManager.sol:AGIJobManager', compilerVersion: 'v0.8.37+commit.f401782d', standardInputSha256: 'a'.repeat(64), compilerOutputSha256: 'b'.repeat(64), runtimeTemplate: `0x60${'00'.repeat(32)}61`, linkReferences: {}, libraries: {}, immutableReferences: { 123: [{ start: 1, length: 32 }] }, immutableValues: { 123: `0x${'00'.repeat(12)}${library.slice(2)}` }, actualRuntime: `0x60${'00'.repeat(12)}${library.slice(2)}61`, creation, observedBlock: { hash: creation.blockHash, number: 5 } };
  const task = { chainId: 1, address: target, qualifiedName: evidence.qualifiedName, compilerVersion: evidence.compilerVersion, standardInputSha256: evidence.standardInputSha256, libraries: {}, creation: { ...creation, canonical: true, finalized: true, runtimeVerified: true } };
  return { evidence, task, expectedSource: source };
}
test('exact legitimate immutable substitutions bind source build task receipt and runtime', () => {
  const f = fixture(), result = verifyRuntimeEvidence(f.evidence, f);
  assert.equal(result.address, target); assert.equal(result.authorityComplete, false); assert.equal(result.creation.blockNumber, 5);
});
test('changed nonimmutable byte fails instead of masking runtime', () => { const f = fixture(); f.evidence.actualRuntime = f.evidence.actualRuntime.slice(0, -2) + '62'; assert.throws(() => verifyRuntimeEvidence(f.evidence, f), /EXACT_RUNTIME/); });
test('wrong immutable value is not accepted as arbitrary wildcard', () => { const f = fixture(); f.evidence.immutableValues[123] = `0x${'00'.repeat(32)}`; assert.throws(() => verifyRuntimeEvidence(f.evidence, f), /EXACT_RUNTIME/); });
test('runtime observation at the creation height must have the exact creation block hash', () => { const f = fixture(); f.evidence.observedBlock.hash = `0x${'dd'.repeat(32)}`; assert.throws(() => verifyRuntimeEvidence(f.evidence, f), /EXACT_RUNTIME/); });
test('unmodeled immutable, overlap conflict, out of bounds, and non32 range fail', () => {
  for (const mutate of [f => { f.evidence.immutableValues.extra = `0x${'00'.repeat(32)}`; }, f => { f.evidence.immutableReferences.other = [{ start: 1, length: 32 }]; f.evidence.immutableValues.other = `0x${'ff'.repeat(32)}`; }, f => { f.evidence.immutableReferences[123][0].start = 32; }, f => { f.evidence.immutableReferences[123][0].length = 20; }]) { const f = fixture(); mutate(f); assert.throws(() => verifyRuntimeEvidence(f.evidence, f), /EXACT_RUNTIME/); }
});
test('exact declared link references replace only the link bytes', () => {
  const selected = { runtimeTemplate: `0x60${'_'.repeat(40)}61`, linkReferences: { 'contracts/Library.sol': { Library: [{ start: 1, length: 20 }] } }, libraries: { 'contracts/Library.sol:Library': library } };
  assert.equal(instantiateRuntime(selected), `0x60${library.slice(2)}61`);
  assert.throws(() => instantiateRuntime({ ...selected, linkReferences: {} }), /EXACT_RUNTIME/);
  assert.throws(() => instantiateRuntime({ ...selected, libraries: {} }), /EXACT_RUNTIME/);
});
test('known Manager library self address guard is instantiated without masking', () => {
  const selected = { runtimeTemplate: `0x73${'00'.repeat(20)}301460`, qualifiedName: 'contracts/utils/UriUtils.sol:UriUtils', source, address: target, librarySelfAddressReference: { start: 1, length: 20 } };
  assert.equal(instantiateRuntime(selected), `0x73${target.slice(2)}301460`);
  for (const extra of [{ qualifiedName: 'contracts/Other.sol:Other' }, { source: { ...source, repository: 'MontrealAI/AGI-Alpha-Agent-v0' } }, { runtimeTemplate: `0x72${'00'.repeat(20)}301460` }]) assert.throws(() => instantiateRuntime({ ...selected, ...extra }), /EXACT_RUNTIME/);
});
test('compiler library_deploy_address permits exact20byte reference only for known target', () => {
  const selected = { runtimeTemplate: `0x73${'00'.repeat(20)}301460`, qualifiedName: 'contracts/utils/TransferUtils.sol:TransferUtils', source, address: target, immutableReferences: { library_deploy_address: [{ start: 1, length: 20 }] }, immutableValues: { library_deploy_address: `0x${'00'.repeat(12)}${target.slice(2)}` } };
  assert.equal(instantiateRuntime(selected), `0x73${target.slice(2)}301460`);
  assert.throws(() => instantiateRuntime({ ...selected, immutableValues: { library_deploy_address: library } }), /EXACT_RUNTIME/);
});
test('wrong source, compiler, input/output identity, receipt, block or task library fails', () => {
  for (const mutate of [f => { f.evidence.source = { ...source, commit: '0'.repeat(40) }; }, f => { f.evidence.compilerVersion = 'v0.8.36+commit.12345678'; }, f => { f.evidence.standardInputSha256 = 'c'.repeat(64); }, f => { f.evidence.compilerOutputSha256 = ''; }, f => { f.evidence.creation = { ...f.evidence.creation, blockHash: `0x${'cc'.repeat(32)}` }; }, f => { f.evidence.observedBlock.number = 4; }, f => { f.task.libraries = { 'contracts/Library.sol:Library': library }; }, f => { f.evidence.extra = true; }]) { const f = fixture(); mutate(f); assert.throws(() => verifyRuntimeEvidence(f.evidence, f), /EXACT_RUNTIME/); }
});
