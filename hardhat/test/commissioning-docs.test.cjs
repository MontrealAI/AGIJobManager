'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const run = (script, cwd, args = [], env = {}) => spawnSync(process.execPath,
  [path.join(root, script), ...args], {cwd, encoding: 'utf8', timeout: 10000,
    env: {PATH: process.env.PATH, ...env}});
function temporary(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'commissioning-docs-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  return dir;
}
function registryFixture(t) {
  const dir = temporary(t);
  for (const name of ['config/mainnet', 'ui/src/generated', 'docs/ui'])
    fs.mkdirSync(path.join(dir, name), {recursive: true});
  for (const name of ['config/usdc-deployment.json', 'config/mainnet/agi-jobs-usdc.json', 'ui/src/generated/deployments.ts'])
    fs.copyFileSync(path.join(root, name), path.join(dir, name));
  return dir;
}
test('canonical default registry matches its actual generated UI consumer', () => {
  const result = run('ui/scripts/sync-deployments.mjs', path.join(root, 'ui'), ['--check']);
  assert.equal(result.status, 0, result.stderr);
});
test('canonical default registry exactly regenerates the committed deployment guide', t => {
  const dir = registryFixture(t);
  const result = run('ui/scripts/generate-deployment-docs.mjs', path.join(dir, 'ui'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(dir, 'docs/ui/DEPLOYMENT_MAINNET.md'), 'utf8'),
    read('docs/ui/DEPLOYMENT_MAINNET.md'));
});
test('a note-only registry edit is rejected until its UI consumer is regenerated', t => {
  const dir = registryFixture(t), file = path.join(dir, 'config/usdc-deployment.json');
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  record.note += ' UNSYNCHRONIZED_TEST_NOTE';
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  const before = fs.readFileSync(path.join(dir, 'ui/src/generated/deployments.ts'));
  const result = run('ui/scripts/sync-deployments.mjs', path.join(dir, 'ui'), ['--check']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Run npm run sync:deployments/);
  assert.deepEqual(fs.readFileSync(path.join(dir, 'ui/src/generated/deployments.ts')), before);
});
test('regenerating both consumers resolves note drift without selecting a live manager', t => {
  const dir = registryFixture(t), file = path.join(dir, 'config/usdc-deployment.json');
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  record.note += ' SYNCHRONIZED_TEST_NOTE';
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  for (const script of ['sync-deployments.mjs', 'generate-deployment-docs.mjs']) {
    const result = run('ui/scripts/' + script, path.join(dir, 'ui'));
    assert.equal(result.status, 0, result.stderr);
  }
  assert.equal(run('ui/scripts/sync-deployments.mjs', path.join(dir, 'ui'), ['--check']).status, 0);
  assert.match(fs.readFileSync(path.join(dir, 'docs/ui/DEPLOYMENT_MAINNET.md'), 'utf8'), /SYNCHRONIZED_TEST_NOTE/);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).managerAddress, '');
});
test('every environment read by the frozen connection checker is explicitly documented', () => {
  const source = read('hardhat/scripts/check-ens-usdc-connection.cjs');
  const example = read('hardhat/.env.example'), guide = read('docs/DEPLOYMENT_CONFIGURATION.md');
  const defined = new Set([...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(m => m[1]));
  const used = [...source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map(m => m[1]);
  assert(used.length > 0);
  for (const key of used) {
    assert(defined.has(key), 'Undocumented environment variable: ' + key);
    assert(guide.includes('`' + key + '`'), 'Missing configuration reference: ' + key);
  }
});
test('Node startup controls are empty examples, not enabled preload or module overrides', () => {
  const example = read('hardhat/.env.example'), guide = read('docs/DEPLOYMENT_CONFIGURATION.md');
  for (const key of ['NODE_OPTIONS', 'NODE_PATH']) {
    const values = [...example.matchAll(new RegExp('^' + key + '=(.*)$', 'gm'))];
    assert.equal(values.length, 1);
    assert.equal(values[0][1], '');
  }
  assert(guide.includes('Empty `.env` entries do not clear inherited shell values'));
  assert(guide.includes('cannot undo a preload that already ran'));
});
for (const [key, value] of [['NODE_OPTIONS', '--no-warnings'], ['NODE_PATH', '/nonexistent/test-modules']])
  test('inherited ' + key + ' stops the real CLI before dependency or RPC initialization', t => {
    const dir = temporary(t), repo = path.join(dir, 'repository');
    fs.mkdirSync(repo);
    const result = run('hardhat/scripts/check-ens-usdc-connection.cjs', root, ['--repo', repo],
      {HOME: dir, [key]: value});
    assert.equal(result.status, 1, result.stderr);
    const reports = fs.readdirSync(dir).filter(name => name.startsWith('ENSJobPages-USDC-Connection-'));
    assert.equal(reports.length, 1);
    const report = JSON.parse(fs.readFileSync(path.join(dir, reports[0], 'CONNECTION_REVIEW.json'), 'utf8'));
    assert.equal(report.failure.code, 'NODE_PRELOAD_SETTINGS_REQUIRE_REVIEW');
    assert.equal(report.publicTransactionsBroadcast, 0);
    assert.equal(report.intakeActivationAuthorized, false);
    assert.equal(report.productionReadinessCertified, false);
    assert.equal(report.transport, undefined);
    assert.equal(report.runtime, undefined);
    assert.deepEqual(fs.readdirSync(repo), []);
  });
