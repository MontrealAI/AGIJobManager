'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const E = require('ethers');
const C = require('../scripts/qualified-build-catalog.cjs');
const X = require('../scripts/export-verification-package.cjs');
const P = require('../scripts/core-creation-plan.cjs');
const { FQNS } = require('../scripts/deploy.cjs');
const { deploymentConstructor } = require('../scripts/governance-deployment.cjs');

// Small synthetic compiler/archive fixtures exercise selection and encoding only.
// They are intentionally not represented as real compiled deployment qualification.
function fixture(t, { legacy = false, wrappers = false, compilerPrefix = true } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-catalog-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = { commit: 'a'.repeat(40), tree: 'b'.repeat(40) };
  const revision = { ...source, rootLockSha256: 'c'.repeat(64), hardhatLockSha256: 'd'.repeat(64) };
  const compiler = { version: '0.8.37', longVersion: '0.8.37+commit.f401782d' };
  const input = { language: 'Solidity', sources: {}, settings: { optimizer: { enabled: true, runs: 40 }, viaIR: true, evmVersion: 'shanghai', metadata: { bytecodeHash: 'none' }, debug: { revertStrings: 'strip' } } };
  const output = { contracts: {} }, artifacts = {}, sources = {}, sourceMap = {}, filenames = {};
  function write(filename, value) { fs.writeFileSync(path.join(directory, filename), typeof value === 'string' ? value : JSON.stringify(value)); return { path: filename, sha256: C.sha256(fs.readFileSync(path.join(directory, filename))) }; }
  for (const name of C.CORE_NAMES) {
    const sourceName = FQNS[name].split(':')[0], compilerSource = `${compilerPrefix ? 'project/' : ''}${sourceName}`;
    sourceMap[sourceName] = compilerSource;
    input.sources[compilerSource] = { content: `pragma solidity ^0.8.0; ${name === 'AGIJobManager' ? 'contract' : 'library'} ${name} {}` };
    sources[compilerSource] = write(`${name}.sol`, input.sources[compilerSource].content);
    const types = ['address', 'string', 'address[2]', 'bytes32[4]', 'bytes32[2]', 'address[2]', ...(legacy ? [] : ['address'])];
    const abi = name === 'AGIJobManager' ? [{ type: 'constructor', stateMutability: 'nonpayable', inputs: types.map((type, index) => ({ type, name: index === 6 ? 'initialGovernor' : `arg${index}` })) }] : [];
    const linkReferences = name === 'AGIJobManager' ? { [`${compilerPrefix ? 'project/' : ''}contracts/utils/UriUtils.sol`]: { UriUtils: [{ start: 1, length: 20 }] } } : {};
    const bytecode = name === 'AGIJobManager' ? `0x60__$${'a'.repeat(34)}$__00` : '0x60006000';
    const deployedBytecode = `0x60${'00'.repeat(20)}6000`;
    const immutableReferences = name === 'AGIJobManager' ? { '17': [{ start: 1, length: 20 }] } : {};
    const artifact = { contractName: name, sourceName, ...(compilerPrefix ? { inputSourceName: compilerSource } : {}), abi, bytecode, deployedBytecode, linkReferences, deployedLinkReferences: {}, immutableReferences };
    const filename = `${name}.artifact.json`;
    filenames[name] = filename;
    artifacts[name] = { ...write(filename, artifact), fqn: FQNS[name], constructorSchema: name === 'AGIJobManager' ? (legacy ? C.CONSTRUCTOR_SCHEMAS.legacy : C.CONSTRUCTOR_SCHEMAS.explicit) : C.CONSTRUCTOR_SCHEMAS.library };
    output.contracts[compilerSource] = { [name]: { abi, evm: { bytecode: { object: bytecode.slice(2), linkReferences }, deployedBytecode: { object: deployedBytecode.slice(2), linkReferences: {}, immutableReferences } } } };
  }
  const wrappedInput = wrappers ? { id: 'fixture-build', solcVersion: compiler.version, solcLongVersion: compiler.longVersion, userSourceNameMap: sourceMap, input } : input;
  const wrappedOutput = wrappers ? { id: 'fixture-build', output } : output;
  const entry = { source, compiler, input: write('compiler-input.json', wrappedInput), output: write('compiler-output.json', wrappedOutput), sources, artifacts };
  const catalog = { schema: C.CATALOG_SCHEMA, builds: { 'reviewed-fixture': entry } };
  let catalogSha256;
  const catalogPath = path.join(directory, 'catalog.json');
  function saveCatalog() { catalogSha256 = write('catalog.json', catalog).sha256; return catalogSha256; }
  saveCatalog();
  return { directory, source, revision, compiler, input, output, entry, catalog, catalogPath, filenames, write, saveCatalog,
    get catalogSha256() { return catalogSha256; },
    load: overrides => C.loadQualifiedBuild({ catalogPath, catalogSha256, buildId: 'reviewed-fixture', expectedRevision: revision, ...overrides }),
    artifact(name) { return JSON.parse(fs.readFileSync(path.join(directory, filenames[name]))); },
    saveArtifact(name, artifact) { Object.assign(artifacts[name], write(filenames[name], artifact)); saveCatalog(); },
    saveInput() { entry.input = write('compiler-input.json', wrappedInput); saveCatalog(); },
    saveOutput() { entry.output = write('compiler-output.json', wrappedOutput); saveCatalog(); },
  };
}
function config() {
  return { schema: 'manager-core-creation-config-v1', chainId: 1, creator: '0x1111111111111111111111111111111111111111', governor: P.GOVERNOR, governorAcknowledgement: P.GOVERNOR,
    nonce: 7, block: { number: 100, hash: `0x${'12'.repeat(32)}` }, expiresAfterBlock: 200,
    constructorArgs: { usdcTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', baseIpfsUrl: 'ipfs://fixture/', ensConfig: ['0x2222222222222222222222222222222222222222', E.ZeroAddress],
      rootNodes: Array(4).fill(E.ZeroHash), merkleRoots: Array(2).fill(E.ZeroHash), settlementWallets: ['0x3333333333333333333333333333333333333333', '0x4444444444444444444444444444444444444444'], initialGovernor: P.GOVERNOR },
    creatorPolicy: { mode: 'empty-eoa-direct-create.v1' }, qualificationEvidence: null,
    envelopes: Array.from({ length: 9 }, () => ({ gasLimit: '100000', maxFeePerGas: '100', maxPriorityFeePerGas: '1' })), maximumTotalFeeWei: '90000000' };
}
function exportFixture(f, output = 'export') {
  const build = f.load(), plan = P.makePlan(config(), build, f.revision);
  return { build, plan, outputDirectory: path.join(f.directory, output), observedRevision: f.revision };
}

test('explicit pinned catalog loads all nine immutable records without current-build fallback', t => {
  const f = fixture(t), build = f.load();
  assert.equal(build.id, 'reviewed-fixture'); assert.equal(Object.keys(build.records).length, 9);
  assert.equal(build.readArtifact(FQNS.AGIJobManager), build.records.AGIJobManager.artifact);
  assert.equal(build.getBuildInfo('UriUtils'), build.buildInfo);
  assert.equal(build.records.AGIJobManager.compilerQualifiedName, 'project/contracts/AGIJobManager.sol:AGIJobManager');
  assert.equal(build.assertUnchanged(), true); assert.equal(Object.isFrozen(build.input.sources), true);
  assert.throws(() => { build.records.AGIJobManager.artifact.abi.push({}); }, TypeError);
  assert.throws(() => build.readArtifact('ENSJobPages'), /not in the selected/);
  assert.throws(() => f.load({ buildId: undefined }), /no default/);
  assert.throws(() => f.load({ buildId: 'newest' }), /no fallback/);
  assert.throws(() => f.load({ catalogSha256: undefined }), /reviewed SHA256/);
});
test('explicit legacy call form and HH3 wrappers preserve original compiler identity', t => {
  const f = fixture(t, { wrappers: true });
  const build = C.loadQualifiedBuild(f.catalogPath, { expectedCatalogSha256: f.catalogSha256, buildId: 'reviewed-fixture', expectedRevision: f.revision });
  assert.equal(build.buildInfo.solcLongVersion, f.compiler.longVersion);
  assert.equal(build.buildInfo.userSourceNameMap['contracts/AGIJobManager.sol'], 'project/contracts/AGIJobManager.sol');
});
test('wrapper compiler version, build ID and archived compiler errors are checked', t => {
  const f = fixture(t, { wrappers: true });
  f.entry.compiler.longVersion = '0.8.37+commit.12345678'; f.saveCatalog();
  assert.throws(() => f.load(), /wrapper version mismatch/);
  const g = fixture(t, { wrappers: true }), output = JSON.parse(fs.readFileSync(path.join(g.directory, g.entry.output.path)));
  output.id = 'other-build'; g.entry.output = g.write(g.entry.output.path, output); g.saveCatalog();
  assert.throws(() => g.load(), /input\/output build ID mismatch/);
  const h = fixture(t); h.output.errors = [{ severity: 'error', message: 'Invalid source' }]; h.saveOutput();
  assert.throws(() => h.load(), /Compiler output contains errors/);
});
test('unknown catalog/schema fields and malformed compiler versions are rejected', t => {
  const f = fixture(t); f.catalog.currentBuild = 'reviewed-fixture'; f.saveCatalog();
  assert.throws(() => f.load(), /unknown field currentBuild/);
  const g = fixture(t); g.entry.compiler.longVersion = 'latest'; g.saveCatalog();
  assert.throws(() => g.load(), /Exact compiler version/);
  const h = fixture(t); h.catalog.schema = 'unversioned'; h.saveCatalog();
  assert.throws(() => h.load(), /Unsupported build catalog schema/);
});
test('archive paths may be absolute and outside the catalog directory when explicitly hash-pinned', t => {
  const f = fixture(t); f.entry.artifacts.UriUtils.path = path.join(f.directory, f.filenames.UriUtils); f.saveCatalog();
  assert.equal(f.load().records.UriUtils.artifact.contractName, 'UriUtils');
});
test('catalog checksum, independent source commit/tree and omitted revision fail closed', t => {
  const f = fixture(t);
  assert.throws(() => f.load({ catalogSha256: 'f'.repeat(64) }), /checksum mismatch/);
  for (const key of ['commit', 'tree']) assert.throws(() => f.load({ expectedRevision: { ...f.revision, [key]: 'f'.repeat(40) } }), /source.*mismatch/);
  assert.throws(() => f.load({ expectedRevision: undefined }), /Independently observed/);
});
for (const target of ['input', 'output']) test(`mutated compiler ${target} bytes fail even with intact artifact`, t => {
  const f = fixture(t); fs.appendFileSync(path.join(f.directory, f.entry[target].path), ' ');
  assert.throws(() => f.load(), /checksum mismatch/);
});
test('exact archived source bytes are checked against Standard JSON even after descriptor rehash', t => {
  const f = fixture(t), name = Object.keys(f.entry.sources)[0];
  f.entry.sources[name] = f.write(f.entry.sources[name].path, 'changed source'); f.saveCatalog();
  assert.throws(() => f.load(), /differs from pinned source bytes/);
});
test('complete source inventory rejects omitted and injected dependencies', t => {
  const f = fixture(t); delete f.entry.sources[Object.keys(f.entry.sources)[0]]; f.saveCatalog();
  assert.throws(() => f.load(), /Complete compiler source inventory/);
});
test('source URL imports cannot replace exact archived compiler source content', t => {
  const f = fixture(t), name = Object.keys(f.input.sources)[0]; f.input.sources[name] = { urls: ['https://invalid.example/source'] }; f.saveInput();
  assert.throws(() => f.load(), /requires content/);
});
for (const key of ['abi', 'bytecode', 'deployedBytecode', 'linkReferences', 'deployedLinkReferences', 'immutableReferences']) test(`artifact ${key} cannot diverge from pinned compiler output even after artifact rehash`, t => {
  const f = fixture(t), artifact = f.artifact('AGIJobManager');
  artifact[key] = key === 'abi' ? [] : key.includes('Bytecode') || key === 'bytecode' ? '0x1234' : { bad: [] };
  f.saveArtifact('AGIJobManager', artifact); assert.throws(() => f.load(), /mismatch/);
});
test('mixed archive artifact, wrong qualified name, and optional component inventory reject', t => {
  const f = fixture(t); f.entry.artifacts.UriUtils.path = f.entry.artifacts.BondMath.path; f.entry.artifacts.UriUtils.sha256 = f.entry.artifacts.BondMath.sha256; f.saveCatalog();
  assert.throws(() => f.load(), /qualified name mismatch/);
  f.entry.artifacts.ENSJobPages = f.entry.artifacts.BondMath; f.saveCatalog();
  assert.throws(() => f.load(), /Exactly nine core artifacts/);
});
test('old six-argument schema is loaded distinctly and works with legacy receipt decoding', t => {
  const f = fixture(t, { legacy: true, compilerPrefix: false }), build = f.load(), args = config().constructorArgs;
  const { initialGovernor, ...oldArgs } = args;
  const legacyReceipt = { constructorArgs: oldArgs, finalOwner: P.GOVERNOR };
  const constructor = deploymentConstructor(legacyReceipt, build.readArtifact('AGIJobManager'));
  assert.equal(constructor.length, 6);
  const encoded = new E.Interface(build.records.AGIJobManager.artifact.abi).encodeDeploy(constructor);
  assert.equal(E.AbiCoder.defaultAbiCoder().decode(['address', 'string', 'address[2]', 'bytes32[4]', 'bytes32[2]', 'address[2]'], encoded)[1], args.baseIpfsUrl);
  assert.throws(() => X.exportVerificationPackage({ build, plan: {}, observedRevision: f.revision, outputDirectory: path.join(f.directory, 'old-export') }), /historical six-argument/);
  f.entry.artifacts.AGIJobManager.constructorSchema = C.CONSTRUCTOR_SCHEMAS.explicit; f.saveCatalog();
  assert.throws(() => f.load(), /constructor schema mismatch/);
});
test('seven-argument archive cannot be relabeled legacy and governor name is explicit', t => {
  const f = fixture(t); f.entry.artifacts.AGIJobManager.constructorSchema = C.CONSTRUCTOR_SCHEMAS.legacy; f.saveCatalog();
  assert.throws(() => f.load(), /constructor schema mismatch/);
  f.entry.artifacts.AGIJobManager.constructorSchema = C.CONSTRUCTOR_SCHEMAS.explicit;
  const artifact = f.artifact('AGIJobManager'); artifact.abi[0].inputs[6].name = 'deployer';
  f.output.contracts['project/contracts/AGIJobManager.sol'].AGIJobManager.abi = artifact.abi; f.saveOutput(); f.saveArtifact('AGIJobManager', artifact);
  assert.throws(() => f.load(), /must name initialGovernor/);
});
test('HH2-style omission of artifact immutable refs still pins compiler output immutable positions', t => {
  const f = fixture(t, { legacy: true, compilerPrefix: false }), artifact = f.artifact('AGIJobManager'); delete artifact.immutableReferences; f.saveArtifact('AGIJobManager', artifact);
  assert.deepEqual(f.load().records.AGIJobManager.immutableReferences, { '17': [{ start: 1, length: 20 }] });
});
test('post-load source, catalog and artifact drift fails before use', t => {
  for (const target of ['catalog.json', 'UriUtils.sol', 'AGIJobManager.artifact.json']) {
    const f = fixture(t), build = f.load(); fs.appendFileSync(path.join(f.directory, target), ' ');
    assert.throws(() => build.assertUnchanged(), /drift/);
  }
});
test('symlink retargeting is drift even when replacement source has identical bytes', t => {
  const f = fixture(t), descriptor = f.entry.sources[Object.keys(f.entry.sources)[0]], original = path.join(f.directory, descriptor.path);
  const duplicate = path.join(f.directory, 'same-bytes.sol'); fs.copyFileSync(original, duplicate);
  const link = path.join(f.directory, 'source-link.sol'); fs.symlinkSync(original, link); descriptor.path = link; f.saveCatalog();
  const build = f.load(); fs.unlinkSync(link); fs.symlinkSync(duplicate, link);
  assert.throws(() => build.assertUnchanged(), /drift/);
});
test('a plain object pretending to be a reviewed build is not accepted by export', () => {
  assert.throws(() => X.exportVerificationPackage({ build: { assertUnchanged: () => true } }), /pinned build loaded/);
});
test('offline package exports exact new graph, Standard JSON, compiler/link identities and decodable seven-argument constructor', t => {
  const f = fixture(t), args = exportFixture(f), result = X.exportVerificationPackage(args), manifest = result.manifest;
  assert.equal(manifest.receiptProven, false); assert.equal(manifest.explorerAcceptanceObserved, false); assert.equal(manifest.activationAuthorized, false);
  assert.equal(manifest.contracts.length, 9); assert.equal(fs.existsSync(path.join(args.outputDirectory, 'INCOMPLETE')), false);
  for (const contract of manifest.contracts) {
    assert.equal(contract.addressStatus, 'predicted-not-deployed'); assert.equal(contract.receiptProvenAddress, null);
    assert.equal(contract.bytecode.deployedRuntimeKeccak256, null);
    assert.equal(contract.compilerVersion, 'v0.8.37+commit.f401782d');
    const input = JSON.parse(fs.readFileSync(path.join(args.outputDirectory, contract.compilerInput.filename)));
    assert.deepEqual(input.sources, args.build.input.sources);
    const abi = JSON.parse(fs.readFileSync(path.join(args.outputDirectory, contract.abi.filename)));
    assert.equal(new E.Interface(abi).encodeDeploy(args.plan.operations[contract.id].constructorArguments), contract.constructor.encoded);
    assert.equal(C.sha256(fs.readFileSync(path.join(args.outputDirectory, contract.compilerInput.filename))), contract.compilerInput.sha256);
  }
  const manager = manifest.contracts[8], decoded = E.AbiCoder.defaultAbiCoder().decode(['address', 'string', 'address[2]', 'bytes32[4]', 'bytes32[2]', 'address[2]', 'address'], manager.constructor.encoded);
  assert.equal(decoded[6], P.GOVERNOR); assert.equal(decoded[0], config().constructorArgs.usdcTokenAddress);
  assert.equal(manager.libraries['project/contracts/utils/UriUtils.sol:UriUtils'], args.plan.operations[0].predictedAddress);
  assert.match(fs.readFileSync(path.join(args.outputDirectory, 'README.txt'), 'utf8'), /PREDICTED ADDRESSES ONLY/);
  assert.throws(() => X.exportVerificationPackage(args), /EEXIST/);
});
test('export rejects fabricated receipt proof and keeps the output absent', t => {
  const f = fixture(t), args = exportFixture(f);
  assert.throws(() => X.exportVerificationPackage({ ...args, receipts: [{ receiptProven: true, address: args.plan.operations[0].predictedAddress }] }), /cannot authenticate/);
  assert.equal(fs.existsSync(args.outputDirectory), false);
});
for (const mutation of ['governor', 'address', 'envelope', 'constructor', 'source', 'buildId', 'graph']) test(`export independently reconstructs and rejects ${mutation} substitution`, t => {
  const f = fixture(t), args = exportFixture(f), plan = structuredClone(args.plan);
  if (mutation === 'governor') plan.governor = plan.creator;
  if (mutation === 'address') plan.operations[0].predictedAddress = plan.creator;
  if (mutation === 'envelope') plan.operations[0].envelope.maxFeePerGas = '101';
  if (mutation === 'constructor') plan.operations[8].constructorArguments[6] = plan.creator;
  if (mutation === 'source') plan.source.tree = 'e'.repeat(40);
  if (mutation === 'buildId') plan.buildId = 'unreviewed';
  if (mutation === 'graph') plan.operations.push(plan.operations[8]);
  assert.throws(() => X.exportVerificationPackage({ ...args, plan }), /substitution|differs/);
  assert.equal(fs.existsSync(args.outputDirectory), false);
});
test('export refuses source drift after a plan was assembled and refuses output symlinks', t => {
  const f = fixture(t), args = exportFixture(f); fs.appendFileSync(path.join(f.directory, 'UriUtils.sol'), ' ');
  assert.throws(() => X.exportVerificationPackage(args), /drift/); assert.equal(fs.existsSync(args.outputDirectory), false);
  const g = fixture(t), valid = exportFixture(g); fs.symlinkSync(g.directory, valid.outputDirectory);
  assert.throws(() => X.exportVerificationPackage(valid), /symlink/);
});
test('export refuses prelinked compiler input rather than overwriting old addresses', t => {
  const f = fixture(t); f.input.settings.libraries = { 'project/contracts/utils/UriUtils.sol': { UriUtils: '0x5555555555555555555555555555555555555555' } }; f.saveInput();
  const args = exportFixture(f);
  assert.throws(() => X.exportVerificationPackage(args), /Prelinked compiler inputs/);
  assert.equal(fs.existsSync(args.outputDirectory), false);
});
test('export validates only backward dependencies in the new graph', t => {
  const f = fixture(t), args = exportFixture(f), operation = structuredClone(args.plan.operations[8]);
  operation.libraries[FQNS.UriUtils] = operation.predictedAddress;
  assert.throws(() => X.neededLibraries(operation, args.build.records.AGIJobManager, args.plan.operations), /not a preceding CREATE/);
});
test('CLI rejects unknown credential/RPC/submission options before touching files', () => {
  for (const option of ['rpc-url', 'private-key', 'api-key', 'submit', 'trust-plan']) assert.throws(() => X.main([`--${option}`, 'forbidden']), /Use only/);
});
