import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCampaignEngine } from '../bridge/campaign-engine.mjs';
import { campaignFixture, adapterFixture, fixtureTime, signedFixture } from './bridge-fixtures.mjs';

async function fixture(t, count = 1, extra = {}) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'companion-engine-')); const campaign = campaignFixture(count), tools = adapterFixture(campaign);
  let time = fixtureTime;
  const options = { campaign, adapter: tools.adapter, privateDirectory: path.join(base, 'private'), now: () => time, ...extra };
  const engine = await createCampaignEngine(options);
  t.after(async () => { await engine.close(); await fs.rm(base, { recursive: true, force: true }); });
  return { base, campaign, ...tools, options, engine, setTime: value => { time = value; } };
}
test('intent and signing marker are durable before packet response; duplicate prepares cannot sign again', async t => {
  const f = await fixture(t); const result = await f.engine.prepare({ step: 0 });
  assert.equal(result.state, 'signing-requested');
  const files = (await fs.readdir(f.options.privateDirectory)).filter(name => name.startsWith('state-')).sort();
  const saved = JSON.parse(await fs.readFile(path.join(f.options.privateDirectory, files.at(-1)), 'utf8'));
  assert.equal(saved.state.steps[0].state, 'signing-requested'); assert.ok(saved.state.steps[0].signingRequestedAt);
  await assert.rejects(f.engine.prepare({ step: 0 }), { code: 'READ_ONLY_RECOVERY_REQUIRED' }); assert.equal(f.calls.prepare, 1);
});
test('genuine adapter enriched validated intent is normalized to the exact four-field browser packet', async t => {
  const f = await fixture(t); await f.engine.close();
  const { validateIntent } = await import('../src/envelope.mjs'), original = f.adapter;
  const adapter = Object.freeze({ ...original, async prepare(args) { const result = await original.prepare(args); return { ...result, prepared: validateIntent(result.prepared.unsignedHex, result.prepared.expectedUnsignedHash, result.prepared.review, result.prepared.expectedPolicyHash, fixtureTime) }; } });
  const engine = await createCampaignEngine({ ...f.options, adapter });
  try { const result = await engine.prepare({ step: 0 }); assert.deepEqual(Object.keys(result.prepared).sort(), ['expectedPolicyHash','expectedUnsignedHash','review','unsignedHex']); } finally { await engine.close(); }
});
test('signed capability is private durable before genuine import and never in public status/report', async t => {
  const f = await fixture(t); const prepared = await f.engine.prepare({ step: 0 }), cap = signedFixture(prepared.prepared);
  const result = await f.engine.importSigned({ step: 0, operationId: prepared.operationId, capability: cap });
  assert.equal(result.durable, true); assert.equal(result.state, 'signed'); assert.equal(f.calls.importSigned, 1);
  const signed = (await fs.readdir(f.options.privateDirectory)).find(name => name.startsWith('signed-step-'));
  assert.ok(signed); assert.equal((await fs.stat(path.join(f.options.privateDirectory, signed))).mode & 0o777, 0o600);
  const privateRecord = JSON.parse(await fs.readFile(path.join(f.options.privateDirectory, signed), 'utf8')); assert.equal(privateRecord.signedTransaction, cap.signedTransaction);
  for (const publicRecord of [await f.engine.status(), await f.engine.report(), result]) assert.equal(JSON.stringify(publicRecord).includes(cap.signedTransaction), false);
});
test('expiry preserves a valid signed capability but never calls import or relay', async t => {
  const f = await fixture(t), prepared = await f.engine.prepare({ step: 0 }), cap = signedFixture(prepared.prepared);
  f.setTime(fixtureTime + 120_000); const result = await f.engine.importSigned({ step: 0, operationId: prepared.operationId, capability: cap });
  assert.equal(result.blocker, 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY'); assert.equal(result.durable, true); assert.equal(f.calls.importSigned, 0); assert.equal(f.calls.relayOne, 0);
  await assert.rejects(f.engine.prepare({ step: 0 }), { code: 'CAMPAIGN_EXPIRED' });
});
test('every material signed capability substitution is rejected before private persistence', async t => {
  const f = await fixture(t), prepared = await f.engine.prepare({ step: 0 }), cap = signedFixture(prepared.prepared);
  const changes = [v => { v.transactionHash = `0x${'1'.repeat(64)}`; }, v => { v.review.operationId = 'other'; }, v => { v.expectedUnsignedHash = `0x${'2'.repeat(64)}`; }, v => { v.signedAt = 'invalid'; }, v => { v.status = 'RELAY_NOW'; }, v => { v.extra = 'hidden'; }, v => { v.review.maxTotalFeeWei = '999999'; }];
  for (const change of changes) { const bad = structuredClone(cap); change(bad); await assert.rejects(f.engine.importSigned({ step: 0, operationId: prepared.operationId, capability: bad })); }
  assert.equal(f.calls.importSigned, 0); assert.equal((await fs.readdir(f.options.privateDirectory)).some(name => name.startsWith('signed-step-')), false);
});
test('lost import response is recovery only, private capability survives and duplicate import stops', async t => {
  const f = await fixture(t), prepared = await f.engine.prepare({ step: 0 }); f.controls.importError = true;
  await assert.rejects(f.engine.importSigned({ step: 0, operationId: prepared.operationId, capability: signedFixture(prepared.prepared) }), { code: 'COORDINATOR_IMPORT_BLOCKED' });
  assert.equal((await f.engine.status()).steps[0].blocker, 'IMPORT_OUTCOME_UNKNOWN');
  await assert.rejects(f.engine.importSigned({ step: 0, operationId: prepared.operationId, capability: signedFixture(prepared.prepared) }), { code: 'READ_ONLY_RECOVERY_REQUIRED' });
  assert.equal(f.calls.importSigned, 1);
});
test('simultaneous prepare requests serialize and one campaign private root cannot open twice', async t => {
  const f = await fixture(t); const outcomes = await Promise.allSettled([f.engine.prepare({ step: 0 }), f.engine.prepare({ step: 0 })]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1); assert.equal(f.calls.prepare, 1);
  await assert.rejects(createCampaignEngine(f.options), { code: 'CAMPAIGN_ALREADY_OPEN' });
});
test('refresh/restart preserves unknown signing marker and expired read-only recovery remains available', async t => {
  const f = await fixture(t); await f.engine.prepare({ step: 0 }); await f.engine.close(); f.setTime(fixtureTime + 120_000);
  const reopened = await createCampaignEngine(f.options);
  try { assert.equal((await reopened.status()).steps[0].state, 'signing-requested'); await assert.rejects(reopened.prepare({ step: 0 }), { code: 'CAMPAIGN_EXPIRED' }); assert.equal((await reopened.report()).readiness.activationReady, false); } finally { await reopened.close(); }
});
test('canonical receipt loss demotes verified state and blocks dependent next operation', async t => {
  const f = await fixture(t, 2), prepared = await f.engine.prepare({ step: 0 }); await f.engine.importSigned({ step: 0, operationId: prepared.operationId, capability: signedFixture(prepared.prepared) });
  f.controls.observeState = 'verified'; await f.engine.observe({ step: 0, operationId: prepared.operationId });
  f.controls.observeState = 'pending'; await assert.rejects(f.engine.prepare({ step: 1 }), { code: 'DEPENDENCY_NOT_VERIFIED' });
  assert.equal((await f.engine.status()).steps[0].state, 'pending'); assert.equal(f.calls.prepare, 1);
});
test('changed canonical hash and observer errors persist recovery instead of retaining verified', async t => {
  const f = await fixture(t), prepared = await f.engine.prepare({ step: 0 }); await f.engine.importSigned({ step: 0, operationId: prepared.operationId, capability: signedFixture(prepared.prepared) });
  f.controls.observeState = 'verified'; await f.engine.observe({ step: 0, operationId: prepared.operationId });
  f.controls.changedHash = `0x${'f'.repeat(64)}`; await assert.rejects(f.engine.observe({ step: 0, operationId: prepared.operationId }), { code: 'CANONICAL_RESULT_CHANGED' }); assert.equal((await f.engine.status()).steps[0].state, 'recovery-required');
});
test('relay remains disabled by default and cannot be enabled through arbitrary constructor option', async t => {
  const f = await fixture(t); await assert.rejects(f.engine.relayOne({ step: 0, operationId: f.campaign.reviewedManifest.operations[0].operationId, acknowledgement: 'anything' }), { code: 'RELAY_DISABLED_PENDING_REVIEW' }); assert.equal(f.calls.relayOne, 0);
  await assert.rejects(createCampaignEngine({ ...f.options, relayEnabled: true }), { code: 'RELAY_NOT_REVIEW_ENABLED' });
});
test('exact displayed destination, source tree, account, total fee and schema mutations fail closed', async t => {
  const f = await fixture(t);
  const changes = [c => { c.operations[0].destination = 'old-target'; }, c => { c.reviewedManifest.source.tree = '9'.repeat(40); }, c => { c.actors.creator = c.actors.governor; }, c => { c.maxTotalFeeWei = '1'; }, c => { c.packetSchema = 'unknown'; }];
  for (const change of changes) { const bad = structuredClone(f.campaign); change(bad); await assert.rejects(createCampaignEngine({ ...f.options, campaign: bad, privateDirectory: path.join(f.base, 'other') })); }
});
test('verification failure is truthful and cannot make authority or activation true', async t => {
  const f = await fixture(t, 1, { afterVerified: async () => { throw new Error('PRIVATE_SERVICE_SECRET'); } }), prepared = await f.engine.prepare({ step: 0 }); await f.engine.importSigned({ step: 0, operationId: prepared.operationId, capability: signedFixture(prepared.prepared) });
  f.controls.observeState = 'verified'; const observed = await f.engine.observe({ step: 0, operationId: prepared.operationId }); assert.equal(observed.verification.state, 'blocked');
  assert.equal((await f.engine.report()).readiness.authorityComplete, false); assert.equal(JSON.stringify(await f.engine.report()).includes('PRIVATE_SERVICE_SECRET'), false);
});
test('explorer state transitions use durable private compare-and-swap and immutable attempted marker', async t => {
  let context;
  const f = await fixture(t, 1, { afterVerified: async value => {
    context = value;
    const state = { schema: 'manual-ledger-explorer-state-v1', taskId: 'task-0', state: 'prepared', submissionAttempted: false, updatedAt: new Date(fixtureTime).toISOString() }, { sha256 } = await import('../bridge/private-store.mjs');
    assert.equal(context.readVerificationState(state.taskId), null);
    const parallel = await Promise.allSettled([context.transitionVerificationState(state, { taskId: state.taskId, expectedPreviousDigest: null }), context.transitionVerificationState(state, { taskId: state.taskId, expectedPreviousDigest: null })]);
    assert.equal(parallel.filter(result => result.status === 'fulfilled').length, 1);
    const attempted = { ...state, state: 'submission-attempted', submissionAttempted: true };
    await context.transitionVerificationState(attempted, { taskId: state.taskId, expectedPreviousDigest: sha256(state) });
    await assert.rejects(context.transitionVerificationState(state, { taskId: state.taskId, expectedPreviousDigest: sha256(attempted) }), { code: 'VERIFICATION_SUBMISSION_MARKER_IMMUTABLE' });
    return { state: 'pending', explorerStatus: 'PENDING' };
  } }), prepared = await f.engine.prepare({ step: 0 });
  await f.engine.importSigned({ step: 0, operationId: prepared.operationId, capability: signedFixture(prepared.prepared) }); f.controls.observeState = 'verified'; const observed = await f.engine.observe({ step: 0, operationId: prepared.operationId }); assert.equal(observed.verification.state, 'pending');
  assert.throws(() => context.readVerificationState('task-0'), { code: 'VERIFICATION_CONTEXT_CLOSED' });
  await assert.rejects(context.transitionVerificationState({}, { taskId: 'task-0', expectedPreviousDigest: null }), { code: 'VERIFICATION_CONTEXT_CLOSED' });
  assert.equal(JSON.stringify(await f.engine.report()).includes('task-0'), false);
});
test('explicit same-host dead bridge-owner recovery preserves caps and actor locks and forces read-only observation', async t => {
  const f = await fixture(t), prepared = await f.engine.prepare({ step: 0 });
  await f.engine.importSigned({ step: 0, operationId: prepared.operationId, capability: signedFixture(prepared.prepared) });
  const ownerFile = path.join(f.options.privateDirectory, 'bridge-owner.lock'), owner = JSON.parse(await fs.readFile(ownerFile, 'utf8'));
  if (!owner.hostContext) { await assert.rejects(createCampaignEngine({ ...f.options, recoverDeadOwner: true })); return; }
  const cap = (await fs.readdir(f.options.privateDirectory)).find(name => name.startsWith('signed-step-')), capBefore = await fs.readFile(path.join(f.options.privateDirectory, cap));
  const actors = path.join(f.base, 'native-actor-locks'); await fs.mkdir(actors); const actorLock = path.join(actors, 'creator.lock'); await fs.writeFile(actorLock, 'COORDINATOR-OWNED-DO-NOT-TOUCH', { mode: 0o600 });
  await assert.rejects(createCampaignEngine({ ...f.options, recoverDeadOwner: true }), { code: 'BRIDGE_OWNER_RECOVERY_BLOCKED' });
  await f.engine.close(); owner.pid = 2147483646; await fs.writeFile(ownerFile, JSON.stringify(owner), { mode: 0o600 });
  const reopened = await createCampaignEngine({ ...f.options, recoverDeadOwner: true });
  try {
    assert.equal((await reopened.status()).bridgeRecoveryRequired, true);
    await assert.rejects(reopened.prepare({ step: 0 }), { code: 'BRIDGE_OWNER_READ_ONLY_RECOVERY_REQUIRED' });
    assert.deepEqual(await fs.readFile(path.join(f.options.privateDirectory, cap)), capBefore); assert.equal(await fs.readFile(actorLock, 'utf8'), 'COORDINATOR-OWNED-DO-NOT-TOUCH');
    assert.equal((await fs.readdir(f.options.privateDirectory)).filter(name => name.startsWith('retired-bridge-owner-')).length, 1);
    f.controls.observeState = 'signed'; await reopened.observe({ step: 0, operationId: prepared.operationId }); assert.equal((await reopened.status()).bridgeRecoveryRequired, false);
    await assert.rejects(reopened.prepare({ step: 0 }), { code: 'READ_ONLY_RECOVERY_REQUIRED' });
  } finally { await reopened.close(); }
});
test('unknown host/boot owner records are never retired, even with a conclusively absent pid', async t => {
  const f = await fixture(t), ownerFile = path.join(f.options.privateDirectory, 'bridge-owner.lock'), owner = JSON.parse(await fs.readFile(ownerFile, 'utf8')); await f.engine.close();
  owner.pid = 2147483646; owner.hostContext = { platform: 'other-host', host: 'unknown', boot: 'unknown' }; await fs.writeFile(ownerFile, JSON.stringify(owner), { mode: 0o600 });
  await assert.rejects(createCampaignEngine({ ...f.options, recoverDeadOwner: true }), { code: 'BRIDGE_OWNER_RECOVERY_BLOCKED' });
  assert.equal((await fs.readdir(f.options.privateDirectory)).some(name => name.startsWith('retired-bridge-owner-')), false);
});
