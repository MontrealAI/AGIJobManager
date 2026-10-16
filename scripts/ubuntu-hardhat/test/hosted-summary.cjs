'use strict';
// Public metadata only; never reads the rehearsal's private temporary directory.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), cp = require('node:child_process');
const { sha, canonical, writeNew } = require('../safety.cjs');
const directory = process.argv[2]; assert(directory && path.isAbsolute(directory));
const publicDir = path.join(directory, 'public'); fs.mkdirSync(publicDir, { recursive: true, mode: 0o700 });
const read = relative => { const file = path.join(directory, relative); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : null; };
const native = read('native/qualification.json'), cli = read('cli/qualification.json');
const tapFile = path.join(publicDir, 'terminal-tests.tap'), tap = fs.existsSync(tapFile) ? fs.readFileSync(tapFile, 'utf8') : '';
const count = key => Number(new RegExp(`^# ${key} ([0-9]+)$`, 'm').exec(tap)?.[1] ?? -1);
const production = ['hardhat.cjs', 'native.cjs', 'prompt.cjs', 'safety.cjs', 'send.cjs', 'terminal.cjs'];
const files = Object.fromEntries(production.map(name => [name, sha(fs.readFileSync(path.resolve(__dirname, '..', name)))]));
const toolSourceSha256 = sha(Buffer.from(canonical(files)));
let passed = false, reason = null;
try {
  assert.equal(process.version, 'v22.23.3');
  assert.equal(process.env.GITHUB_REPOSITORY, 'MontrealAI/AGIJobManager');
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.match(process.env.GITHUB_RUN_ID || '', /^[0-9]+$/);
  assert.match(process.env.QUALIFIED_TOOLING_HEAD || '', /^[0-9a-f]{40}$/);
  const actualHead = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path.resolve(__dirname, '../../..'), encoding: 'utf8' }).trim();
  assert.equal(actualHead, process.env.QUALIFIED_TOOLING_HEAD);
  assert.equal(count('tests'), 24); assert.equal(count('pass'), 24); assert.equal(count('fail'), 0); assert.equal(count('skipped'), 0);
  assert.equal(cli?.status, 'PASS'); assert.equal(cli.backendSubmissions, 1); assert.equal(cli.reports[0].toolSourceSha256, toolSourceSha256);
  assert.equal(native?.status, 'PASS'); assert.equal(native.backendSubmissions, 53); assert.equal(native.reports.length, 3);
  for (const [project, commit, operations, creations] of [
    ['manager', 'd371d95cfcc44b9133cda4bba55304f727917f18', 9, 9],
    ['alpha', '38064bec3423218f87c6b81760ac6768b3e7d4e5', 5, 5],
    ['jobs', '9a79f38ad9edc448dc0b8d8cfa6157ee0c6f2bc5', 39, 25],
  ]) { const r = native.reports.find(r => r.project === project); assert.equal(r.source, commit); assert.equal(r.operations, operations); assert.equal(r.creations, creations); }
  assert.equal(native.governorSignatures, 0); assert.equal(native.publicProviderCalls, 0); assert.equal(native.realKeys, false);
  assert.equal(native.reports.find(r => r.project === 'jobs').nativeCloseout, 'awaiting-commissioning');
  assert.equal(native.reports.find(r => r.project === 'jobs').sourceRecords, 25);
  passed = true;
} catch { reason = 'One or more required disposable CLI, receipt, source, count or closeout checks did not complete successfully.'; }
const summary = { schema: 'ubuntu-hardhat-hosted-qualification-v1', status: passed ? 'PASS_DISPOSABLE_FUNCTIONAL' : 'INCOMPLETE_OR_FAILED', passed, reason,
  provenance: { repository: process.env.GITHUB_REPOSITORY, toolingHead: process.env.QUALIFIED_TOOLING_HEAD, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, event: process.env.GITHUB_EVENT_NAME, node: process.version, nodeExecutableSha256: sha(fs.readFileSync(process.execPath)), osRelease: fs.readFileSync('/etc/os-release', 'utf8') },
  toolSourceSha256, productionSourceFiles: files, unit: { tests: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped'), tapSha256: sha(Buffer.from(tap)) }, cli, native,
  limits: { realSigningQualified: false, physicalLedgerQualified: false, mainnetTransactions: 0, selectedMarkerAccountQualified: false, emptyCodeDeployerOnly: true, explorerAccepted: false, comprehensiveAuthorityComplete: false, sameDeployerCrossProjectPlanQualified: false, productionPlanAccepted: false, activationAuthorized: false } };
writeNew(path.join(publicDir, 'qualification.json'), summary);
const inventory = Object.fromEntries(fs.readdirSync(publicDir).filter(n => n !== 'SHA256SUMS.json').sort().map(n => [n, sha(fs.readFileSync(path.join(publicDir, n)))]));
writeNew(path.join(publicDir, 'SHA256SUMS.json'), inventory);
console.log(summary.status); if (!passed) process.exitCode = 1;
