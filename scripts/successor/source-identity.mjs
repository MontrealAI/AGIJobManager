import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { canonical, fail, keys, parseStrict, safePath } from '../../site/assets/successor/safe.mjs';

export const SOURCE_SELECTOR = 'config/successor-builder-source.json';
export const SELECTOR_SCHEMA = 'agijobmanager/successor-builder-source/v1';
export const ARCHIVE_SCHEMA = 'agijobmanager/successor-editable-source/v2';
const REPOSITORY = 'MontrealAI/AGIJobManager', HASH = /^[a-f0-9]{40}$/, VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function regularBytes(root, relative, maximum = 2_000_000) {
  safePath(relative); const file = path.join(root, relative);
  try {
    const stat = fs.lstatSync(file);
    fail(stat.isFile() && fs.realpathSync(file) === file && stat.size <= maximum, 'SOURCE_FILE_REGULAR');
    const bytes = fs.readFileSync(file); fail(bytes.length <= maximum, 'SOURCE_FILE_SIZE'); return bytes;
  } catch (error) { if (error.code?.startsWith('SOURCE_')) throw error; fail(false, 'SOURCE_FILE_UNAVAILABLE'); }
}
function gitEnvironment() {
  const env = { ...process.env };
  for (const name of Object.keys(env)) if (name.startsWith('GIT_')) delete env[name];
  return { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0' };
}
function gitArguments(root, args) { return ['--no-replace-objects', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-C', root, ...args]; }
function gitBytes(root, args) {
  try { return execFileSync('git', gitArguments(root, args), { env: gitEnvironment(), stdio: 'pipe', timeout: 10000, maxBuffer: 3_000_000 }); }
  catch { fail(false, 'SOURCE_GIT_OBJECT'); }
}
export function immutableGitBytes(directory, args) { return gitBytes(fs.realpathSync(directory), args); }
function repositoryRoot(root) {
  let actual;
  try { actual = execFileSync('git', gitArguments(root, ['rev-parse', '--show-toplevel']), { env: gitEnvironment(), encoding: 'utf8', stdio: 'pipe', timeout: 10000 }).trim(); }
  catch { fail(!fs.existsSync(path.join(root, '.git')), 'SOURCE_GIT_OBJECT'); return false; }
  fail(fs.realpathSync(actual) === root, 'SOURCE_REPOSITORY_ROOT'); return true;
}
export function actualRepositoryCommit(directory) {
  const root = fs.realpathSync(directory); fail(repositoryRoot(root), 'SOURCE_GIT_OBJECT');
  const commit = gitBytes(root, ['rev-parse', 'HEAD']).toString('utf8').trim();
  fail(HASH.test(commit) && gitBytes(root, ['cat-file', '-t', commit]).toString('utf8').trim() === 'commit', 'SOURCE_COMMIT_REQUIRED'); return commit;
}
function packageVersion(raw) {
  const version = parseStrict(raw.toString('utf8'), 1_000_000).version;
  fail(typeof version === 'string' && VERSION.test(version), 'SOURCE_VERSION'); return version;
}
function sourceManifest(commit, files) { return { repository: REPOSITORY, commit, engineSha256: digest(canonical(files)), files, license: 'MIT' }; }

// This resolver selects trusted build source only. Imported dossiers never call it
// or supply a selector, bootstrap mode, source inventory or Git revision.
export function resolveBuilderSource(directory, sourceFiles, options = {}) {
  const root = fs.realpathSync(directory);
  fail(Array.isArray(sourceFiles) && sourceFiles.length > 0 && sourceFiles.length <= 50 && new Set(sourceFiles).size === sourceFiles.length, 'SOURCE_INVENTORY');
  fail(!sourceFiles.includes(SOURCE_SELECTOR) && !sourceFiles.includes('SOURCE.json') && !sourceFiles.includes('package.json'), 'SOURCE_INVENTORY');
  const bytes = new Map(sourceFiles.map(file => [file, regularBytes(root, file)]));
  const files = [...bytes].map(([file, content]) => ({ path: file, sha256: digest(content) }));
  const contents = new Map([...bytes].map(([file, content]) => [file, content.toString('utf8')]));
  if (!repositoryRoot(root)) {
    fail(options.bootstrap === undefined && options.commit === undefined && options.version === undefined, 'SOURCE_BOOTSTRAP_REPOSITORY');
    const retained = parseStrict(regularBytes(root, 'SOURCE.json', 100_000).toString('utf8'), 100_000);
    keys(retained, ['schema', 'commit', 'tree', 'version', 'packageSha256', 'sourceManifest'], 'SOURCE_ARCHIVE_FIELDS');
    fail(retained.schema === ARCHIVE_SCHEMA && typeof retained.commit === 'string' && HASH.test(retained.commit) && typeof retained.tree === 'string' && HASH.test(retained.tree), 'SOURCE_ARCHIVE_IDENTITY');
    const packageRaw = regularBytes(root, 'package.json', 1_000_000);
    fail(retained.packageSha256 === digest(packageRaw) && retained.version === packageVersion(packageRaw), 'SOURCE_VERSION');
    const expected = sourceManifest(retained.commit, files);
    fail(canonical(retained.sourceManifest) === canonical(expected), 'SOURCE_ARCHIVE_CHANGED');
    return { commit: retained.commit, tree: retained.tree, version: retained.version, packageRaw: packageRaw.toString('utf8'), packageSha256: digest(packageRaw), sourceManifest: expected, contents, verification: { mode: 'trusted-editable-manifest', sourceCommit: retained.commit, sourceTree: retained.tree, completeSourceFiles: files.length } };
  }
  let selector, mode;
  if (options.bootstrap !== undefined) {
    keys(options, ['bootstrap'], 'SOURCE_BOOTSTRAP_EXPLICIT'); keys(options.bootstrap, ['commit'], 'SOURCE_BOOTSTRAP_EXPLICIT');
    fail(typeof options.bootstrap.commit === 'string' && HASH.test(options.bootstrap.commit), 'SOURCE_BOOTSTRAP_EXPLICIT');
    const commit = options.bootstrap.commit;
    selector = { schema: SELECTOR_SCHEMA, repository: REPOSITORY, commit, engineSha256: sourceManifest(commit, files).engineSha256, tree: gitBytes(root, ['rev-parse', `${commit}^{tree}`]).toString('utf8').trim(), version: packageVersion(gitBytes(root, ['show', `${commit}:package.json`])) };
    mode = 'explicit-developer-bootstrap';
  } else {
    keys(options, [], 'SOURCE_BOOTSTRAP_EXPLICIT');
    fail(fs.existsSync(path.join(root, SOURCE_SELECTOR)), 'SOURCE_SELECTOR_REQUIRED');
    const raw = regularBytes(root, SOURCE_SELECTOR, 4096);
    fail(raw.equals(gitBytes(root, ['show', `HEAD:${SOURCE_SELECTOR}`])), 'SOURCE_SELECTOR_CHANGED');
    selector = parseStrict(raw.toString('utf8'), 4096); mode = 'git-object-pin';
  }
  keys(selector, ['schema', 'repository', 'commit', 'tree', 'version', 'engineSha256'], 'SOURCE_SELECTOR_FIELDS');
  fail(selector.schema === SELECTOR_SCHEMA && selector.repository === REPOSITORY && typeof selector.commit === 'string' && HASH.test(selector.commit) && typeof selector.tree === 'string' && HASH.test(selector.tree), 'SOURCE_SELECTOR_IDENTITY');
  fail(gitBytes(root, ['cat-file', '-t', selector.commit]).toString('utf8').trim() === 'commit', 'SOURCE_COMMIT_REQUIRED');
  fail(gitBytes(root, ['rev-parse', `${selector.commit}^{tree}`]).toString('utf8').trim() === selector.tree, 'SOURCE_TREE');
  const packageRaw = gitBytes(root, ['show', `${selector.commit}:package.json`]);
  fail(selector.version === packageVersion(packageRaw), 'SOURCE_VERSION');
  for (const file of sourceFiles) fail(bytes.get(file).equals(gitBytes(root, ['show', `${selector.commit}:${file}`])), 'SOURCE_BYTES_CHANGED');
  const manifest = sourceManifest(selector.commit, files);
  fail(selector.engineSha256 === manifest.engineSha256, 'SOURCE_INVENTORY_CHANGED');
  return { commit: selector.commit, tree: selector.tree, version: selector.version, packageRaw: packageRaw.toString('utf8'), packageSha256: digest(packageRaw), sourceManifest: manifest, contents, verification: { mode, sourceCommit: selector.commit, sourceTree: selector.tree, completeSourceFiles: files.length } };
}
