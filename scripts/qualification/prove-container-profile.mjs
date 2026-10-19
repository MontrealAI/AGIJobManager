#!/usr/bin/env node
/**
 * Offline, finite proof of the two reviewed Hardhat 3.17.0 container identities.
 *
 * This does not normalize containers or execute Hardhat/compiler code. It reads
 * pinned bytes, reproduces the pinned compilation-job SHA-1 algorithm, and
 * proves an exactly-one-ID raw-byte replacement against both SHA-256 inventories.
 * SHA-1 is used only to reproduce Hardhat's identifier. SHA-256 gates every input
 * container, compiler/algorithm file and this finite profile. No other path, ID,
 * field, compiler setting, or raw byte is authorized by this proof.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROFILE_SHA256 = '54fb5c6079eb6a864d1636ab4620f9d8a5f2982411e616f731db124f1923d115';
export const HARDHAT_CONFIG_SHA256 = '3107bcfd3239cb05ef5580a368ec7b1b929e091b2caf3f15377733d3abfe6701';
export const ALGORITHM_PINS = Object.freeze({
  'hardhat/dist/src/internal/builtin-plugins/solidity/build-system/compilation-job.js': '275be13130c43c5bcb4c47b4d04ad4511fade8481d3936778fa477a0c315944a',
  'hardhat/dist/src/internal/builtin-plugins/solidity/config.js': 'b840ae481dc7eed944208f1f845cef1eed9e860346d7384c7bdeb60678bb8c49',
  'hardhat/dist/src/internal/builtin-plugins/solidity/constants.js': 'f2763ebc1d110ff6ac32c096951879c4222a450958d66a68637a1b3d6a408199',
  '@nomicfoundation/hardhat-utils/dist/src/crypto.js': 'e0b55244336fcd3c0fb79c0c5b04185bad7eb8da6adaf4ceaf6e726c0fc26089',
  'solc/soljson.js': '221d7a667378b5068d913e75fe092507e061363cd1d23b64c49ae82febabad4c',
});
const COMPILER_PATHS = Object.freeze({
  local: '/workspace/scratch/1f6e2f637e9a/manager-contract-release/node_modules/solc/soljson.js',
  newHosted: '/home/runner/work/AGIJobManager/AGIJobManager/source/node_modules/solc/soljson.js',
  legacyHosted: '/home/runner/work/AGIJobManager/AGIJobManager/legacy/node_modules/solc/soljson.js',
});
const BUILD_IDS = Object.freeze({
  new: Object.freeze({
    local: 'solc-0_8_37-c48503217d7cdeb22c885f874edf69d853ed61ef',
    hosted: 'solc-0_8_37-0e0932bc08790631000b55a1ef3533986d0b3e7b',
  }),
  legacy: Object.freeze({
    local: 'solc-0_8_37-e57a67cf6480b203ed6e0d62566d9965e30cc4cc',
    hosted: 'solc-0_8_37-6abbda350a4da86f0a2ff0f321dd2dbcbd909e40',
  }),
});
const OUTPUT_SELECTION = {
  '*': {
    '': ['ast'],
    '*': ['abi', 'evm.bytecode.linkReferences', 'evm.bytecode.object',
      'evm.bytecode.opcodes', 'evm.bytecode.sourceMap',
      'evm.deployedBytecode.immutableReferences', 'evm.deployedBytecode.linkReferences',
      'evm.deployedBytecode.object', 'evm.deployedBytecode.opcodes',
      'evm.deployedBytecode.sourceMap', 'evm.methodIdentifiers'],
  },
};
const SOLC_VERSION = '0.8.37';
const SOLC_LONG_VERSION = '0.8.37+commit.f401782d';
const FORMAT = 'hh3-sol-build-info-1';
const HEX64 = /^[0-9a-f]{64}$/;

export function requireProof(condition, message) {
  if (!condition) throw new Error(message);
}
export function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function sha1(bytes) { return createHash('sha1').update(bytes).digest('hex'); }
function same(actual, expected, message) {
  try { assert.deepStrictEqual(actual, expected); } catch { throw new Error(message); }
}
function exactKeys(value, keys, message) {
  requireProof(value !== null && typeof value === 'object' && !Array.isArray(value), message);
  same(Object.keys(value).sort(), [...keys].sort(), message);
}
function deepFreeze(object) {
  for (const value of Object.values(object)) if (value && typeof value === 'object') deepFreeze(value);
  return Object.freeze(object);
}

/** The raw profile anchor makes added/duplicate fields and altered pins fail closed. */
export function loadProfileBytes(bytes) {
  requireProof(Buffer.isBuffer(bytes), 'Profile must be raw bytes');
  requireProof(sha256(bytes) === PROFILE_SHA256, 'Unreviewed profile bytes');
  const profile = JSON.parse(bytes.toString('utf8'));
  exactKeys(profile, ['schema', 'profile', 'sourceCommit', 'sourceTree',
    'baselineExpectationsSha256', 'provenance', 'compilerPaths', 'algorithmPins',
    'containers'], 'Profile fields differ');
  requireProof(profile.schema === 'agijobmanager/exact-build-containers/v1' &&
    profile.profile === 'github-ubuntu-source-legacy-v1', 'Unknown container profile');
  same(profile.compilerPaths, COMPILER_PATHS, 'Compiler path profile differs');
  same(profile.algorithmPins, { hardhatVersion: '3.17.0', files: ALGORITHM_PINS },
    'Algorithm pins differ');
  requireProof(Array.isArray(profile.containers) && profile.containers.length === 13,
    'Exact 13-container inventory required');
  const names = new Set();
  for (const row of profile.containers) {
    exactKeys(row, ['group', 'name', 'relativePath', 'field', 'originalId', 'hostedId',
      'originalSha256', 'hostedSha256'], 'Container row fields differ');
    const ids = BUILD_IDS[row.group];
    requireProof(ids && row.originalId === ids.local && row.hostedId === ids.hosted,
      'Container ID profile differs');
    requireProof(!names.has(`${row.group}/${row.name}`), 'Duplicate container row');
    names.add(`${row.group}/${row.name}`);
    requireProof(HEX64.test(row.originalSha256) && HEX64.test(row.hostedSha256),
      'Container digest differs');
    safeRelative(row.relativePath);
    const wrapper = row.name === 'input' || row.name === 'output';
    requireProof(row.field === (wrapper ? 'id' : 'buildInfoId'), 'Container ID field differs');
  }
  return deepFreeze(profile);
}
function safeRelative(name) {
  requireProof(typeof name === 'string' && name.length > 0 && !path.isAbsolute(name) &&
    !name.includes('\\') && name.split('/').every(p => p && p !== '.' && p !== '..' && p !== '.git') &&
    !/[\x00-\x1f\x7f]/.test(name), 'Unsafe relative path');
  return name;
}
export function exactDirectory(value) {
  requireProof(typeof value === 'string' && path.isAbsolute(value) &&
    path.resolve(value) === value && fs.realpathSync(value) === value &&
    fs.lstatSync(value).isDirectory(), 'Exact absolute directory required');
  return value;
}
export function readRegular(root, name) {
  const filename = path.join(root, safeRelative(name));
  requireProof(fs.realpathSync(filename) === filename, 'Symlink in pinned path');
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    requireProof(before.isFile() && before.nlink === 1n, 'Non-regular or hard-linked pinned file');
    const bytes = fs.readFileSync(fd);
    const after = fs.fstatSync(fd, { bigint: true });
    for (const key of ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'])
      requireProof(before[key] === after[key], 'Pinned file changed during observation');
    const current = fs.lstatSync(filename, { bigint: true });
    for (const key of ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'])
      requireProof(current[key] === after[key], 'Pinned file alias changed during observation');
    requireProof(fs.realpathSync(filename) === filename, 'Pinned file alias changed during observation');
    return bytes;
  } finally { fs.closeSync(fd); }
}

/** Pure transcription of the pinned default-profile algorithm; property order matters. */
export function reproduceBuildId(inputWrapper, compilerPath) {
  requireProof(Object.values(COMPILER_PATHS).includes(compilerPath), 'Unreviewed compiler path');
  exactKeys(inputWrapper, ['_format', 'id', 'solcVersion', 'solcLongVersion',
    'compilerType', 'userSourceNameMap', 'input'], 'Build-info input fields differ');
  requireProof(inputWrapper._format === FORMAT && inputWrapper.solcVersion === SOLC_VERSION &&
    inputWrapper.solcLongVersion === SOLC_LONG_VERSION && inputWrapper.compilerType === 'solc',
    'Compiler identity differs');
  exactKeys(inputWrapper.input, ['language', 'settings', 'sources'], 'Compiler input fields differ');
  requireProof(inputWrapper.input.language === 'Solidity', 'Compiler language differs');
  same(inputWrapper.input.settings, {
    debug: { revertStrings: 'strip' }, evmVersion: 'shanghai', metadata: { bytecodeHash: 'none' },
    optimizer: { enabled: true, runs: 40 }, outputSelection: OUTPUT_SELECTION,
    remappings: ['project/:@openzeppelin/contracts/=npm/@openzeppelin/contracts@4.9.6/'], viaIR: true,
  }, 'Compiler settings differ');
  requireProof(Object.keys(inputWrapper.input.sources).length === 91 &&
    Object.keys(inputWrapper.userSourceNameMap).length === 62, 'Compiler source inventory differs');
  const smallerSolcInput = { ...inputWrapper.input };
  smallerSolcInput.sources = Object.fromEntries(Object.entries(inputWrapper.input.sources).map(([name, source]) => {
    exactKeys(source, ['content'], 'Compiler source fields differ');
    requireProof(typeof source.content === 'string', 'Compiler source content differs');
    return [name, { content: sha1(source.content) }];
  }));
  // config.js inserts DEFAULT_OUTPUT_SELECTION first, then the user settings in
  // this order. compilation-job.js replaces type with undefined, which JSON.stringify
  // omits. This default compile has neither compilerType nor toolVersions in preimage.
  const settings = {
    outputSelection: OUTPUT_SELECTION, optimizer: { enabled: true, runs: 40 },
    evmVersion: 'shanghai', viaIR: true, metadata: { bytecodeHash: 'none' },
    debug: { revertStrings: 'strip' },
  };
  const preimage = {
    format: FORMAT, solcLongVersion: SOLC_LONG_VERSION, smallerSolcInput,
    solcConfig: { type: undefined, version: SOLC_VERSION, settings, path: compilerPath, preferWasm: true },
    userSourceNameMap: inputWrapper.userSourceNameMap,
  };
  return `solc-${SOLC_VERSION.replaceAll('.', '_')}-${sha1(JSON.stringify(preimage))}`;
}
function requireMode(mode) { requireProof(mode === 'local' || mode === 'hosted', 'Explicit local or hosted profile required'); }
export function containerPath(row, mode) {
  requireMode(mode);
  return mode === 'hosted' ? row.relativePath.replace(row.originalId, row.hostedId) : row.relativePath;
}

/** Exact raw-byte comparison, never JSON reserialization or broad ID normalization. */
export function verifyContainerBytes(bytes, row, mode) {
  requireMode(mode);
  const expectedId = mode === 'local' ? row.originalId : row.hostedId;
  const otherId = mode === 'local' ? row.hostedId : row.originalId;
  const expectedHash = mode === 'local' ? row.originalSha256 : row.hostedSha256;
  const otherHash = mode === 'local' ? row.hostedSha256 : row.originalSha256;
  requireProof(Buffer.isBuffer(bytes) && sha256(bytes) === expectedHash,
    `Raw container SHA256 differs: ${row.group}/${row.name}`);
  const text = bytes.toString('utf8');
  requireProof(Buffer.from(text, 'utf8').equals(bytes), 'Container is not exact UTF-8');
  const first = text.indexOf(expectedId);
  requireProof(first !== -1 && text.indexOf(expectedId, first + expectedId.length) === -1 &&
    !text.includes(otherId), `Expected exactly one ID occurrence: ${row.group}/${row.name}`);
  const container = JSON.parse(text);
  requireProof(container[row.field] === expectedId, `Mismatched ID reference: ${row.group}/${row.name}`);
  const replacement = Buffer.from(text.slice(0, first) + otherId + text.slice(first + expectedId.length));
  requireProof(sha256(replacement) === otherHash, `Other-profile raw SHA256 differs: ${row.group}/${row.name}`);
  return container;
}
export function verifyDependencies(dependencyRoot, profile) {
  const packageInfo = JSON.parse(readRegular(dependencyRoot, 'hardhat/package.json'));
  requireProof(packageInfo.name === 'hardhat' && packageInfo.version === '3.17.0', 'Hardhat version differs');
  for (const [name, digest] of Object.entries(profile.algorithmPins.files))
    requireProof(sha256(readRegular(dependencyRoot, name)) === digest, `Algorithm/compiler bytes differ: ${name}`);
}

export function proveProfile({ profileFile, mode, sourceRoot, legacyRoot, dependencyRoot }) {
  requireMode(mode);
  requireProof(process.version === 'v22.23.2', 'Node 22.23.2 required');
  const roots = { new: exactDirectory(sourceRoot), legacy: exactDirectory(legacyRoot) };
  dependencyRoot = exactDirectory(dependencyRoot);
  requireProof(typeof profileFile === 'string' && path.isAbsolute(profileFile) &&
    path.resolve(profileFile) === profileFile, 'Exact absolute profile filename required');
  const profileBytes = readRegular(exactDirectory(path.dirname(profileFile)), path.basename(profileFile));
  const profile = loadProfileBytes(profileBytes);
  if (mode === 'hosted') {
    for (const [group, key] of [['new', 'newHosted'], ['legacy', 'legacyHosted']])
      requireProof(path.join(roots[group], 'node_modules/solc/soljson.js') === profile.compilerPaths[key],
        `Hosted ${group} checkout/compiler path differs`);
    requireProof(dependencyRoot === path.join(roots.new, 'node_modules'), 'Hosted dependency root differs');
  }
  const dependencyRoots = mode === 'hosted'
    ? [dependencyRoot, exactDirectory(path.join(roots.legacy, 'node_modules'))]
    : [dependencyRoot];
  for (const root of dependencyRoots) verifyDependencies(root, profile);
  for (const root of Object.values(roots))
    requireProof(sha256(readRegular(root, 'hardhat/hardhat.config.js')) === HARDHAT_CONFIG_SHA256,
      'Source compiler configuration bytes differ');
  const reproducedBuildInfoIds = {};
  const containers = [];
  for (const row of profile.containers) {
    const relativePath = containerPath(row, mode);
    const bytes = readRegular(roots[row.group], relativePath);
    const container = verifyContainerBytes(bytes, row, mode);
    if (row.name === 'input') {
      const ids = {
        local: reproduceBuildId(container, profile.compilerPaths.local),
        hosted: reproduceBuildId(container, profile.compilerPaths[row.group === 'new' ? 'newHosted' : 'legacyHosted']),
      };
      same(ids, BUILD_IDS[row.group], `Reproduced ${row.group} build IDs differ`);
      reproducedBuildInfoIds[row.group] = ids;
    }
    containers.push({ group: row.group, name: row.name, relativePath, field: row.field,
      observedSha256: sha256(bytes), originalSha256: row.originalSha256, hostedSha256: row.hostedSha256 });
  }
  same(Object.keys(reproducedBuildInfoIds).sort(), ['legacy', 'new'], 'Both source build-ID proofs required');
  // Re-read every file, including algorithm inputs and profile, after the proof.
  for (const root of dependencyRoots) verifyDependencies(root, profile);
  requireProof(readRegular(path.dirname(profileFile), path.basename(profileFile)).equals(profileBytes),
    'Profile changed during proof');
  for (const root of Object.values(roots))
    requireProof(sha256(readRegular(root, 'hardhat/hardhat.config.js')) === HARDHAT_CONFIG_SHA256,
      'Source compiler configuration changed during proof');
  for (const row of profile.containers)
    verifyContainerBytes(readRegular(roots[row.group], containerPath(row, mode)), row, mode);
  return {
    schema: 'agijobmanager/exact-build-container-proof/v1', profile: profile.profile,
    selectedProfile: mode, profileSha256: PROFILE_SHA256,
    hardhatVersion: profile.algorithmPins.hardhatVersion, solcVersion: SOLC_VERSION,
    solcLongVersion: SOLC_LONG_VERSION, compilerPaths: profile.compilerPaths,
    algorithmPins: profile.algorithmPins.files, reproducedBuildInfoIds,
    verifiedContainerCount: containers.length, containers,
    scope: 'FINITE_RAW_CONTAINER_IDENTITY_PROOF_ONLY',
  };
}
export function parseArgs(argv) {
  const keys = new Map([['--profile-file', 'profileFile'], ['--profile', 'mode'],
    ['--source-root', 'sourceRoot'], ['--legacy-root', 'legacyRoot'], ['--dependency-root', 'dependencyRoot']]);
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = keys.get(argv[i]);
    requireProof(key && !(key in args) && typeof argv[i + 1] === 'string' &&
      !argv[i + 1].startsWith('--'), 'Unknown, repeated, or incomplete proof option');
    args[key] = argv[i + 1];
  }
  requireProof(Object.keys(args).length === keys.size, 'All five explicit proof options are required');
  requireMode(args.mode);
  return args;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(proveProfile(parseArgs(process.argv.slice(2))), null, 2)); }
  catch (error) { console.error(`CONTAINER_PROFILE_PROOF_FAILED: ${error.message}`); process.exitCode = 1; }
}
