import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createCampaignEngine } from '../bridge/campaign-engine.mjs';
import { sha256 } from '../bridge/private-store.mjs';
import { campaignFixture, adapterFixture, signedFixture, fixtureTime } from './bridge-fixtures.mjs';

function context(campaign, control, policy = 'c'.repeat(64)) {
  return Object.freeze({ receipt: Object.freeze({ schema: 'SYNTHETIC-ENGINE-CONTEXT-UNIT-ONLY', policySha256: policy, campaignSha256: sha256(campaign), locallyRecompiled: true, exactTransactionBytesValidated: true }),
    assertUnchanged() { control.checks++; if (control.drift) throw Object.assign(new Error('SYNTHETIC_TRUST_DRIFT'), { code: 'SYNTHETIC_TRUST_DRIFT' }); return true; } });
}
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'independent-trust-context-'));
  const campaign = campaignFixture(); campaign.relayPolicy = { enabled: true, acknowledgementMode: 'EXACT_COORDINATOR_PER_STEP' };
  const native = adapterFixture(campaign), control = { drift: false, checks: 0 }, trustedContext = context(campaign, control);
  const options = { campaign, adapter: native.adapter, privateDirectory: path.join(directory, 'private'), trustedContext, relayEnabled: true, now: () => fixtureTime };
  let engine = await createCampaignEngine(options);
  t.after(async () => { await engine?.close(); await fs.rm(directory, { recursive: true, force: true }); });
  return { campaign, native, control, options, trustedContext, get engine() { return engine; }, async close() { await engine?.close(); engine = null; }, async open(extra = {}) { engine = await createCampaignEngine({ ...options, ...extra }); return engine; },
    async capabilities() { const names = (await fs.readdir(options.privateDirectory)).filter(name => name.startsWith('signed-step-')); return Promise.all(names.map(async name => ({ name, digest: createHash('sha256').update(await fs.readFile(path.join(options.privateDirectory, name))).digest('hex') }))); } };
}

test('independent engine context: original trust policy is durable; changed policy refuses reopen without leaving owner lock', async t => {
  const f = await fixture(t); assert.equal((await f.engine.status()).trustedLocalBuild.policySha256, f.trustedContext.receipt.policySha256);
  await f.close();
  await assert.rejects(f.open({ trustedContext: context(f.campaign, f.control, 'd'.repeat(64)) }), { code: 'TRUST_POLICY_CHANGED_RECONCILE_ORIGINAL_CAMPAIGN' });
  assert.equal((await fs.readdir(f.options.privateDirectory)).includes('bridge-owner.lock'), false);
  await f.open(); assert.equal((await f.engine.status()).trustedLocalBuild.policySha256, f.trustedContext.receipt.policySha256);
});
test('independent engine context: a campaign with durable trust policy cannot reopen by omitting that context', async t => {
  const f = await fixture(t); await f.close();
  await assert.rejects(f.open({ trustedContext: undefined }), { code: 'TRUSTED_LOCAL_CONTEXT_REQUIRED' });
});
test('independent engine context: trust drift after device approval preserves exact private capability before refusing native import', async t => {
  const f = await fixture(t), packet = await f.engine.prepare({ step: 0 }), capability = signedFixture(packet.prepared), request = { step: 0, operationId: packet.operationId };
  f.control.drift = true;
  const imported = await f.engine.importSigned({ ...request, capability });
  assert.equal(imported.durable, true); assert.equal(imported.state, 'recovery-required'); assert.equal(imported.blocker, 'TRUSTED_BUILD_CHANGED_DO_NOT_RELAY'); assert.equal(imported.transactionHash, capability.transactionHash);
  assert.equal(f.native.calls.importSigned, 0); assert.equal(f.native.calls.relayOne, 0); const preserved = await f.capabilities(); assert.equal(preserved.length, 1);
  const publicText = JSON.stringify(await f.engine.report()); assert.equal(publicText.includes(capability.signedTransaction), false);
  await f.close(); f.control.drift = false; await f.open();
  assert.deepEqual(await f.capabilities(), preserved);
  await assert.rejects(f.engine.prepare({ step: 0 })); await assert.rejects(f.engine.importSigned({ ...request, capability }));
  assert.equal(f.native.calls.prepare, 1); assert.equal(f.native.calls.importSigned, 0); assert.equal(f.native.calls.relayOne, 0);
});
test('independent engine context: build drift during native prepare prevents packet presentation and permanently preserves uncertain intent', async t => {
  const f = await fixture(t); await f.close();
  const adapter = Object.freeze({ ...f.native.adapter, async prepare(args) { const packet = await f.native.adapter.prepare(args); f.control.drift = true; return packet; } });
  await f.open({ adapter });
  await assert.rejects(f.engine.prepare({ step: 0 }), { code: 'SYNTHETIC_TRUST_DRIFT' });
  const step = (await f.engine.status()).steps[0]; assert.equal(step.state, 'recovery-required'); assert.equal(step.blocker, 'PREPARE_OUTCOME_UNKNOWN'); assert.equal(step.signingRequestedAt, undefined);
  f.control.drift = false; await assert.rejects(f.engine.prepare({ step: 0 })); assert.equal(f.native.calls.prepare, 1);
});
test('independent engine context: trust drift blocks explicit relay before creating an attempt or invoking native relay', async t => {
  const f = await fixture(t), packet = await f.engine.prepare({ step: 0 }), request = { step: 0, operationId: packet.operationId };
  await f.engine.importSigned({ ...request, capability: signedFixture(packet.prepared) }); f.control.drift = true;
  await assert.rejects(f.engine.relayOne({ ...request, acknowledgement: 'EXACT_ACK_0' }), { code: 'SYNTHETIC_TRUST_DRIFT' });
  assert.equal(f.native.calls.relayOne, 0); assert.equal((await f.engine.status()).steps[0].relayAttempted, undefined);
});
test('independent engine context: source/build drift blocks receipt observation without invoking native coordinator', async t => {
  const f = await fixture(t), packet = await f.engine.prepare({ step: 0 }), request = { step: 0, operationId: packet.operationId };
  await f.engine.importSigned({ ...request, capability: signedFixture(packet.prepared) }); f.control.drift = true;
  await assert.rejects(f.engine.observe(request), { code: 'SYNTHETIC_TRUST_DRIFT' }); assert.equal(f.native.calls.observe, 0);
  const step = (await f.engine.status()).steps[0]; assert.equal(step.state, 'recovery-required'); assert.equal(step.acknowledgement, undefined); assert.equal((await f.capabilities()).length, 1);
});
