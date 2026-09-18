const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { setup } = require('../scripts/setup.cjs');
const { loadDeploymentEnv } = require('../scripts/load-env.cjs');
const { resolveReviewedProfile } = require('../scripts/deploy.cjs');

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agi-operator-'));
  for (const name of ['.env.example', 'deploy.config.example.cjs', 'readiness-nft-policy.example.json']) {
    fs.copyFileSync(path.join(__dirname, '..', name), path.join(directory, name));
  }
  return directory;
}

test('setup creates private configuration and preserves all existing contents on repeat', () => {
  const directory = fixture();
  try {
    const created = setup(directory);
    assert.equal(created.length, 3);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'reviewed-nft-policy.json'), 'utf8')), { agentNftRequired: false, agiTypes: [] });
    for (const { file, status } of created) {
      assert.equal(status, 'created');
      if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(directory, file)).mode & 0o777, 0o600);
      fs.writeFileSync(path.join(directory, file), `reviewed ${file}`);
    }
    for (const { file, status } of setup(directory)) {
      assert.equal(status, 'preserved');
      assert.equal(fs.readFileSync(path.join(directory, file), 'utf8'), `reviewed ${file}`);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('setup neither follows nor replaces existing and dangling destination symlinks', () => {
  const directory = fixture();
  try {
    const target = path.join(directory, 'operator-secret');
    fs.writeFileSync(target, 'keep');
    fs.symlinkSync(target, path.join(directory, '.env'));
    const missing = path.join(directory, 'missing');
    fs.symlinkSync(missing, path.join(directory, 'deploy.config.cjs'));
    const result = setup(directory);
    assert.equal(result.filter(entry => entry.status === 'preserved').length, 2);
    assert.equal(fs.readFileSync(target, 'utf8'), 'keep');
    assert.equal(fs.existsSync(missing), false);
    assert.equal(fs.lstatSync(path.join(directory, 'deploy.config.cjs')).isSymbolicLink(), true);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('deployment environment is explicit, keeps shell precedence and tolerates a missing file', () => {
  const directory = fixture();
  try {
    const environment = { DRY_RUN: '1' };
    loadDeploymentEnv(directory, environment);
    assert.deepEqual(environment, { DRY_RUN: '1' });
    fs.writeFileSync(path.join(directory, '.env'), 'DRY_RUN=0\nDEPLOYER_ADDRESS=example\n');
    assert.equal(loadDeploymentEnv(directory, environment), path.join(directory, '.env'));
    assert.deepEqual(environment, { DRY_RUN: '1', DEPLOYER_ADDRESS: 'example' });
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('an unreadable deployment environment fails instead of silently using other settings', () => {
  const directory = fixture();
  try {
    fs.mkdirSync(path.join(directory, '.env'));
    assert.throws(() => loadDeploymentEnv(directory, {}), /Cannot read deployment environment/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const C = '0x3333333333333333333333333333333333333333';
function profile() {
  return { ...require('../deploy.config.example.cjs').mainnet, settlementWallets: [A, B], finalOwner: C };
}

test('offline profile validation rejects wrong-chain tokens and dependency owners', () => {
  const previous = process.env.FINAL_OWNER;
  delete process.env.FINAL_OWNER;
  try {
    assert.equal(resolveReviewedProfile('mainnet', profile()).finalOwner, C);
    assert.throws(() => resolveReviewedProfile('sepolia', profile()), /USDC/);
    assert.throws(() => resolveReviewedProfile('mainnet', { ...profile(), finalOwner: profile().ensConfig[0] }), /finalOwner cannot/);
    assert.throws(() => resolveReviewedProfile('mainnet', { ...profile(), finalOwner: '' }), /Set FINAL_OWNER/);
    assert.throws(() => resolveReviewedProfile('mainnet', { ...profile(), settlementWallets: [A, A] }), /distinct/);
  } finally {
    if (previous === undefined) delete process.env.FINAL_OWNER; else process.env.FINAL_OWNER = previous;
  }
});

test('offline CLI works from root and hardhat without RPC or signing and does not print secrets', () => {
  const directory = fixture();
  try {
    const configPath = path.join(directory, 'reviewed.cjs');
    fs.writeFileSync(configPath, `module.exports = ${JSON.stringify({ mainnet: profile() })};`);
    const script = path.resolve(__dirname, '../scripts/check-config.cjs');
    for (const cwd of [path.resolve(__dirname, '../..'), path.resolve(__dirname, '..')]) {
      const environment = { ...process.env, DEPLOY_CONFIG: configPath, FINAL_OWNER: '', PRIVATE_KEY: 'must-never-print',
        MAINNET_RPC_URL: 'https://must-not-contact.invalid/secret', DRY_RUN: '1', CONFIRMATIONS: '3', VERIFY_DELAY_MS: '0' };
      const result = spawnSync(process.execPath, [script, 'mainnet'], { cwd, env: environment, encoding: 'utf8', timeout: 10000 });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /"checksPassed": true/);
      assert.match(result.stdout, /"transactionsBroadcast": 0/);
      assert.doesNotMatch(result.stdout + result.stderr, /must-never-print|must-not-contact|\/secret/);
      const bad = spawnSync(process.execPath, [script, 'mainnet'], { cwd, env: { ...environment, CONFIRMATIONS: '2' }, encoding: 'utf8' });
      assert.notEqual(bad.status, 0);
      assert.match(bad.stderr, /at least 3 confirmations/);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
