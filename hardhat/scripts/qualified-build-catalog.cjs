'use strict';
// Offline only. The expected catalog checksum and source revision are review inputs,
// not values recovered from the catalog itself. This module never reads Hardhat's
// current artifacts implicitly and never imports the network runtime.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Interface } = require('ethers');
const { buildDigest } = require('./governance-deployment.cjs');

const CATALOG_SCHEMA = 'manager-qualified-build-catalog-v1';
const LIBRARIES = Object.freeze(['UriUtils', 'TransferUtils', 'BondMath', 'ReputationMath', 'ENSOwnership', 'NftEligibility', 'JobSettlement', 'JobValidation']);
const CORE_NAMES = Object.freeze([...LIBRARIES, 'AGIJobManager']);
const MANAGER_TYPES = Object.freeze(['address', 'string', 'address[2]', 'bytes32[4]', 'bytes32[2]', 'address[2]']);
const CONSTRUCTOR_SCHEMAS = Object.freeze({ legacy: 'manager-six-v1', explicit: 'manager-seven-explicit-governor-v2', library: 'library-zero-v1' });
const SHA = /^[a-f0-9]{64}$/;
const GIT = /^[a-f0-9]{40}$/;
const loadedBuilds = new WeakSet();

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const stable = value => JSON.stringify(canonical(value));
const sha256 = value => createHash('sha256').update(value).digest('hex');
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${label} must be an object.`);
  return value;
}
function fields(value, required, optional, label) {
  object(value, label);
  for (const key of required) if (!Object.hasOwn(value, key)) throw Error(`${label} requires ${key}.`);
  for (const key of Object.keys(value)) if (![...required, ...optional].includes(key)) throw Error(`${label} has unknown field ${key}.`);
}
function same(actual, expected, label) {
  if (stable(actual) !== stable(expected)) throw Error(`${label} mismatch.`);
}
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function validateRevision(source, expected) {
  fields(source, ['commit', 'tree'], ['rootLockSha256', 'hardhatLockSha256'], 'Catalog source');
  if (!GIT.test(source.commit) || !GIT.test(source.tree)) throw Error('Exact full source commit and tree are required.');
  object(expected, 'Independently observed revision');
  for (const key of Object.keys(source)) {
    if (key.endsWith('Sha256') && !SHA.test(source[key])) throw Error(`Invalid source ${key}.`);
    if (source[key] !== expected[key]) throw Error(`Independently observed source ${key} mismatch.`);
  }
}
function constructorSchema(artifact, requested) {
  const constructors = artifact.abi.filter(entry => entry.type === 'constructor');
  if (constructors.length > 1) throw Error('Duplicate artifact constructor.');
  const entry = constructors[0];
  const types = (entry?.inputs || []).map(input => input.type);
  if (entry && !['nonpayable', undefined].includes(entry.stateMutability)) throw Error('Core constructors must be nonpayable.');
  if (artifact.contractName === 'AGIJobManager') {
    const expected = requested === CONSTRUCTOR_SCHEMAS.legacy ? MANAGER_TYPES
      : requested === CONSTRUCTOR_SCHEMAS.explicit ? [...MANAGER_TYPES, 'address'] : null;
    if (!expected || stable(types) !== stable(expected)) throw Error('Manager constructor schema mismatch: explicitly pin the original six-argument or new seven-argument build.');
    if (requested === CONSTRUCTOR_SCHEMAS.explicit && entry.inputs[6].name !== 'initialGovernor') throw Error('Explicit Manager constructor must name initialGovernor.');
  } else if (requested !== CONSTRUCTOR_SCHEMAS.library || types.length !== 0 || !LIBRARIES.includes(artifact.contractName)) {
    throw Error('Unsupported core library constructor schema.');
  }
  // Parsing the full ABI also rejects malformed fragments before consumers encode.
  new Interface(artifact.abi);
  return requested;
}

function loadQualifiedBuild(options, legacyOptions = {}) {
  if (typeof options === 'string') options = { ...legacyOptions, catalogPath: options, catalogSha256: legacyOptions.expectedCatalogSha256 };
  object(options, 'Build selection');
  const { catalogPath, catalogSha256 = options.expectedCatalogSha256, buildId, expectedRevision } = options;
  if (typeof catalogPath !== 'string' || !catalogPath || !SHA.test(catalogSha256 || '') || typeof buildId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(buildId)) {
    throw Error('Explicit catalog path, reviewed SHA256 and recorded buildId are required; there is no default/current build fallback.');
  }
  const base = path.dirname(path.resolve(catalogPath)), tracked = [];
  function pinned(descriptor, label, limit = 64 * 1024 * 1024) {
    fields(descriptor, ['path', 'sha256'], [], label);
    if (typeof descriptor.path !== 'string' || !descriptor.path || descriptor.path.includes('\0') || !SHA.test(descriptor.sha256)) throw Error(`${label} requires an exact file path and SHA256.`);
    const filename = path.resolve(base, descriptor.path);
    const realPath = fs.realpathSync(filename), stat = fs.statSync(filename);
    if (!stat.isFile() || stat.size > limit) throw Error(`${label} is not a bounded regular file.`);
    const bytes = fs.readFileSync(filename);
    if (bytes.length > limit || sha256(bytes) !== descriptor.sha256) throw Error(`${label} checksum mismatch.`);
    tracked.push({ filename, realPath, sha256: descriptor.sha256, limit });
    return bytes;
  }
  function json(descriptor, label, limit) {
    try { return JSON.parse(pinned(descriptor, label, limit).toString('utf8')); }
    catch (error) { throw Error(`${label}: ${error.message}`); }
  }
  const catalog = json({ path: path.resolve(catalogPath), sha256: catalogSha256 }, 'Reviewed build catalog', 4 * 1024 * 1024);
  fields(catalog, ['schema', 'builds'], [], 'Build catalog');
  if (catalog.schema !== CATALOG_SCHEMA) throw Error('Unsupported build catalog schema.');
  object(catalog.builds, 'Catalog builds');
  if (!Object.hasOwn(catalog.builds, buildId)) throw Error(`Recorded buildId ${buildId} is absent; no fallback is permitted.`);
  const entry = catalog.builds[buildId];
  fields(entry, ['source', 'compiler', 'input', 'output', 'sources', 'artifacts'], [], `Build ${buildId}`);
  validateRevision(entry.source, expectedRevision);
  fields(entry.compiler, ['version', 'longVersion'], [], 'Compiler identity');
  if (!/^0\.8\.\d+$/.test(entry.compiler.version) || !new RegExp(`^${entry.compiler.version.replaceAll('.', '\\.')}\\+commit\\.[a-f0-9]{8}(?:\\.[a-zA-Z0-9.+-]+)?$`).test(entry.compiler.longVersion)) throw Error('Exact compiler version and long version are required.');
  const rawInput = json(entry.input, 'Compiler input'), rawOutput = json(entry.output, 'Compiler output');
  const input = rawInput.input || rawInput, output = rawOutput.output || rawOutput;
  if (rawInput.input) {
    if (rawInput.solcVersion !== entry.compiler.version || rawInput.solcLongVersion !== entry.compiler.longVersion) throw Error('Compiler wrapper version mismatch.');
    if (rawOutput.output && rawInput.id !== rawOutput.id) throw Error('Compiler input/output build ID mismatch.');
  }
  if (input.language !== 'Solidity') throw Error('Only Solidity standard JSON builds are supported.');
  object(input.settings, 'Compiler settings'); object(input.sources, 'Compiler input sources'); object(output.contracts, 'Compiler output contracts');
  if (output.errors?.some(error => error.severity === 'error')) throw Error('Compiler output contains errors.');
  object(entry.sources, 'Pinned source closure');
  same(Object.keys(entry.sources).sort(), Object.keys(input.sources).sort(), 'Complete compiler source inventory');
  if (!Object.keys(entry.sources).length || Object.keys(entry.sources).length > 10000) throw Error('Source inventory must be nonempty and bounded.');
  const sourceChecksums = {};
  for (const [name, descriptor] of Object.entries(entry.sources)) {
    const source = input.sources[name];
    fields(source, ['content'], ['keccak256'], `Compiler source ${name}`);
    if (typeof source.content !== 'string') throw Error(`Compiler source ${name} must contain exact content; remote URLs are unsupported.`);
    const bytes = pinned(descriptor, `Source ${name}`, 16 * 1024 * 1024);
    if (!bytes.equals(Buffer.from(source.content, 'utf8'))) throw Error(`Compiler source ${name} differs from pinned source bytes.`);
    sourceChecksums[name] = descriptor.sha256;
  }
  object(entry.artifacts, 'Pinned core artifacts');
  same(Object.keys(entry.artifacts).sort(), [...CORE_NAMES].sort(), 'Exactly nine core artifacts');
  const records = {};
  for (const name of CORE_NAMES) {
    const descriptor = entry.artifacts[name];
    fields(descriptor, ['path', 'sha256', 'fqn', 'constructorSchema'], [], `Artifact ${name}`);
    const artifact = json({ path: descriptor.path, sha256: descriptor.sha256 }, `Artifact ${name}`);
    if (typeof descriptor.fqn !== 'string') throw Error(`Artifact ${name} requires a compiler-qualified name.`);
    const separator = descriptor.fqn.lastIndexOf(':'), selectedSourceName = descriptor.fqn.slice(0, separator);
    const sourceName = artifact.inputSourceName || rawInput.userSourceNameMap?.[artifact.sourceName] || artifact.sourceName;
    if (separator < 1 || descriptor.fqn.slice(separator + 1) !== name || artifact.contractName !== name || !Object.hasOwn(input.sources, sourceName)) throw Error(`Artifact ${name} qualified name mismatch.`);
    if (![sourceName, artifact.sourceName].includes(selectedSourceName)) throw Error(`Artifact ${name} source name mismatch.`);
    if (rawInput.userSourceNameMap?.[artifact.sourceName] && rawInput.userSourceNameMap[artifact.sourceName] !== sourceName) throw Error(`Artifact ${name} source mapping mismatch.`);
    const contract = output.contracts[sourceName]?.[name];
    if (!contract?.evm?.bytecode || !contract?.evm?.deployedBytecode || !Array.isArray(artifact.abi)) throw Error(`Compiler output missing ${descriptor.fqn}.`);
    same(artifact.abi, contract.abi, `${name} ABI`);
    for (const [key, expected] of Object.entries({ bytecode: `0x${contract.evm.bytecode.object}`, deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
      linkReferences: contract.evm.bytecode.linkReferences || {}, deployedLinkReferences: contract.evm.deployedBytecode.linkReferences || {} })) same(artifact[key], expected, `${name} ${key}`);
    const immutableReferences = contract.evm.deployedBytecode.immutableReferences || {};
    // HH2 archives can omit this artifact field; the exact compiler output is still
    // mandatory, hash-pinned, and supplies immutable positions to every consumer.
    if (Object.hasOwn(artifact, 'immutableReferences')) same(artifact.immutableReferences, immutableReferences, `${name} immutable references`);
    if (artifact.buildInfoId !== undefined && rawInput.id !== undefined && artifact.buildInfoId !== rawInput.id) throw Error(`${name} artifact build identity mismatch.`);
    constructorSchema(artifact, descriptor.constructorSchema);
    records[name] = { artifact, fqn: descriptor.fqn, qualifiedName: descriptor.fqn, compilerQualifiedName: `${sourceName}:${name}`, constructorSchema: descriptor.constructorSchema, artifactSha256: descriptor.sha256,
      immutableReferences, abiSha256: sha256(stable(artifact.abi)), bytecodeSha256: sha256(artifact.bytecode), deployedBytecodeSha256: sha256(artifact.deployedBytecode),
      linkReferencesSha256: sha256(stable({ creation: artifact.linkReferences, runtime: artifact.deployedLinkReferences, immutableReferences })) };
  }
  const buildInfo = { ...(rawInput.input ? rawInput : {}), input, output, solcVersion: entry.compiler.version, solcLongVersion: entry.compiler.longVersion };
  function readRecord(name) {
    const record = records[name] || Object.values(records).find(value => value.fqn === name || `${value.artifact.sourceName}:${value.artifact.contractName}` === name);
    if (!record) throw Error(`Artifact ${name} is not in the selected core build.`);
    return record;
  }
  const build = { id: buildId, source: entry.source, compiler: entry.compiler, input, output, buildInfo, records,
    buildDigest: buildDigest(buildInfo), catalogSha256, inputSha256: entry.input.sha256, outputSha256: entry.output.sha256, sourceChecksums,
    identity: { catalogSha256, inputSha256: entry.input.sha256, outputSha256: entry.output.sha256 },
    readArtifact: name => readRecord(name).artifact,
    getBuildInfo: name => { readRecord(name); return buildInfo; },
    assertUnchanged() {
      for (const file of tracked) {
        const stat = fs.statSync(file.filename);
        if (!stat.isFile() || stat.size > file.limit || fs.realpathSync(file.filename) !== file.realPath || sha256(fs.readFileSync(file.filename)) !== file.sha256) throw Error(`Pinned source/build file drift: ${file.filename}`);
      }
      return true;
    },
  };
  build.assertUnchanged();
  deepFreeze(build); loadedBuilds.add(build);
  return build;
}
function requireQualifiedBuild(build) {
  if (!loadedBuilds.has(build)) throw Error('A pinned build loaded by loadQualifiedBuild is required.');
  build.assertUnchanged();
  return build;
}

module.exports = { CATALOG_SCHEMA, CORE_NAMES, LIBRARIES, CONSTRUCTOR_SCHEMAS, loadQualifiedBuild, requireQualifiedBuild, constructorSchema, validateRevision, stable, sha256 };
