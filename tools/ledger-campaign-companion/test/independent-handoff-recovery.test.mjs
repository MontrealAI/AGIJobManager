import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createCampaignEngine } from '../bridge/campaign-engine.mjs';
import { campaignFixture, adapterFixture, signedFixture, fixtureTime } from './bridge-fixtures.mjs';

async function setup(t, mode = 'no-ack') {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'independent-handoff-recovery-'));
  const campaign = campaignFixture(); campaign.relayPolicy = { enabled: true, acknowledgementMode: 'EXACT_COORDINATOR_PER_STEP' };
  const base = adapterFixture(campaign); let knownHash, relayCalls = 0, observeCalls = 0;
  const adapter = Object.freeze({ ...base.adapter,
    async importSigned(args) { const result = await base.adapter.importSigned(args); knownHash = result.transactionHash; return result; },
    async observe() { observeCalls++; return { operationId: campaign.reviewedManifest.operations[0].operationId, ...(mode === 'no-hash' ? {} : { transactionHash: knownHash }), state: 'signed', verified: false, finalized: false, relayAlreadyAttempted: false, ...(mode === 'lost-relay' ? { acknowledgement: 'EXACT_ACK_0' } : {}) }; },
    async relayOne() { relayCalls++; throw new Error('SYNTHETIC_RELAY_RESPONSE_LOSS'); }
  });
  const settings = { campaign, adapter, privateDirectory: path.join(directory, 'private'), relayEnabled: true, now: () => fixtureTime };
  let engine = await createCampaignEngine(settings);
  const prepared = await engine.prepare({ step: 0 });
  const capability = signedFixture(prepared.prepared);
  await engine.importSigned({ step: 0, operationId: prepared.operationId, capability });
  t.after(async () => { await engine.close(); await fs.rm(directory, { recursive: true, force: true }); });
  const capabilityDigest = async () => {
    const names = (await fs.readdir(settings.privateDirectory)).filter(name => name.startsWith('signed-step-'));
    assert.equal(names.length, 1);
    return createHash('sha256').update(await fs.readFile(path.join(settings.privateDirectory, names[0]))).digest('hex');
  };
  return { get engine() { return engine; }, request: { step: 0, operationId: prepared.operationId }, capabilityDigest,
    async restart() { await engine.close(); engine = await createCampaignEngine(settings); },
    counts: () => ({ prepare: base.calls.prepare, import: base.calls.importSigned, relay: relayCalls, observe: observeCalls }) };
}

test('independent: a fresh signed observation without native acknowledgement removes previously displayed relay permission', async t => {
  const f = await setup(t), before = await f.capabilityDigest();
  const observed = await f.engine.observe(f.request);
  assert.equal(observed.state, 'recovery-required'); assert.equal(observed.acknowledgement, undefined);
  await assert.rejects(f.engine.relayOne({ ...f.request, acknowledgement: 'EXACT_ACK_0' }));
  assert.equal(await f.capabilityDigest(), before); assert.equal(f.counts().relay, 0);
});

test('independent: an observation that omits exact hash cannot refresh previously imported relay permission', async t => {
  const f = await setup(t, 'no-hash');
  const observed = await f.engine.observe(f.request);
  assert.equal(observed.state, 'recovery-required'); assert.equal(observed.acknowledgement, undefined);
  await assert.rejects(f.engine.relayOne({ ...f.request, acknowledgement: 'EXACT_ACK_0' })); assert.equal(f.counts().relay, 0);
});

test('independent: lost relay response retains byte-identical capability and durable attempt across repeated restarts and stale signed observations', async t => {
  const f = await setup(t, 'lost-relay'), before = await f.capabilityDigest();
  await assert.rejects(f.engine.relayOne({ ...f.request, acknowledgement: 'EXACT_ACK_0' }), { code: 'RELAY_OUTCOME_UNKNOWN_NO_RETRY' });
  assert.equal(f.counts().relay, 1);
  for (let i = 0; i < 2; i++) {
    await f.restart(); const observed = await f.engine.observe(f.request);
    assert.equal(observed.state, 'recovery-required'); assert.equal(observed.acknowledgement, undefined); assert.equal(observed.relayAttempted, true);
    await assert.rejects(f.engine.relayOne({ ...f.request, acknowledgement: 'EXACT_ACK_0' }));
    await assert.rejects(f.engine.prepare({ step: 0 })); assert.equal(await f.capabilityDigest(), before);
  }
  assert.deepEqual(f.counts(), { prepare: 1, import: 1, relay: 1, observe: 2 });
});

test('independent: unsigned pending observation and restart preserve the original intent for exactly one durable import', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'independent-unsigned-restart-'));
  const campaign = campaignFixture(), base = adapterFixture(campaign);
  const settings = { campaign, adapter: base.adapter, privateDirectory: path.join(directory, 'private'), now: () => fixtureTime };
  let engine = await createCampaignEngine(settings);
  t.after(async () => { await engine.close(); await fs.rm(directory, { recursive: true, force: true }); });
  const prepared = await engine.prepare({ step: 0 }), request = { step: 0, operationId: prepared.operationId };
  assert.equal((await engine.observe(request)).state, 'pending');
  await engine.close(); engine = await createCampaignEngine(settings);
  await assert.rejects(engine.prepare({ step: 0 }), { code: 'READ_ONLY_RECOVERY_REQUIRED' });
  const capability = signedFixture(prepared.prepared);
  const imported = await engine.importSigned({ ...request, capability });
  assert.equal(imported.durable, true); assert.equal(imported.state, 'signed');
  await assert.rejects(engine.importSigned({ ...request, capability }), { code: 'READ_ONLY_RECOVERY_REQUIRED' });
  assert.equal(base.calls.prepare, 1); assert.equal(base.calls.importSigned, 1); assert.equal(base.calls.relayOne, 0);
  const files = (await fs.readdir(settings.privateDirectory)).filter(name => name.startsWith('signed-step-'));
  assert.equal(files.length, 1);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(settings.privateDirectory, files[0]), 'utf8')), capability);
});
