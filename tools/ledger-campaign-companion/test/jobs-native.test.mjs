import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { keccak256 } from 'ethers';
import jobs, { JOBS_LEGACY_COMPATIBILITY } from '../coordinators/jobs.mjs';
import { JOBS_NATIVE_SUPPORTED as pin, assertJobsNativePlanProfile, createJobsNativeDriver, verifyJobsQualification } from '../coordinators/jobs-native.mjs';
import * as common from '../coordinators/common.mjs';

const plan = () => ({ schema: pin.planSchema, sourceCommit: pin.commit, sourceTree: pin.tree, chainId: 1,
  creator: '0x1111111111111111111111111111111111111111', governor: '0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99', creatorCodeHash: keccak256('0x') });

test('accepted Jobs handoff pins exact fresh-CLI source, packet and original evidence without promoting production', () => {
  assert.equal(pin.commit, '9a79f38ad9edc448dc0b8d8cfa6157ee0c6f2bc5');
  assert.equal(pin.tree, '720312acac83eddeeb76644e1e22f53578e91784');
  assert.equal(pin.packetSchema, 'jobs-external-envelope-v1'); assert.equal(pin.operationCount, 39);
  assert.equal(pin.qualification.archiveSha256, '1da8f5a17978b92bf355537076125063b064c287d71b5c3e40858a9fcc33d025');
  for (const name of ['productionApproved','deviceQualified','bootstrapQualified','productionPlanAccepted','markerCreatorQualified','companionTransportQualified','activationReady','globalAuthorityComplete']) assert.equal(pin[name], false);
  assert.equal(jobs.inspectCampaign().nativeQualificationAccepted, true);
  assert.equal(JOBS_LEGACY_COMPATIBILITY.externalSigningSupported, false);
  assert.equal(Object.isFrozen(pin.commands), true); assert.equal(Object.isFrozen(pin.qualification), true);
});
test('production profile refuses marker, delegated and ordinary code hashes without any provider call', () => {
  assert.equal(assertJobsNativePlanProfile(plan()), true);
  for (const code of ['0xef0100' + '12'.repeat(20), '0x60006000f3', '0x00']) assert.throws(() => assertJobsNativePlanProfile({ ...plan(), creatorCodeHash: keccak256(code) }), /JOBS_EMPTY_CODE_CREATOR_REQUIRED/);
});
for (const change of [{ sourceCommit: JOBS_LEGACY_COMPATIBILITY.commit }, { sourceTree: '0'.repeat(40) }, { schema: 'jobs-external-plan-v2' }, { chainId: 31337 }, { governor: plan().creator }]) test('production plan refuses changed source, route or actors ' + JSON.stringify(change), () => {
  assert.throws(() => assertJobsNativePlanProfile({ ...plan(), ...change }));
});
test('native driver requires an independent profile digest before source loading', () => {
  for (const value of [undefined, '', '0x' + 'ab'.repeat(32)]) assert.throws(() => createJobsNativeDriver({ expectedProfileSha256: value }), /JOBS_INDEPENDENT_PROFILE_REVIEW_REQUIRED/);
});
test('changed qualification bytes cannot pass by retaining passed:true or source labels', () => {
  for (const bytes of [Buffer.alloc(0), Buffer.from('{"passed":true}'), Buffer.from('PRIVATE_EVIDENCE_SENTINEL')]) assert.throws(() => verifyJobsQualification(bytes), error => error.code === 'JOBS_QUALIFICATION_BYTES_MISMATCH' && !error.message.includes('PRIVATE_EVIDENCE_SENTINEL'));
});

// Synthetic native API responses verify this integration's dispatch boundary.
// The original hosted 39-operation run, not these fixtures, qualifies Jobs CLI.
async function harness(change = {}) {
  const calls = [], originalPlan = plan(), session = {}, profileBytes = Buffer.from('{"fixture":"private"}');
  const profile = { profile: pin.profile, planFile: '/private/plan.json' };
  const native = { plan: originalPlan, session, revalidateSource() { calls.push('native-source-check'); if (change.drift) throw Error('SOURCE_DRIFT'); } };
  const config = { checkout: '/source/jobs', nodePath: fs.realpathSync(process.execPath), nodeVersion: '22.23.3', nodeSha256: 'ab'.repeat(32), profilePath: '/private/profile.json', configPath: '/private/config.json', expectedProfileSha256: common.sha256(profileBytes), provider: Object.freeze({ marker: 'operator-selected-reader' }) };
  const fixture = { common: { ...common,
    observeSource(_config, supported) { calls.push('source-check'); assert.equal(supported.commit, pin.commit); },
    runtime(_config, supported) { calls.push('runtime-check'); assert.deepEqual(Array.from(supported.nodeVersions), ['22.23.3']); },
    ordinary(file) { return file === config.profilePath ? (change.changedProfile ? Buffer.from('changed') : profileBytes) : Buffer.from('{}'); },
    readJson(file) { return file === config.profilePath ? profile : originalPlan; },
  }, createRequire() { return file => {
    if (file.endsWith(pin.profileModule)) return { loadExternalProfile(filename, input) { calls.push('load-native-profile'); assert.equal(filename, config.profilePath); assert.equal(input.provider, config.provider); return native; } };
    if (file.endsWith(pin.commandModule)) return { async runCommand(request) {
      calls.push({ command: request.command, sessionMatches: request.session === session, output: request.output });
      if (change.failCommand) throw Error('NATIVE_STOP_PRESERVE_STATE');
      await Promise.resolve();
      return Object.freeze({ schema: 'jobs-external-command-result-v1', command: request.command, outputWritten: true, broadcastByCoordinator: false });
    } };
    throw Error('UNEXPECTED_MODULE');
  }; } };
  const names = Object.keys(common);
  const bundle = await build({ entryPoints: [new URL('../coordinators/jobs-native.mjs', import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['ethers'], plugins: [{ name: 'native-boundary-fixture', setup(b) {
    b.onResolve({ filter: /^\.\/common\.mjs$/ }, () => ({ path: 'common', namespace: 'fixture' }));
    b.onResolve({ filter: /^node:module$/ }, () => ({ path: 'module', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'module'
      ? 'export const createRequire=(...args)=>globalThis.fixture.createRequire(...args);'
      : names.map(name => 'export const ' + name + '=(...args)=>globalThis.fixture.common.' + name + '(...args);').join('\n'), loader: 'js' }));
  } }] });
  const module = { exports: {} };
  runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, fixture, require: createRequire(import.meta.url), Buffer, Object, process: { execPath: process.execPath, versions: { node: '22.23.3' } } });
  return { driver: () => module.exports.createJobsNativeDriver(config), calls, config };
}
test('trusted native driver uses the exact source API and operator-selected reader, with no signing or network relay', async () => {
  const h = await harness(), driver = h.driver(); assert.equal(driver.supported.commit, pin.commit);
  const result = await driver.command({ command: 'inspect', output: '/private/result.json' });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { schema: 'jobs-external-command-result-v1', command: 'inspect', outputWritten: true, broadcastByCoordinator: false });
  assert.deepEqual(h.calls.filter(x => typeof x === 'object'), [{ command: 'inspect', sessionMatches: true, output: '/private/result.json' }]);
});
test('native driver rejects injected session, raw relay and accessor commands before native dispatch', async () => {
  const h = await harness(), driver = h.driver();
  for (const request of [{ command: 'relay', output: '/private/out' }, { command: 'inspect', session: {}, output: '/private/out' }, Object.defineProperty({}, 'command', { enumerable: true, get() { throw Error('PRIVATE_GETTER'); } })]) await assert.rejects(driver.command(request), /JOBS_NATIVE_COMMAND_REJECTED/);
  assert.equal(h.calls.some(x => typeof x === 'object'), false);
});
test('native command failure is not retried and does not synthesize a successful acknowledgement', async () => {
  const h = await harness({ failCommand: true }), driver = h.driver();
  await assert.rejects(driver.command({ command: 'observe', output: '/private/result.json' }), /NATIVE_STOP_PRESERVE_STATE/);
  assert.equal(h.calls.filter(x => typeof x === 'object').length, 1);
});
test('profile bytes changing after review stop before native session loading', async () => {
  const h = await harness({ changedProfile: true }); assert.throws(() => h.driver(), /JOBS_PROFILE_REVIEW_MISMATCH/);
  assert.equal(h.calls.includes('load-native-profile'), false);
});
