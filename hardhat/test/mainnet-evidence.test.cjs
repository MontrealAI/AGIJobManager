'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const E = require('../../scripts/commissioning/mainnet-evidence.cjs');
const original = E.load();
test('recorded deployment, rehearsal, connection and activation decision agree without mutation', () => {
  const before = JSON.stringify(original), result = E.validate(original);
  assert.equal(result.recordConsistent, true);
  assert.equal(result.activationDecision, 'HOLD_INTAKE_ACTIVATION');
  assert.equal(result.intakeActivationAuthorized, false);
  assert.equal(result.productionReadinessCertified, false);
  assert.equal(result.liveRpcQueries, 0);
  assert.equal(JSON.stringify(original), before);
});
const changes = [
 ['network', x => x.chainId = 31337],
 ['record treated as live', x => x.notLiveState = false],
 ['record treated as default', x => x.notDefaultConfiguration = false],
 ['source reference', x => x.sourceRef = '0'.repeat(40)],
 ['source blobs absent', x => delete x.sourceBlobs],
 ['source blobs null', x => x.sourceBlobs = null],
 ['source blobs array', x => x.sourceBlobs = []],
 ['manager source blob changed', x => x.sourceBlobs['contracts/AGIJobManager.sol'] = '0'.repeat(40)],
 ['helper source blob changed', x => x.sourceBlobs['contracts/ens/ENSJobPages.sol'] = '0'.repeat(40)],
 ['source blob missing', x => delete x.sourceBlobs['contracts/ens/ENSJobPages.sol']],
 ['unexpected source blob', x => x.sourceBlobs['contracts/Unexpected.sol'] = '0'.repeat(40)],
 ['helper', x => x.helper = x.manager],
 ['root holder', x => x.rootOwner = x.administrator],
 ['namespace', x => x.jobsRootName = 'alpha.jobs.agi.eth'],
 ['prefix', x => x.jobLabelPrefix = 'agijob'],
 ['snapshot', x => x.connection.snapshot.hash = '0x' + '0'.repeat(64)],
 ['helper runtime', x => x.connection.observed.runtimeCodeHashes.helper = '0x' + '0'.repeat(64)],
 ['manager pointer', x => x.connection.observed.manager.ensJobPages = x.manager],
 ['helper pointer', x => x.connection.observed.helper.jobManager = x.helper],
 ['paused state', x => x.connection.observed.manager.paused = false],
 ['settlement state', x => x.connection.observed.manager.settlementPaused = true],
 ['job history', x => x.connection.observed.manager.nextJobId = '1'],
 ['identity lock', x => x.connection.observed.manager.lockIdentityConfig = true],
 ['helper lock', x => x.connection.observed.helper.configLocked = true],
 ['approval', x => x.connection.observed.newHelperOperatorApproval = false],
 ['root-scoped assertion', x => x.approvalScope = 'Root-specific approval'],
 ['complete operator assertion', x => x.fullOperatorHistoryReviewed = true],
 ['legacy operator removal', x => x.connection.observed.knownOperators.pop()],
 ['job preview claimed created', x => x.connection.observed.jobZero.snapshot = [true,'job-0']],
 ['rewritten deployment history', x => x.deployment.statusAtDeployment = 'APPROVED_ATTACHED'],
 ['wrong constructor', x => x.deployment.constructorArguments[4] = 'alpha.jobs.agi.eth'],
 ['compiler identity', x => x.deployment.build.solcLongVersion = '0.8.38'],
 ['fork result', x => x.rehearsal.overallStatus = 'STOPPED_REVIEW_REQUIRED'],
 ['fork promoted to mainnet', x => x.rehearsal.simulationChainId = 1],
 ['fork transport rejection', x => x.rehearsal.blockedRequests = 1],
 ['compiler input drift', x => x.rehearsal.compilerReplay.inputSha256 = '0'.repeat(64)],
 ['authorization promoted', x => x.activation.intakeActivationAuthorized = true],
 ['readiness promoted', x => x.activation.productionReadinessCertified = true],
 ['HOLD removed', x => x.activation.decision = 'GO'],
 ['gate missing', x => x.activation.gates.pop()],
 ['gate closed without evidence', x => x.activation.gates[0].status = 'CLOSED'],
 ['proposal applied', x => x.activation.proposedCanary.status = 'APPROVED'],
 ['aggregate cap invented', x => x.activation.proposedCanary.aggregateOrSingleJobLimitEnforcedByExistingContract = true],
 ['participant invented', x => x.activation.proposedCanary.agent = x.administrator],
 ['transactions missing', x => x.connection.transactions.pop()],
 ['transaction duplicated', x => x.connection.transactions[1].hash = x.connection.transactions[0].hash],
 ['owner transaction changed', x => x.connection.transactions[4].from = x.administrator],
 ['fees', x => x.totalSixTransactionFeesWei = '1'],
 ['private host path', x => x.debug = '/home/operator/private'],
 ['raw unsigned payload', x => x.request = {data:'0x12'}],
 ['provenance missing', x => x.sourceEvidence.pop()],
];
for (const [name, mutate] of changes) test('public record rejects ' + name, () => {
  const x = structuredClone(original); mutate(x); assert.throws(() => E.validate(x));
});
test('repo connection checker is byte-identical to the operator-tested packet', () => {
  const p = path.resolve(__dirname, '../scripts/check-ens-usdc-connection.cjs');
  assert.equal(createHash('sha256').update(fs.readFileSync(p)).digest('hex'),
    'ee05e43469e62e9de35ce07f96909e17f4f086eaa2f1781930912eaecdeecdc2');
});
test('offline CLI prints HOLD; an activation argument is rejected', () => {
  const p = path.resolve(__dirname, '../../scripts/commissioning/mainnet-evidence.cjs');
  const env = {PATH: process.env.PATH};
  const run = spawnSync(process.execPath, [p], {encoding:'utf8', env});
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).intakeActivationAuthorized, false);
  const forbidden = spawnSync(process.execPath, [p, '--activate'], {encoding:'utf8', env});
  assert.equal(forbidden.status, 1);
});
test('default configuration still auto-selects no live manager, helper or signer', () => {
  const p = path.resolve(__dirname, '../../config/usdc-deployment.json');
  const x = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(x.status, 'deployment-required');
  for (const k of ['managerAddress', 'ensJobPagesAddress', 'finalOwner']) assert.equal(x[k], '');
  assert.equal(x.settlementWallets.wallet30, ''); assert.equal(x.settlementWallets.wallet10, '');
});
test('README and its template expose the dated record and activation hold', () => {
  for (const p of ['README.md', 'scripts/docs/templates/README.md.tpl']) {
    const text = fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');
    assert(text.includes('docs/deployments/MAINNET_USDC_2026-10-10.md'));
    assert(text.includes('Production activation remains on HOLD'));
    assert(text.includes('not a live status indicator'));
    assert(text.includes('0 / 30 / 10 / 60'));
  }
});
test('activation guide preserves public-admission and assignment-before-pause limitations', () => {
  const text = fs.readFileSync(path.resolve(__dirname, '../../docs/OPERATIONS/PRODUCTION_ACTIVATION.md'), 'utf8');
  assert(text.includes('no employer invitation gate'));
  assert(text.includes('pausing immediately after posting prevents assignment'));
  assert(text.includes('not an atomic contract-enforced cap'));
  assert(text.includes('not approved or applied'));
});

for (const [role, fields] of [
  ['manager', ['usdcToken', 'ens', 'nameWrapper']],
  ['helper', ['ens', 'nameWrapper', 'publicResolver']],
]) for (const field of fields) test('dependency identity rejects substituted ' + role + '.' + field, () => {
  const x = structuredClone(original);
  x.connection.observed[role][field] = x.manager;
  assert.throws(() => E.validate(x), {message: 'RECORD_DEPENDENCY_' + role + '_' + field});
});
for (let i = 0; i < 6; i++) for (const field of ['hash', 'blockNumber', 'blockHash'])
  test('exact historical transaction ' + i + ' rejects substituted ' + field, () => {
    const x = structuredClone(original), tx = x.connection.transactions[i];
    tx[field] = field === 'blockNumber' ? tx[field] + 1 : '0x' + '9'.repeat(64);
    assert.throws(() => E.validate(x), {message: 'RECORD_TRANSACTION_IDENTITY_' + i});
  });
test('the entire historical projection has a separately pinned canonical fingerprint', () => {
  const result = E.validate(original);
  assert.equal(result.historySha256, '000945c8869f1e6015ba817ce58f8f975c0206deaef6ef9965629091f0f2bb8d');
  assert.equal(result.intakeActivationAuthorized, false);
  assert.equal(result.productionReadinessCertified, false);
  assert.equal(result.liveRpcQueries, 0);
});
test('formatting and recursive object-key order do not alter historical identity', () => {
  const reorder = value => Array.isArray(value) ? value.map(reorder) :
    value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse()
      .map(([key, item]) => [key, reorder(item)])) : value;
  const reordered = JSON.parse(JSON.stringify(reorder(original), null, 4));
  assert.deepEqual(E.validate(reordered), E.validate(original));
});
test('every historical scalar is bound, not only fields selected for diagnostic checks', t => {
  const paths = [];
  const walk = (value, keys = []) => {
    if (value !== null && typeof value === 'object') {
      for (const key of Object.keys(value)) walk(value[key], [...keys, key]);
    } else paths.push(keys);
  };
  walk(original);
  for (const keys of paths) {
    const x = structuredClone(original), parent = keys.slice(0, -1).reduce((v, k) => v[k], x);
    const key = keys.at(-1), value = parent[key];
    parent[key] = value === null ? 'CHANGED' : typeof value === 'boolean' ? !value :
      typeof value === 'number' ? value + 1 : value + 'CHANGED';
    assert.throws(() => E.validate(x), 'Undetected historical change: ' + keys.join('.'));
  }
  t.diagnostic('Mutated and rejected ' + paths.length + ' historical scalar values.');
});
test('well-formed evidence digest replacements and coherent fee edits cannot rewrite history', () => {
  for (const mutate of [
    x => x.sourceEvidence[0].sha256 = '9'.repeat(64),
    x => { x.deployment.build.inputSha256 = '9'.repeat(64); x.rehearsal.compilerReplay.inputSha256 = '9'.repeat(64); },
    x => { x.connection.transactions[0].actualFeeWei = String(BigInt(x.connection.transactions[0].actualFeeWei) + 1n);
      x.totalSixTransactionFeesWei = String(BigInt(x.totalSixTransactionFeesWei) + 1n); },
    x => x.rehearsal.snapshot.hash = '0x' + '9'.repeat(64),
    x => x.connection.observed.names['jobs.agi.eth'].expiry = '2007731865',
  ]) {
    const x = structuredClone(original); mutate(x);
    assert.throws(() => E.validate(x), {message: 'RECORD_HISTORY_FINGERPRINT'});
  }
});
test('new fields, deleted limitations, non-JSON values and cycles are not historical records', () => {
  for (const mutate of [
    x => x.annotation = 'not in the reviewed projection',
    x => x.connection.annotation = 'not in the reviewed projection',
    x => delete x.limitations,
    x => x.limitations.reverse(),
    x => x.unserializable = undefined,
    x => x.unserializable = Number.NaN,
    x => x.circular = x,
  ]) {
    const x = structuredClone(original); mutate(x);
    assert.throws(() => E.validate(x));
  }
});
