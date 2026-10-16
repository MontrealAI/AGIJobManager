#!/usr/bin/env node
/** Offline regression. All roots/dependencies are explicit, never scratch defaults.
 * Usage: node test-prove-container-profile.mjs --profile-file <absolute-config>
 *   --profile local|hosted --source-root <root> --legacy-root <root>
 *   --dependency-root <node_modules>
 * No source/dependency files are modified; mutation tests use memory or our tmpdir.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ALGORITHM_PINS, PROFILE_SHA256, containerPath, loadProfileBytes, parseArgs,
  proveProfile, readRegular, reproduceBuildId, sha256, verifyContainerBytes,
  verifyDependencies,
} from './prove-container-profile.mjs';

const options = parseArgs(process.argv.slice(2));
const profileBytes = fs.readFileSync(options.profileFile);
const profile = loadProfileBytes(profileBytes);
const names = [];
function test(name, fn) { fn(); names.push(name); }
function rejects(fn, pattern = undefined) { assert.throws(fn, pattern); }
const originals = new Map();
function key(row) { return `${row.group}/${row.name}`; }
function rowFor(group, name) { return profile.containers.find(r => r.group === group && r.name === name); }
function swap(bytes, from, to) {
  const text = bytes.toString('utf8');
  assert.equal(text.split(from).length, 2, 'Replacement requires exactly one occurrence');
  return Buffer.from(text.replace(from, to));
}
function serialized(original, value) {
  const baseline = JSON.parse(original.toString('utf8'));
  const indent = original[1] === 10 ? 2 : undefined;
  const plain = JSON.stringify(baseline, null, indent);
  const newline = original.equals(Buffer.from(plain + '\n')) ? '\n' : '';
  assert.ok(original.equals(Buffer.from(plain + newline)), 'Serializer must preserve untouched raw bytes');
  return Buffer.from(JSON.stringify(value, null, indent) + newline);
}
function material(group, name, label, mutation) {
  const row = rowFor(group, name);
  test(`${group}/${name}: rejects ${label}`, () => {
    const original = originals.get(key(row));
    const value = JSON.parse(original);
    mutation(value);
    const changed = serialized(original, value);
    assert.ok(!changed.equals(original), 'Mutation must change bytes');
    rejects(() => verifyContainerBytes(changed, row, 'local'), /Raw container SHA256 differs/);
    const hosted = swap(changed, row.originalId, row.hostedId);
    rejects(() => verifyContainerBytes(hosted, row, 'hosted'), /Raw container SHA256 differs/);
  });
}

for (const row of profile.containers) {
  const root = row.group === 'new' ? options.sourceRoot : options.legacyRoot;
  const actual = readRegular(root, containerPath(row, options.mode));
  verifyContainerBytes(actual, row, options.mode);
  originals.set(key(row), options.mode === 'local' ? actual : swap(actual, row.hostedId, row.originalId));
}

test('exact profile anchor and immutable algorithm inventory', () => {
  assert.equal(sha256(profileBytes), PROFILE_SHA256);
  assert.deepEqual(profile.algorithmPins.files, ALGORITHM_PINS);
  assert.equal(Object.keys(ALGORITHM_PINS).length, 5);
  assert.ok(Object.isFrozen(profile) && Object.isFrozen(profile.containers[0]));
});
test('full proof is deterministic with both source generations and all 13 raw containers', () => {
  const proof = proveProfile(options);
  assert.deepEqual(proveProfile(options), proof);
  assert.equal(proof.verifiedContainerCount, 13);
  assert.equal(proof.containers.length, 13);
  assert.equal(proof.selectedProfile, options.mode);
  assert.equal(proof.scope, 'FINITE_RAW_CONTAINER_IDENTITY_PROOF_ONLY');
  for (const group of ['new', 'legacy']) {
    const row = rowFor(group, 'input');
    assert.deepEqual(proof.reproducedBuildInfoIds[group], { local: row.originalId, hosted: row.hostedId });
  }
});
for (const row of profile.containers) {
  test(`${key(row)}: both exact raw hashes and one-ID-only bijection`, () => {
    const local = originals.get(key(row));
    const hosted = swap(local, row.originalId, row.hostedId);
    assert.equal(sha256(local), row.originalSha256);
    assert.equal(sha256(hosted), row.hostedSha256);
    const localJson = verifyContainerBytes(local, row, 'local');
    const hostedJson = verifyContainerBytes(hosted, row, 'hosted');
    assert.equal(localJson[row.field], row.originalId);
    assert.equal(hostedJson[row.field], row.hostedId);
    hostedJson[row.field] = row.originalId;
    assert.deepEqual(hostedJson, localJson);
    assert.ok(swap(hosted, row.hostedId, row.originalId).equals(local));
    rejects(() => verifyContainerBytes(hosted, row, 'local'), /Raw container SHA256 differs/);
    rejects(() => verifyContainerBytes(local, row, 'hosted'), /Raw container SHA256 differs/);
  });
  material(row.group, row.name, 'unknown top-level field', x => { x.unreviewed = true; });
  test(`${key(row)}: mismatched ID reference fails closed`, () => {
    const changed = swap(originals.get(key(row)), row.originalId, 'solc-0_8_37-' + '0'.repeat(40));
    rejects(() => verifyContainerBytes(changed, row, 'local'), /Raw container SHA256 differs/);
  });
}
for (const group of ['new', 'legacy']) {
  const row = rowFor(group, 'input');
  const input = JSON.parse(originals.get(key(row)));
  test(`${group}: local and hosted IDs reproduced from pinned algorithm and raw input`, () => {
    assert.equal(reproduceBuildId(input, profile.compilerPaths.local), row.originalId);
    assert.equal(reproduceBuildId(input, profile.compilerPaths[group === 'new' ? 'newHosted' : 'legacyHosted']), row.hostedId);
    assert.notEqual(reproduceBuildId(input, profile.compilerPaths[group === 'new' ? 'legacyHosted' : 'newHosted']), row.hostedId);
  });
  test(`${group}: arbitrary checkout compiler paths rejected`, () => {
    rejects(() => reproduceBuildId(input, '/tmp/unreviewed/node_modules/solc/soljson.js'), /Unreviewed compiler path/);
  });
  const compilerMutations = [
    ['solc version', x => { x.solcVersion = '0.8.38'; }],
    ['long compiler version', x => { x.solcLongVersion += '-changed'; }],
    ['compiler type', x => { x.compilerType = 'unreviewed'; }],
    ['build-info format', x => { x._format += '-changed'; }],
    ['optimizer setting', x => { x.input.settings.optimizer.runs++; }],
    ['viaIR setting', x => { x.input.settings.viaIR = false; }],
    ['EVM target', x => { x.input.settings.evmVersion = 'cancun'; }],
    ['metadata setting', x => { x.input.settings.metadata.bytecodeHash = 'ipfs'; }],
    ['debug setting', x => { x.input.settings.debug.revertStrings = 'default'; }],
    ['output selection', x => { x.input.settings.outputSelection['*']['*'].push('storageLayout'); }],
    ['remappings', x => { x.input.settings.remappings.push('unreviewed/=project/'); }],
    ['unknown settings field', x => { x.input.settings.unreviewed = true; }],
    ['unknown input field', x => { x.input.unreviewed = true; }],
    ['unknown source field', x => { Object.values(x.input.sources)[0].unreviewed = true; }],
  ];
  for (const [label, mutate] of compilerMutations) {
    material(group, 'input', label, mutate);
    test(`${group}: reproduction rejects ${label}`, () => {
      const changed = structuredClone(input); mutate(changed);
      rejects(() => reproduceBuildId(changed, profile.compilerPaths.local));
    });
  }
  material(group, 'input', 'source content', x => { Object.values(x.input.sources)[0].content += '\n// changed source\n'; });
  test(`${group}: changed source creates an unreviewed ID`, () => {
    const changed = structuredClone(input); Object.values(changed.input.sources)[0].content += '\n// changed source\n';
    assert.notEqual(reproduceBuildId(changed, profile.compilerPaths.local), row.originalId);
    assert.notEqual(reproduceBuildId(changed, profile.compilerPaths[group === 'new' ? 'newHosted' : 'legacyHosted']), row.hostedId);
  });
  material(group, 'input', 'source-name map', x => { x.userSourceNameMap[Object.keys(x.userSourceNameMap)[0]] += '-changed'; });
  material(group, 'output', 'complete AST', x => { Object.values(x.output.sources)[0].ast.id++; });
  material(group, 'output', 'unknown compiler output field', x => { x.output.unreviewed = true; });
  for (const [label, mutate] of [
    ['emitted ABI', x => { x.abi.push({ type: 'error', name: 'Unreviewed', inputs: [] }); }],
    ['emitted initcode', x => { x.evm.bytecode.object += '00'; }],
    ['emitted runtime', x => { x.evm.deployedBytecode.object += '00'; }],
    ['emitted source map', x => { x.evm.bytecode.sourceMap += ';'; }],
    ['emitted links', x => { x.evm.bytecode.linkReferences.unreviewed = {}; }],
    ['emitted immutable references', x => { x.evm.deployedBytecode.immutableReferences.unreviewed = []; }],
    ['emitted method identifiers', x => { x.evm.methodIdentifiers.unreviewed = '00000000'; }],
    ['unknown emitted contract field', x => { x.unreviewed = true; }],
  ]) material(group, 'output', label, x => mutate(x.output.contracts['project/contracts/AGIJobManager.sol'].AGIJobManager));
}
for (const [label, mutate] of [
  ['ABI', x => { x.abi.push({ type: 'error', name: 'Unreviewed', inputs: [] }); }],
  ['initcode', x => { x.bytecode += '00'; }],
  ['runtime', x => { x.deployedBytecode += '00'; }],
  ['link references', x => { Object.values(Object.values(x.linkReferences)[0])[0][0].start++; }],
  ['deployed link references', x => { Object.values(Object.values(x.deployedLinkReferences)[0])[0][0].start++; }],
  ['immutable references', x => { Object.values(x.immutableReferences)[0][0].start++; }],
  ['contract name', x => { x.contractName += 'Changed'; }],
  ['input source name', x => { x.inputSourceName += 'Changed'; }],
]) material('new', 'AGIJobManager', label, mutate);

for (const [label, mutate] of [
  ['top-level unknown field', x => { x.unreviewed = true; }],
  ['provenance unknown field', x => { x.provenance.unreviewed = true; }],
  ['provenance history relabel', x => { x.provenance.rawWorkflowStatus = 'success'; }],
  ['compiler-path unknown field', x => { x.compilerPaths.unreviewed = '/tmp/path'; }],
  ['new compiler path', x => { x.compilerPaths.newHosted = '/tmp/path'; }],
  ['legacy compiler path', x => { x.compilerPaths.legacyHosted = x.compilerPaths.newHosted; }],
  ['algorithm unknown field', x => { x.algorithmPins.unreviewed = true; }],
  ['algorithm unpinned file', x => { delete x.algorithmPins.files[Object.keys(x.algorithmPins.files)[0]]; }],
  ['algorithm digest update', x => { x.algorithmPins.files[Object.keys(x.algorithmPins.files)[0]] = '0'.repeat(64); }],
  ['container unknown field', x => { x.containers[0].unreviewed = true; }],
  ['container hash update', x => { x.containers[0].hostedSha256 = '0'.repeat(64); }],
  ['container ID update', x => { x.containers[0].hostedId = 'solc-0_8_37-' + '0'.repeat(40); }],
  ['container missing row', x => { x.containers.pop(); }],
  ['container additional row', x => { x.containers.push(x.containers[0]); }],
  ['container traversal', x => { x.containers[0].relativePath = '../unreviewed'; }],
  ['profile selection', x => { x.profile = 'arbitrary'; }],
]) test(`profile rejects ${label}`, () => {
  const changed = JSON.parse(profileBytes); mutate(changed);
  rejects(() => loadProfileBytes(Buffer.from(JSON.stringify(changed, null, 2) + '\n')), /Unreviewed profile bytes/);
});
test('profile rejects duplicate JSON members', () => {
  const duplicate = profileBytes.toString('utf8').replace('{', '{"profile":"arbitrary",');
  rejects(() => loadProfileBytes(Buffer.from(duplicate)), /Unreviewed profile bytes/);
});
test('profile rejects noncanonical whitespace too', () => {
  rejects(() => loadProfileBytes(Buffer.concat([profileBytes, Buffer.from('\n')])), /Unreviewed profile bytes/);
});
for (const bad of ['auto', '', undefined, 'github-ubuntu-source-legacy-v1'])
  test(`unknown execution mode ${JSON.stringify(bad)} never falls back`, () => {
    rejects(() => containerPath(profile.containers[0], bad), /Explicit local or hosted/);
  });
test('CLI requires all explicit options and rejects aliases/duplicates', () => {
  const flags = ['--profile-file', options.profileFile, '--profile', options.mode,
    '--source-root', options.sourceRoot, '--legacy-root', options.legacyRoot,
    '--dependency-root', options.dependencyRoot];
  assert.deepEqual(parseArgs(flags), options);
  rejects(() => parseArgs(flags.slice(0, -2)), /All five explicit/);
  rejects(() => parseArgs([...flags, '--profile', 'hosted']), /Unknown, repeated/);
  rejects(() => parseArgs([...flags, '--normalize', 'true']), /Unknown, repeated/);
  rejects(() => parseArgs(flags.map(x => x === '--profile' ? '--prof' : x)), /Unknown, repeated/);
});
test('hosted mode rejects relocated filesystem roots before trusting containers', () => {
  rejects(() => proveProfile({ ...options, mode: 'hosted', sourceRoot: path.dirname(options.profileFile) }),
    /Hosted new checkout\/compiler path differs/);
});

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-container-proof-tests-'));
try {
  const deps = path.join(temp, 'node_modules'); fs.mkdirSync(deps);
  for (const relative of [...Object.keys(ALGORITHM_PINS), 'hardhat/package.json']) {
    const destination = path.join(deps, relative); fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, readRegular(options.dependencyRoot, relative));
  }
  test('five pinned algorithm/compiler files verify independently offline', () => verifyDependencies(deps, profile));
  for (const relative of Object.keys(ALGORITHM_PINS)) {
    test(`dependency mutation rejected: ${relative}`, () => {
      const filename = path.join(deps, relative); const bytes = fs.readFileSync(filename);
      try { fs.appendFileSync(filename, '\n'); rejects(() => verifyDependencies(deps, profile), /Algorithm\/compiler bytes differ/); }
      finally { fs.writeFileSync(filename, bytes); }
    });
  }
  test('wrong installed Hardhat version rejected', () => {
    const filename = path.join(deps, 'hardhat/package.json'); const bytes = fs.readFileSync(filename);
    try { const pkg = JSON.parse(bytes); pkg.version = '3.18.0'; fs.writeFileSync(filename, JSON.stringify(pkg));
      rejects(() => verifyDependencies(deps, profile), /Hardhat version differs/); }
    finally { fs.writeFileSync(filename, bytes); }
  });
  test('algorithm symlink alias rejected', () => {
    const relative = Object.keys(ALGORITHM_PINS)[0]; const filename = path.join(deps, relative);
    const saved = filename + '.original'; fs.renameSync(filename, saved);
    try { fs.symlinkSync(saved, filename); rejects(() => verifyDependencies(deps, profile), /Symlink in pinned path/); }
    finally { fs.unlinkSync(filename); fs.renameSync(saved, filename); }
  });
  test('hard-linked compiler file rejected', () => {
    const filename = path.join(deps, 'solc/soljson.js'); const alias = path.join(temp, 'compiler-alias');
    fs.linkSync(filename, alias);
    try { rejects(() => verifyDependencies(deps, profile), /Non-regular or hard-linked/); }
    finally { fs.unlinkSync(alias); }
  });
} finally { fs.rmSync(temp, { recursive: true, force: true }); }

console.log(JSON.stringify({ schema: 'agijobmanager/exact-build-container-regression/v1',
  passed: names.length, failed: 0, originalAndHostedContainers: 13,
  reproducedBuildIds: 4, profileSha256: PROFILE_SHA256, cases: names }, null, 2));
