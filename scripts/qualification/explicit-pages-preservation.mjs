/** Exact 9066 source-only Pages checks. Never authorizes publication or release. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
export const BINDING_SHA256 = 'a18fdc0125b55de4b231bc8e97489f46bec8d10904c2d7c3805e2cd43838d9ce';
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const bindingFile = fileURLToPath(new URL('./explicit-pages-9066-binding.json', import.meta.url));
function exactRoot(root) {
  assert.equal(path.resolve(root), root, 'absolute source root required');
  assert.equal(fs.realpathSync(root), root, 'source root alias prohibited');
}
function read(root, name) {
  assert.ok(name && !name.includes('\\') && !path.isAbsolute(name) && name.split('/').every(p => p && p !== '.' && p !== '..'), 'unsafe relative path');
  let p = root;
  for (const part of name.split('/')) { p = path.join(p, part); assert.ok(!fs.lstatSync(p).isSymbolicLink(), 'symlink prohibited: ' + name); }
  return fs.readFileSync(p);
}
export function verifyBinding(root, dependencyRoot, bindingPath = bindingFile) {
  exactRoot(root);
  const bytes = fs.readFileSync(bindingPath);
  assert.equal(digest(bytes), BINDING_SHA256, 'unreviewed external binding');
  const b = JSON.parse(bytes);
  for (const [name, hash] of Object.entries({
    'scripts/release/check-source-boundaries.py': b.dispatcherSha256,
    'scripts/release/check-explicit-governor-boundaries.py': b.verifierSha256,
    [b.manifestPath]: b.manifestSha256,
    'schemas/explicit-governor-source-v1.schema.json': b.schemaSha256,
  })) assert.equal(digest(read(root, name)), hash, name);
  const args = [path.join(root, 'scripts/release/check-source-boundaries.py'), '--profile', b.profile,
    '--mode', 'bound', '--source-root', root, '--manifest', b.manifestPath,
    '--manifest-sha256', b.manifestSha256, '--schema-sha256', b.schemaSha256,
    '--verifier-sha256', b.verifierSha256, '--review-binding', bindingPath,
    '--review-binding-sha256', BINDING_SHA256];
  if (dependencyRoot) args.push('--dependency-root', dependencyRoot);
  const p = spawnSync('python3', args, {encoding: 'utf8', env: {...process.env, GIT_NO_LAZY_FETCH:'1', GIT_TERMINAL_PROMPT:'0'}});
  assert.equal(p.status, 0, p.stderr || p.error?.message || p.stdout);
  const result = JSON.parse(p.stdout);
  assert.equal(result.releaseQualified, false);
  assert.equal(result.status, 'CLEAN_SOURCE_BOUNDARIES_PASSED');
  assert.equal(result.sourceCommit, b.sourceCommit);
  assert.equal(result.sourceTree, b.sourceTree);
  return result;
}
// Separately exported for adversarial fixtures. The CLI always runs the full bound gate first.
export async function checkPreservation(root) {
  exactRoot(root);
  const json = name => JSON.parse(read(root, name));
  const baseline = json('docs/successor/PRESERVATION_BASELINE.json');
  const manifest = json('config/explicit-governor-source-v1.json');
  const inventory = json('config/next-deployment-contract-changes.json');
  const { normalizeConsole } = await import(pathToFileURL(path.join(root, 'scripts/successor/preservation-normalize.mjs')));
  const changes = {...inventory.files, ...inventory.evidenceInputs, ...manifest.changedContracts};
  for (const [name, historicalHash] of Object.entries(baseline.protectedFiles)) {
    const normalized = baseline.normalizedConsoleFiles[name];
    let expected = historicalHash;
    if (!normalized && changes[name]) {
      assert.equal(changes[name].beforeSha256, historicalHash, 'historical before hash: ' + name);
      assert.ok(changes[name].purpose || changes[name].reason, 'change rationale: ' + name);
      expected = changes[name].afterSha256;
    }
    assert.equal(digest(normalized ? normalizeConsole(read(root, name).toString()) : read(root, name)), normalized || expected, 'preservation: ' + name);
  }
  for (const [name, blocks] of Object.entries(baseline.mermaidBlocks)) {
    const actual = [...read(root, name).toString().matchAll(/```mermaid[^\n]*\n[\s\S]*?```/g)].map(m => digest(m[0]));
    for (const hash of blocks) assert.ok(actual.includes(hash), 'original diagram: ' + name);
  }
  const activation = json('config/mainnet/agi-jobs-usdc.json').activation;
  assert.equal(activation.intakeActivationAuthorized, false);
  assert.equal(activation.gates.length, 5);
  for (const route of [...baseline.routes, 'successor/index.html', 'fr/successor/index.html']) read(root, 'build/pages/' + route);
  const info = json('build/pages/build-info.json');
  assert.equal(info.sourceCommit, '9066d1270613f2c4529d5eef8eca3c4ed9bf9e48', 'build source identity');
  assert.deepEqual(Object.keys(info.buildOnlyFiles || {}), ['.nojekyll'], 'exact local marker inventory');
  assert.ok(!Object.hasOwn(info.files, '.nojekyll'), 'local marker is not a deployed file');
  const allFiles = {...info.files, ...info.buildOnlyFiles};
  assert.ok(Object.keys(info.files).length > 0, 'empty build inventory');
  const actualFiles = [];
  function walk(directory, prefix = '') {
    for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
      const relative = prefix + entry.name;
      assert.ok(!entry.isSymbolicLink(), 'build symlink');
      if (entry.isDirectory()) walk(path.join(directory, entry.name), relative + '/');
      else { assert.ok(entry.isFile(), 'non-regular build input'); if (relative !== 'build-info.json') actualFiles.push(relative); }
    }
  }
  walk(path.join(root, 'build/pages'));
  assert.deepEqual(Object.keys(allFiles).sort(), actualFiles.sort(), 'exact build inventory membership');
  for (const [name, record] of Object.entries(allFiles)) {
    const bytes = read(root, 'build/pages/' + name);
    assert.equal(bytes.length, record.bytes, 'build size: ' + name);
    assert.equal(digest(bytes), record.sha256, 'build digest: ' + name);
  }
  for (const lang of ['', 'fr/']) {
    assert.ok(read(root, `build/pages/${lang}index.html`).toString().includes('data-successor-entry="home" href="./successor/"'), 'home entry');
    const page = read(root, `build/pages/${lang}successor/index.html`).toString();
    assert.ok(page.includes("connect-src 'none'"), 'CSP');
    assert.ok(page.includes('sandbox=""'), 'sandbox');
    assert.ok(Buffer.byteLength(page) < 750000, 'Builder initial size');
  }
  // Historical reports are retained by the exact manifest and predecessor Git bytes
  // in verifyBinding; their old source hashes are NOT current execution evidence.
  return {status:'EXPLICIT_PAGES_SOURCE_CHECKS_PASSED', releaseQualified:false,
    sourceCommit:'9066d1270613f2c4529d5eef8eca3c4ed9bf9e48', historicalEvidence:'RETAINED_ORIGINAL_BYTES_ONLY'};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 2 || args.length === 4, 'usage: --source-root ABS [--dependency-root ABS]');
  assert.equal(args[0], '--source-root');
  if (args.length === 4) assert.equal(args[2], '--dependency-root');
  verifyBinding(args[1], args[3]);
  console.log(JSON.stringify(await checkPreservation(args[1]), null, 2));
}
