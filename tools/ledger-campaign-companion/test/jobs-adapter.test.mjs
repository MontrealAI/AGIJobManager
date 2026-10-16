import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import jobs, { JOBS_COMPATIBILITY, inspectJobsSource } from '../coordinators/jobs.mjs';

test('Jobs dashboard keeps hardware, authority and activation blocked with exact observed identity', () => {
  const report = jobs.inspectCampaign(new Proxy({}, { get() { throw new Error('untrusted campaign was accessed'); } }));
  assert.equal(report.compatibility.commit, 'fed83bc183753e871621fc1cb3aa8510bd38f642');
  assert.equal(report.compatibility.tree, 'a49fa5d32272555e62431363f1ffd36b84ea87be');
  assert.equal(report.compatibility.packetSchema, null);
  assert.equal(report.state, 'blocked');
  for (const flag of ['canPrepare', 'canSign', 'canImport', 'canRelay', 'authorityComplete', 'activationReady', 'productionApproved']) assert.equal(report[flag], false);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(JOBS_COMPATIBILITY.missingInterfaces), true);
  assert.deepEqual(JOBS_COMPATIBILITY.configurationScope.companionCanExecute, []);
});

for (const method of ['prepare', 'importSigned', 'observe', 'relayOne']) test(`Jobs ${method} refuses before argument access, provider/device use or raw disclosure`, () => {
  const input = new Proxy({}, { get() { throw new Error('PRIVATE_PAYLOAD_SENTINEL'); } });
  assert.throws(() => jobs[method](input), error => error.code === 'JOBS_EXTERNAL_SIGNING_UNSUPPORTED' && !error.message.includes('PRIVATE_PAYLOAD_SENTINEL'));
});

test('read-only inventory refuses an unrelated directory without creating files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jobs-inventory-'));
  try {
    fs.writeFileSync(path.join(root, 'sentinel.txt'), 'PRIVATE_SOURCE_SENTINEL');
    assert.throws(() => inspectJobsSource(root), error => error.code === 'JOBS_SOURCE_UNRECOGNIZED_OR_CHANGED' && !error.message.includes('PRIVATE_SOURCE_SENTINEL'));
    assert.deepEqual(fs.readdirSync(root), ['sentinel.txt']);
    assert.equal(fs.readFileSync(path.join(root, 'sentinel.txt'), 'utf8'), 'PRIVATE_SOURCE_SENTINEL');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('CLI accepts no transaction, raw import, custom command or relay arguments', () => {
  const script = fileURLToPath(new URL('../coordinators/jobs.mjs', import.meta.url));
  for (const args of [['relay'], ['import', 'PRIVATE_RAW_SENTINEL'], ['inspect-source', '--source-root', '/', '--command', 'PRIVATE_COMMAND_SENTINEL']]) {
    const run = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.equal(run.stdout, '');
    const applicationLines = run.stderr.trim().split('\n').filter(line => !/^\(node:\d+\) \[UNDICI-EHPA\] Warning: EnvHttpProxyAgent is experimental, expect them to change at any time\.$/.test(line) && line !== '(Use `node --trace-warnings ...` to show where the warning was created)');
    assert.deepEqual(applicationLines, ['JOBS_EXTERNAL_SIGNING_UNSUPPORTED']);
  }
});
