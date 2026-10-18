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
  for (const name of ['config/mainnet', 'ui/src/generated', 'ui/scripts', 'docs/ui', 'docs/deployments'])
    fs.mkdirSync(path.join(dir, name), {recursive: true});
  for (const name of ['config/usdc-deployment.json', 'config/mainnet/agi-jobs-usdc.json',
    'config/mainnet/manager-8815-2026-10-17.json', 'docs/deployments/MAINNET_MANAGER_2026-10-17.md',
    'docs/deployments/MAINNET_USDC_2026-10-10.md',
    'ui/src/generated/deployments.ts', 'ui/agijobmanager-usdc.html', 'ui/scripts/singlefile-template.html'])
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

const creationGuides = [
  'docs/RELEASE_GUIDE.md', 'hardhat/README.md', 'docs/DEPLOY_DAY_RUNBOOK.md',
  'docs/OWNER_RUNBOOK.md', 'docs/DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md',
  'docs/MAINNET_READINESS.md', 'docs/OWNER_CONTROLS.md', 'docs/Deployment.md',
  'docs/NFT_POLICY.md', 'docs/QUINTESSENTIAL_USE_CASE.md', 'docs/LAUNCH_CHECKLIST.md',
  'docs/QUICKSTART.md', 'docs/MAINNET_MIGRATION_FROM_LEGACY.md', 'docs/AGI_JOBS_ONE_PAGER.md',
  'docs/operator-runbook.md', 'docs/ENS_DEPLOYMENT_NAMESPACES.md', 'docs/DEPLOYMENT_OPERATIONS.md',
  'docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md', 'docs/USDC_MIGRATION.md',
  'docs/README.md', 'docs/ENS/ENS_JOB_PAGES_OVERVIEW.md', 'docs/ens-job-pages.md',
  'docs/DEPLOYMENT/OPTIONAL_METADATA_ROUTER.md'
];
const staleCreationClaims = [
  /script only proposes the transfer/i,
  /deployer retains authority until (?:the intended owner accepts|acceptance)/i,
  /proposes the configured ownership handover/i,
  /complete two-step ownership acceptance/i,
  /linked code, accepting ownership/i,
  /finish source verification, accepted ownership/i,
  /exact linked runtime code, accepted ownership/i,
  /Rehearse ownership acceptance and pause recovery/i,
  /setJobManager\(JOB_MANAGER\).*executed by script/i,
  /sets its manager and journals/i,
  /helper script[^\n]*sets its manager/i,
  /helper deployment sets `job-`/i,
  /transfer ownership to the explicit final helper owner and optionally lock/i
];
function verifyCreationGuides(guides) {
  for (const [name, text] of Object.entries(guides))
    for (const claim of staleCreationClaims)
      assert.doesNotMatch(text, claim, 'Stale current-creation instruction: ' + name);
  for (const name of ['docs/RELEASE_GUIDE.md', 'hardhat/README.md',
    'docs/DEPLOY_DAY_RUNBOOK.md', 'docs/OWNER_RUNBOOK.md',
    'docs/DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md'])
    assert(guides[name].includes('ubuntu-ephemeral-creator.md'), 'Missing hidden-prompt route: ' + name);
  const helper = guides['docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md'];
  assert.match(helper, /Creation leaves `jobManager\(\)` zero/);
  assert.match(helper, /separate governor action plan/i);
  assert.match(helper, /Creation performs no manager binding, prefix setter, lock or ownership transfer/);
  const controls = guides['docs/OWNER_CONTROLS.md'];
  assert.match(controls, /## Transfer ownership[\s\S]*`acceptOwnership\(\)`[\s\S]*## Fresh deployment/);
  assert.match(controls, /later voluntary Manager ownership changes use the transfer procedure above/);
}
test('all active guides distinguish atomic governance, separate helper plans and later transfers', async () => {
  const {activeGuides} = await import('../../scripts/docs/check-current-guides.mjs');
  const names = new Set([...creationGuides, ...activeGuides(root)]);
  verifyCreationGuides(Object.fromEntries([...names].map(name => [name, read(name)])));
});
test('planted legacy handover and helper automation instructions fail the documentation regression', () => {
  const guides = Object.fromEntries(creationGuides.map(name => [name, read(name)]));
  for (const [name, claim] of [
    ['docs/DEPLOY_DAY_RUNBOOK.md', 'The script only proposes the transfer; the deployer retains authority until acceptance.'],
    ['docs/QUICKSTART.md', 'Keep intake paused while verifying linked code, accepting ownership, then configuring.'],
    ['docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md', '`setJobManager(JOB_MANAGER)` and prefix are executed by script.'],
    ['docs/ENS_DEPLOYMENT_NAMESPACES.md', 'The helper deployment sets `job-` before handoff.']
  ]) assert.throws(() => verifyCreationGuides({...guides, [name]: guides[name] + '\n' + claim}), /Stale current-creation instruction/);
});

test('documented governed-helper argument encoder retains the recorded sixth governor and rejects legacy journals', t => {
  const guide = read('docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md');
  const snippet = guide.match(/ENS_DEPLOYMENT_RECEIPT=[^\n]+ node - <<'NODE'\n([\s\S]*?)\nNODE/);
  assert(snippet, 'Missing executable helper argument-encoding recipe');
  const dir = temporary(t), receipt = path.join(dir, 'helper.json');
  const governor = '0x4444444444444444444444444444444444444444';
  const args = ['0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222',
    '0x3333333333333333333333333333333333333333', '0x' + '55'.repeat(32),
    'jobs.example.eth', governor];
  const journal = {constructorSchema: 'ens-job-pages-constructor-v2', finalOwner: governor,
    constructorArgs: args};
  const execute = value => {
    fs.writeFileSync(receipt, JSON.stringify(value));
    return spawnSync(process.execPath, ['-e', snippet[1]], {cwd: path.join(root, 'hardhat'),
      encoding: 'utf8', timeout: 10000, env: {PATH: process.env.PATH, ENS_DEPLOYMENT_RECEIPT: receipt}});
  };
  const result = execute(journal);
  assert.equal(result.status, 0, result.stderr);
  const {AbiCoder} = require('ethers');
  const decoded = AbiCoder.defaultAbiCoder().decode(
    ['address', 'address', 'address', 'bytes32', 'string', 'address'], '0x' + result.stdout.trim());
  assert.deepEqual([...decoded], args);
  for (const value of [
    {...journal, constructorArgs: args.slice(0, 5)},
    {...journal, constructorSchema: 'historical-five-argument'},
    {...journal, finalOwner: '0x6666666666666666666666666666666666666666'}
  ]) {
    const rejected = execute(value);
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /original reviewed six-argument governed helper journal/);
    assert.equal(rejected.stdout, '');
  }
});

test('documented router config selects v2 direct creation with independent creator and governor', async () => {
  const guide = read('docs/DEPLOYMENT/OPTIONAL_METADATA_ROUTER.md');
  const example = guide.match(/```json\n([\s\S]*?)\n```/);
  assert(example, 'Missing reviewed router configuration example');
  const documented = JSON.parse(example[1]);
  assert.deepEqual(Object.keys(documented).sort(),
    ['schema', 'creator', 'transactionMode', 'chainId', 'owner', 'manager',
      'managerCodeHash', 'buildDigest', 'baseMetadataURI', 'externalUrlBase'].sort(),
    'Document the complete current router configuration before filling placeholders');
  const config = {...documented,
    creator: '0x1111111111111111111111111111111111111111',
    owner: '0x2222222222222222222222222222222222222222',
    manager: '0x3333333333333333333333333333333333333333',
    managerCodeHash: '0x' + '44'.repeat(32), buildDigest: '55'.repeat(32),
    baseMetadataURI: 'ipfs://reviewed/'
  };
  const router = require('../scripts/deploy-job-pages.cjs');
  const normalized = router.normalizeConfig(config);
  assert.equal(normalized.schema, 'reviewed-job-pages-v2');
  assert.equal(normalized.transactionMode, 'eoa-create');
  assert.notEqual(normalized.creator, normalized.owner);
  assert.deepEqual(router.routerConstructor(normalized),
    [config.baseMetadataURI, config.externalUrlBase, config.owner]);
  assert.equal(router.routerGovernorPlan(normalized, config.manager).from, config.owner);
  const {creator, transactionMode, ...missingCreator} = config;
  assert.throws(() => router.normalizeConfig(missingCreator), /configuration schema/);
  assert.throws(() => router.normalizeConfig({...config, transactionMode: 'factory'}), /eoa-create/);
  const legacy = {...missingCreator, schema: 'reviewed-job-pages-v1'};
  await assert.rejects(router.execute({config: legacy, options: {recover: false},
    hre: {network: {name: 'mainnet'}, ethers: {provider: {}}}}), /Legacy router schema is recovery-only/);
  assert.match(guide, /configured signer must equal the reviewed `creator`/);
  assert.match(guide, /ROUTER_LEGACY_ARTIFACT/);
  assert.match(guide, /ROUTER_LEGACY_BUILD_INFO/);
});
