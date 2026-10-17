#!/usr/bin/env node
// Offline exporter. Its source identity is observed, never supplied by a fixture.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function writeNew(file, value) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}
export function sourceModules(root) {
  const require = createRequire(path.join(root, 'package.json'));
  return { require, P: require(path.join(root, 'hardhat/scripts/core-creation-plan.cjs')),
    C: require(path.join(root, 'hardhat/scripts/qualified-build-catalog.cjs')) };
}
export function safeExternalPath(file, roots) {
  const absolute = path.resolve(file), parent = path.dirname(absolute);
  if (fs.realpathSync(parent) !== parent) throw Error('External output parent must exist without symlink ancestors.');
  for (const root of roots.map(r => fs.realpathSync(r))) {
    if (absolute === root || absolute.startsWith(root + path.sep)) throw Error('Output must be outside every reviewed source/harness root.');
  }
  try { if (fs.lstatSync(absolute).isSymbolicLink()) throw Error('External output must not be a symlink.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return absolute;
}
export function observeSource(root, expectedCommit, expectedTree) {
  const { P } = sourceModules(root), source = P.observedRevision(root);
  if (!/^[a-f0-9]{40}$/.test(expectedCommit || '') || !/^[a-f0-9]{40}$/.test(expectedTree || '')) throw Error('Explicit full expected commit and tree are required.');
  if (source.commit !== expectedCommit || source.tree !== expectedTree) throw Error('Actual clean source differs from the explicitly selected commit/tree.');
  return source;
}
export function cleanGit(root, ...args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/i.test(k)));
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1', GIT_ALLOW_PROTOCOL: '', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' });
  return execFileSync('git', ['--no-replace-objects', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'protocol.allow=never', ...args], { cwd: root, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}
export function prepareCoreCatalog({ sourceRoot, outputDirectory, expectedCommit, expectedTree, buildId }) {
  const root = fs.realpathSync(sourceRoot), ownRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const destination = safeExternalPath(outputDirectory, [root, ownRoot]);
  const source = observeSource(root, expectedCommit, expectedTree), { require, C } = sourceModules(root);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(buildId || '')) throw Error('Explicit catalog build ID required.');
  const { FQNS } = require(path.join(root, 'hardhat/scripts/deploy.cjs'));
  const descriptor = file => ({ path: fs.realpathSync(file), sha256: sha256(fs.readFileSync(file)) });
  const artifactRoot = path.join(root, 'hardhat/artifacts');
  const manager = readJson(path.join(artifactRoot, 'contracts/AGIJobManager.sol/AGIJobManager.json'));
  if (typeof manager.buildInfoId !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(manager.buildInfoId)) throw Error('Manager artifact must name its actual compiled buildInfoId.');
  const inputPath = path.join(artifactRoot, 'build-info', manager.buildInfoId + '.json');
  const outputPath = path.join(artifactRoot, 'build-info', manager.buildInfoId + '.output.json');
  const input = readJson(inputPath), sourceMap = {};
  if (!input.input?.sources || input.id !== manager.buildInfoId) throw Error('Intact exact compiler input required.');
  for (const [name, content] of Object.entries(input.input.sources)) {
    let file;
    if (name.startsWith('project/')) file = path.join(root, name.slice('project/'.length));
    else if (name.startsWith('npm/@openzeppelin/contracts@4.9.6/')) file = path.join(root, 'node_modules/@openzeppelin/contracts', name.slice('npm/@openzeppelin/contracts@4.9.6/'.length));
    else throw Error(`Unreviewed compiler source resolver: ${name}`);
    if (name.split('/').includes('..') || !fs.readFileSync(file).equals(Buffer.from(content.content, 'utf8'))) throw Error(`Current source bytes differ from compiler input: ${name}`);
    sourceMap[name] = descriptor(file);
  }
  const artifacts = Object.fromEntries(C.CORE_NAMES.map(name => {
    const file = path.join(artifactRoot, FQNS[name].replace(':', '/') + '.json');
    if (readJson(file).buildInfoId !== manager.buildInfoId) throw Error(`Artifact ${name} has a different or missing build identity.`);
    return [name, { ...descriptor(file), fqn: FQNS[name], constructorSchema: name === 'AGIJobManager' ? C.CONSTRUCTOR_SCHEMAS.explicit : C.CONSTRUCTOR_SCHEMAS.library }];
  }));
  const patchManifestPath = path.join(root, 'scripts/security/openzeppelin-compiler-patches.json');
  const patchManifest = readJson(patchManifestPath), compatibility = {};
  for (const workspace of [root, path.join(root, 'hardhat')]) {
    const directory = path.join(workspace, 'node_modules/@openzeppelin/contracts');
    if (!fs.existsSync(directory)) continue;
    for (const [name, pin] of Object.entries(patchManifest.files)) {
      const file = path.join(directory, name), actual = sha256(fs.readFileSync(file));
      if (actual !== pin.patched) throw Error(`OpenZeppelin compatibility patch is unverified: ${file}`);
      compatibility[fs.realpathSync(file)] = actual;
    }
  }
  if (!Object.keys(compatibility).length) throw Error('No verified installed compatibility sources.');
  const compiler = { version: input.solcVersion, longVersion: input.solcLongVersion };
  const installedCompiler = require('solc').version();
  // Hardhat records the release+commit identity; solc-js appends its platform.
  if (![compiler.longVersion, compiler.longVersion + '.Emscripten.clang'].includes(installedCompiler)) throw Error('Installed compiler differs from compiled artifact compiler.');
  const catalog = { schema: C.CATALOG_SCHEMA, builds: { [buildId]: { source, compiler, input: descriptor(inputPath), output: descriptor(outputPath), sources: sourceMap, artifacts } } };
  fs.mkdirSync(destination, { mode: 0o700 });
  writeNew(path.join(destination, 'INCOMPLETE'), 'Catalog preparation incomplete. Preserve this directory on failure.\n');
  const catalogPath = path.join(destination, 'catalog.json'); writeNew(catalogPath, catalog);
  const catalogSha256 = sha256(fs.readFileSync(catalogPath));
  // The reviewed loader is the authority for completeness, constructor schemas,
  // ABI, bytecode, links, immutables, compiler wrappers and every file checksum.
  const qualified = C.loadQualifiedBuild({ catalogPath, catalogSha256, buildId, expectedRevision: source });
  const after = observeSource(root, expectedCommit, expectedTree);
  if (JSON.stringify(source) !== JSON.stringify(after)) throw Error('Source drift during catalog preparation.');
  qualified.assertUnchanged();
  const metadata = { schema: 'manager-native-core-catalog-preparation-v1', sourceRoot: root, source,
    parents: cleanGit(root, 'show', '-s', '--format=%P', 'HEAD').split(' ').filter(Boolean),
    catalogPath, catalogSha256, buildId, compilerBuildInfoId: manager.buildInfoId, buildDigest: qualified.buildDigest,
    inputSha256: qualified.inputSha256, outputSha256: qualified.outputSha256, compiler,
    sourceChecksums: qualified.sourceChecksums, artifactHashes: Object.fromEntries(Object.entries(qualified.records).map(([name, r]) => [name, { artifactSha256: r.artifactSha256, abiSha256: r.abiSha256, bytecodeSha256: r.bytecodeSha256, deployedBytecodeSha256: r.deployedBytecodeSha256, linkReferencesSha256: r.linkReferencesSha256 }])),
    compatibility: { manifestSha256: sha256(fs.readFileSync(patchManifestPath)), files: compatibility },
    tools: { node: process.version, ethers: require('ethers').version, solc: require('solc').version(), hardhat: readJson(path.join(root, 'node_modules/hardhat/package.json')).version, openssl: execFileSync('openssl', ['version'], { encoding: 'utf8' }).trim() },
    explorerAcceptanceObserved: false, providerQualified: false, walletQualified: false };
  writeNew(path.join(destination, 'preparation.json'), metadata);
  fs.unlinkSync(path.join(destination, 'INCOMPLETE'));
  return { ...metadata, qualified };
}
export function parseFlags(argv, allowed, required = allowed) {
  const result = {};
  if (argv.length % 2) throw Error('Use exact --name value pairs.');
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !allowed.includes(key) || Object.hasOwn(result, key) || !argv[i + 1]) throw Error('Unknown, duplicate or missing argument.');
    result[key] = argv[i + 1];
  }
  if (required.some(k => !result[k])) throw Error(`Required flags: ${required.join(', ')}`);
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const a = parseFlags(process.argv.slice(2), ['source-root', 'output', 'expected-commit', 'expected-tree', 'build-id']);
    const { qualified, ...result } = prepareCoreCatalog({ sourceRoot: a['source-root'], outputDirectory: a.output, expectedCommit: a['expected-commit'], expectedTree: a['expected-tree'], buildId: a['build-id'] });
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
