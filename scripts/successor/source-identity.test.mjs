import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { canonical } from '../../site/assets/successor/safe.mjs';
import { resolveBuilderSource, actualRepositoryCommit, SOURCE_SELECTOR, SELECTOR_SCHEMA, ARCHIVE_SCHEMA } from './source-identity.mjs';
import { SOURCE_FILES } from './build.mjs';
const inventory = ['engine.mjs', 'LICENSE'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'successor-source-identity-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe', timeout: 10000 }).trim();
  git(['init', '-q']); git(['config', 'user.name', 'Source fixture']); git(['config', 'user.email', 'source-fixture@example.invalid']);
  fs.writeFileSync(path.join(root, 'engine.mjs'), 'export const source = "fixed";\n'); fs.writeFileSync(path.join(root, 'LICENSE'), 'MIT\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"fixture","version":"1.17.2","type":"module"}\n');
  const commit = message => { git(['add', '.']); git(['commit', '-qm', message]); return git(['rev-parse', 'HEAD']); };
  const sourceCommit = commit('source'), sourceTree = git(['rev-parse', 'HEAD^{tree}']);
  const initial = resolveBuilderSource(root, inventory, { bootstrap: { commit: sourceCommit } });
  const selector = { schema: SELECTOR_SCHEMA, repository: 'MontrealAI/AGIJobManager', commit: sourceCommit, tree: sourceTree, version: '1.17.2', engineSha256: initial.sourceManifest.engineSha256 };
  const select = value => { fs.mkdirSync(path.dirname(path.join(root, SOURCE_SELECTOR)), { recursive: true }); fs.writeFileSync(path.join(root, SOURCE_SELECTOR), JSON.stringify(value) + '\n'); return commit('select source'); };
  return { root, git, commit, select, selector, sourceCommit, sourceTree, initial };
}
test('docs-only commits and main-style merges retain identical Builder source while actual HEAD advances', t => {
  const f = fixture(t); f.select(f.selector); const first = resolveBuilderSource(f.root, inventory);
  fs.writeFileSync(path.join(f.root, 'README.md'), 'New guide\n'); const actual = f.commit('docs-only');
  const later = resolveBuilderSource(f.root, inventory);
  assert.notEqual(actual, f.sourceCommit); assert.equal(later.commit, f.sourceCommit); assert.equal(later.verification.mode, 'git-object-pin');
  assert.equal(canonical(later.sourceManifest), canonical(first.sourceManifest)); assert.equal(later.packageRaw, first.packageRaw);
  fs.writeFileSync(path.join(f.root, 'SOURCE.json'), '{"commit":"' + '0'.repeat(40) + '"}');
  assert.equal(canonical(resolveBuilderSource(f.root, inventory).sourceManifest), canonical(first.sourceManifest), 'untracked SOURCE.json cannot override repository provenance');
});
test('missing pin and implicit bootstrap fail; explicit bootstrap requires a real exact source commit', t => {
  const f = fixture(t);
  assert.throws(() => resolveBuilderSource(f.root, inventory), { code: 'SOURCE_SELECTOR_REQUIRED' });
  assert.throws(() => resolveBuilderSource(f.root, inventory, { commit: f.sourceCommit, version: '1.17.2' }), { code: 'SOURCE_BOOTSTRAP_EXPLICIT' });
  assert.throws(() => resolveBuilderSource(f.root, inventory, { bootstrap: { commit: '0'.repeat(40) } }), { code: 'SOURCE_GIT_OBJECT' });
  assert.equal(resolveBuilderSource(f.root, inventory, { bootstrap: { commit: f.sourceCommit } }).verification.mode, 'explicit-developer-bootstrap');
});
test('changed code, hidden tracked edits, symlinks and incomplete inventories cannot reuse the source identity', t => {
  const f = fixture(t); f.select(f.selector); const file = path.join(f.root, 'engine.mjs'), original = fs.readFileSync(file);
  f.git(['update-index', '--assume-unchanged', '--', 'engine.mjs']); fs.appendFileSync(file, '// hidden change\n');
  assert.throws(() => resolveBuilderSource(f.root, inventory), { code: 'SOURCE_BYTES_CHANGED' });
  fs.writeFileSync(file, original); f.git(['update-index', '--no-assume-unchanged', '--', 'engine.mjs']);
  assert.throws(() => resolveBuilderSource(f.root, inventory.slice(1)), { code: 'SOURCE_INVENTORY_CHANGED' });
  assert.throws(() => resolveBuilderSource(f.root, [...inventory].reverse()), { code: 'SOURCE_INVENTORY_CHANGED' });
  fs.writeFileSync(path.join(f.root, 'extra.mjs'), 'extra'); assert.throws(() => resolveBuilderSource(f.root, [...inventory, 'extra.mjs']), { code: 'SOURCE_GIT_OBJECT' });
  fs.unlinkSync(file); fs.symlinkSync(path.join(f.root, 'LICENSE'), file); assert.throws(() => resolveBuilderSource(f.root, inventory), { code: 'SOURCE_FILE_REGULAR' });
});
test('forged selectors, source versions and trees fail against immutable Git objects', t => {
  const f = fixture(t);
  for (const [change, code] of [[v => v.tree = '0'.repeat(40), 'SOURCE_TREE'], [v => v.version = '9.9.9', 'SOURCE_VERSION'], [v => v.commit = '0'.repeat(40), 'SOURCE_GIT_OBJECT'], [v => v.extra = true, 'SOURCE_SELECTOR_FIELDS'], [v => v.engineSha256 = '0'.repeat(64), 'SOURCE_INVENTORY_CHANGED']]) {
    const v = structuredClone(f.selector); change(v); f.select(v); assert.throws(() => resolveBuilderSource(f.root, inventory), { code });
  }
  f.select(f.selector); const selectorFile = path.join(f.root, SOURCE_SELECTOR); fs.appendFileSync(selectorFile, ' ');
  assert.throws(() => resolveBuilderSource(f.root, inventory), { code: 'SOURCE_SELECTOR_CHANGED' });
  fs.unlinkSync(selectorFile); fs.symlinkSync(path.join(f.root, 'package.json'), selectorFile);
  assert.throws(() => resolveBuilderSource(f.root, inventory), { code: 'SOURCE_FILE_REGULAR' });
});
test('new code requires its own real source commit and explicit selector update', t => {
  const f = fixture(t); f.select(f.selector); fs.appendFileSync(path.join(f.root, 'engine.mjs'), 'export const changed = true;\n'); const nextCommit = f.commit('new code');
  assert.throws(() => resolveBuilderSource(f.root, inventory), { code: 'SOURCE_BYTES_CHANGED' });
  const next = resolveBuilderSource(f.root, inventory, { bootstrap: { commit: nextCommit } });
  f.select({ ...f.selector, commit: nextCommit, tree: f.git(['rev-parse', `${nextCommit}^{tree}`]), engineSha256: next.sourceManifest.engineSha256 });
  assert.equal(resolveBuilderSource(f.root, inventory).commit, nextCommit); assert.notEqual(next.sourceManifest.engineSha256, f.initial.sourceManifest.engineSha256);
});
test('offline trusted archives retain exact complete source, order, package version and bytes without Git', t => {
  const f = fixture(t), archive = fs.mkdtempSync(path.join(os.tmpdir(), 'successor-offline-source-')); t.after(() => fs.rmSync(archive, { recursive: true, force: true }));
  for (const file of inventory) fs.copyFileSync(path.join(f.root, file), path.join(archive, file)); fs.writeFileSync(path.join(archive, 'package.json'), f.initial.packageRaw);
  const retained = { schema: ARCHIVE_SCHEMA, commit: f.sourceCommit, tree: f.sourceTree, version: f.initial.version, packageSha256: hash(f.initial.packageRaw), sourceManifest: f.initial.sourceManifest };
  const write = value => fs.writeFileSync(path.join(archive, 'SOURCE.json'), JSON.stringify(value)); write(retained);
  const rebuilt = resolveBuilderSource(archive, inventory); assert.equal(rebuilt.verification.mode, 'trusted-editable-manifest'); assert.equal(canonical(rebuilt.sourceManifest), canonical(f.initial.sourceManifest));
  for (const change of [v => v.version = '9.9.9', v => v.commit = '0'.repeat(40), v => v.sourceManifest.files.reverse(), v => v.sourceManifest.files.pop(), v => v.sourceManifest.engineSha256 = '0'.repeat(64)]) {
    const v = structuredClone(retained); change(v); write(v); assert.throws(() => resolveBuilderSource(archive, inventory));
  }
  write(retained); fs.appendFileSync(path.join(archive, 'engine.mjs'), '// modified\n'); assert.throws(() => resolveBuilderSource(archive, inventory), { code: 'SOURCE_ARCHIVE_CHANGED' });
});
test('build closure includes the identity verifier and root license; nested repository archives cannot override Git', t => {
  assert.ok(SOURCE_FILES.includes('scripts/successor/source-identity.mjs')); assert.ok(SOURCE_FILES.includes('LICENSE'));
  const f = fixture(t), nested = path.join(f.root, 'nested'); fs.mkdirSync(nested);
  for (const file of inventory) fs.copyFileSync(path.join(f.root, file), path.join(nested, file));
  fs.writeFileSync(path.join(nested, 'SOURCE.json'), '{}'); assert.throws(() => resolveBuilderSource(nested, inventory), { code: 'SOURCE_REPOSITORY_ROOT' });
});

test('Git replacement refs cannot relabel replacement source bytes as the immutable selected commit', t => {
  const f = fixture(t); fs.appendFileSync(path.join(f.root, 'engine.mjs'), 'export const replacement = true;\n'); const replacement = f.commit('replacement source');
  const replacementIdentity = resolveBuilderSource(f.root, inventory, { bootstrap: { commit: replacement } });
  f.git(['replace', f.sourceCommit, replacement]);
  assert.throws(() => resolveBuilderSource(f.root, inventory, { bootstrap: { commit: f.sourceCommit } }), { code: 'SOURCE_BYTES_CHANGED' });
  f.select({ ...f.selector, tree: replacementIdentity.tree, engineSha256: replacementIdentity.sourceManifest.engineSha256 });
  assert.throws(() => resolveBuilderSource(f.root, inventory), { code: 'SOURCE_TREE' });
});
test('Git environment redirection and injected configuration cannot override the selected repository', t => {
  const f = fixture(t); const actualHead = f.select(f.selector); const other = fixture(t), before = { ...process.env };
  try {
    Object.assign(process.env, { GIT_DIR: path.join(other.root, '.git'), GIT_WORK_TREE: other.root, GIT_OBJECT_DIRECTORY: path.join(other.root, '.git/objects'), GIT_REPLACE_REF_BASE: 'refs/forged/', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.worktree', GIT_CONFIG_VALUE_0: other.root, GIT_CONFIG_GLOBAL: path.join(other.root, 'malicious-config') });
    assert.equal(resolveBuilderSource(f.root, inventory).commit, f.sourceCommit); assert.equal(actualRepositoryCommit(f.root), actualHead);
  } finally { for (const name of Object.keys(process.env)) if (!(name in before)) delete process.env[name]; Object.assign(process.env, before); }
});
