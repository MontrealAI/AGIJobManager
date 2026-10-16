import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createVerificationAutomation } from '../verification/automation.mjs';
import { canonicalJson, prepareVerificationTask } from '../verification/explorer.mjs';

const digest = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const transactionHash = `0x${'aa'.repeat(32)}`;
function tasks() {
  const standardInput = { language: 'Solidity', sources: { 'Example.sol': { content: 'contract Example {}' } }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun', libraries: {} } };
  return Array.from({ length: 5 }, (_, index) => ({ schema: 'manual-ledger-verification-task-v1', chainId: 1, address: `0x${(index + 1).toString(16).padStart(40, '0')}`, qualifiedName: 'Example.sol:Example', compilerVersion: 'v0.8.37+commit.f401782d', standardInput, standardInputSha256: digest(standardInput), constructorArguments: '', libraries: {}, creation: { transactionHash: `0x${(index + 10).toString(16).padStart(64, '0')}`, blockHash: `0x${'bb'.repeat(32)}`, blockNumber: 100, canonical: true, finalized: true, runtimeVerified: true }, licenseType: '3' }));
}
function fixture({ authorize = false, drift = false, observeFailure = false, duplicate = false } = {}) {
  const source = { repository: 'MontrealAI/AGI-Alpha-Agent-v0', commit: '1'.repeat(40), tree: '2'.repeat(40) };
  const serviceAuthorization = { service: 'etherscan-v2', submitSource: true, campaignId: 'synthetic-alpha', planSha256: '3'.repeat(64) };
  const campaign = { campaignId: 'synthetic-alpha', adapter: 'alpha', reviewedManifest: { source, planSha256: '3'.repeat(64), operations: Array.from({ length: 7 }, (_, index) => ({ operationId: `step-${index}` })) }, coordinator: { licenseType: '3' }, ...(authorize ? { verification: { serviceAuthorization } } : {}) };
  let exports = 0, observations = 0, requests = 0;
  const originalTasks = tasks(), journal = new Map();
  const adapter = Object.freeze({
    id: 'alpha', supported: source,
    observe: async () => { observations++; return { state: observeFailure ? 'pending' : 'verified', verified: !observeFailure, finalized: !observeFailure, transactionHash }; },
    exportVerification: async () => { exports++; const output = copy(originalTasks); if (drift && exports > 1) output[0].creation.blockHash = `0x${'cc'.repeat(32)}`; if (duplicate) output[1] = output[0]; return { tasks: output, explorerAcceptance: 'NOT_OBSERVED', activationAllowed: false }; },
  });
  const context = { campaign, step: 6, operationId: 'step-6', transactionHash, adapter, privateDirectory: '/synthetic-private', readVerificationState: async id => copy(journal.get(id) ?? null), transitionVerificationState: async (next, control) => { const previous = journal.get(next.taskId); assert.equal(control.expectedPreviousDigest, previous ? digest(previous) : null); journal.set(next.taskId, copy(next)); } };
  const fetch = async url => {
    requests++; const parsed = new URL(url); assert.equal(parsed.searchParams.get('action'), 'getsourcecode');
    const task = originalTasks.find(item => item.address === parsed.searchParams.get('address'));
    assert.ok(task);
    return new Response(JSON.stringify({ status: '1', result: [{ SourceCode: canonicalJson(task.standardInput), ContractName: 'Example', ContractFileName: 'Example.sol', CompilerVersion: task.compilerVersion, CompilerType: 'solc', ConstructorArguments: '', Library: '', SimilarMatch: '' }] }));
  };
  return { context, serviceAuthorization, fetch, journal, get exports() { return exports; }, get observations() { return observations; }, get requests() { return requests; } };
}

test('automatic verification waits for the whole already-approved creation graph', async () => {
  const h = fixture(), hook = createVerificationAutomation();
  const result = await hook({ ...h.context, step: 3, operationId: 'step-3' });
  assert.equal(result.state, 'pending'); assert.equal(h.observations, 0); assert.equal(h.exports, 0); assert.equal(h.requests, 0);
});

test('complete graph always exports exact offline tasks without a credential or service effect', async () => {
  const h = fixture(), hook = createVerificationAutomation({ fetch: () => assert.fail('unexpected service request') });
  const result = await hook(h.context);
  assert.equal(result.state, 'exported'); assert.equal(result.explorerStatus, 'SOURCE_PACKAGES_EXPORTED');
  assert.equal(result.packageSha256.length, 64); assert.equal(h.exports, 1); assert.equal(h.observations, 1);
  assert.equal(result.activationReady, false);
});

test('a factory secret cannot silently authorize source publication', async () => {
  const h = fixture(), hook = createVerificationAutomation({ apiKey: 'SYNTHETIC_KEY', serviceAuthorization: h.serviceAuthorization, fetch: h.fetch });
  assert.equal((await hook(h.context)).state, 'exported'); assert.equal(h.requests, 0);
});

test('declared authorization without secure server setup yields a truthful blocker', async () => {
  const h = fixture({ authorize: true }), hook = createVerificationAutomation({ serviceAuthorization: h.serviceAuthorization, fetch: h.fetch });
  assert.equal((await hook(h.context)).blocker, 'EXPLORER_SECURE_SETUP_REQUIRED'); assert.equal(h.requests, 0);
});

test('exact final callback verifies five source packages with fresh synthetic adapter callbacks', async () => {
  const h = fixture({ authorize: true }), hook = createVerificationAutomation({ apiKey: 'SYNTHETIC_KEY', serviceAuthorization: h.serviceAuthorization, fetch: h.fetch, sleep: async () => {}, clock: () => 1_800_000_000_000 });
  const result = await hook(h.context);
  assert.equal(result.state, 'verified'); assert.equal(result.explorerStatus, 'ALL_EXACT_SOURCES_VERIFIED');
  assert.equal(h.requests, 5); assert.ok(h.observations > 5); assert.ok(h.exports > 5);
  assert.equal(h.journal.size, 5); assert.equal(result.authorityComplete, false); assert.equal(result.productionApproved, false);
});

test('receipt drift on fresh export prevents corresponding explorer requests', async () => {
  const h = fixture({ authorize: true, drift: true }), hook = createVerificationAutomation({ apiKey: 'SYNTHETIC_KEY', serviceAuthorization: h.serviceAuthorization, fetch: h.fetch, sleep: async () => {} });
  const result = await hook(h.context);
  assert.equal(result.state, 'blocked'); assert.notEqual(result.explorerStatus, 'ALL_EXACT_SOURCES_VERIFIED');
  assert.equal([...h.journal.values()].some(state => state.taskId === prepareVerificationTask(tasks()[0]).taskId && state.state === 'verified'), false);
});

test('failed coordinator observation and duplicate creation tasks cannot be called complete', async () => {
  for (const settings of [{ observeFailure: true }, { duplicate: true }]) {
    const h = fixture(settings), hook = createVerificationAutomation({ fetch: h.fetch });
    assert.equal((await hook(h.context)).state, 'blocked'); assert.equal(h.requests, 0);
  }
});

test('mismatched campaign service authorization remains offline', async () => {
  const h = fixture({ authorize: true }), wrong = { ...h.serviceAuthorization, planSha256: '4'.repeat(64) };
  const hook = createVerificationAutomation({ apiKey: 'SYNTHETIC_KEY', serviceAuthorization: wrong, fetch: h.fetch });
  assert.equal((await hook(h.context)).state, 'exported'); assert.equal(h.requests, 0);
});

test('Jobs is honestly unsupported and cannot obtain a generic verification call path', async () => {
  const h = fixture(), adapter = Object.freeze({ id: 'jobs' });
  assert.equal((await createVerificationAutomation()({ ...h.context, adapter })).state, 'unsupported');
});

function runtimeFixture({ omit = false, mismatch = false, outputDrift = false } = {}) {
  const h = fixture({ authorize: true }); let exports = 0;
  const concrete = Object.freeze({ ...h.context.adapter, supported: { ...h.context.adapter.supported, runtimeEvidenceRequired: true }, exportVerification: async context => {
    const result = await h.context.adapter.exportVerification(context); exports++;
    if (!omit) result.runtimeEvidence = result.tasks.map(task => ({ schema: 'manual-ledger-runtime-evidence-v1', chainId: 1, address: task.address, source: h.context.campaign.reviewedManifest.source, qualifiedName: task.qualifiedName, compilerVersion: task.compilerVersion, standardInputSha256: task.standardInputSha256, compilerOutputSha256: outputDrift && exports > 1 ? 'c'.repeat(64) : 'b'.repeat(64), runtimeTemplate: '0x6000', linkReferences: {}, libraries: {}, immutableReferences: {}, immutableValues: {}, actualRuntime: mismatch ? '0x6001' : '0x6000', creation: { transactionHash: task.creation.transactionHash, blockHash: task.creation.blockHash, blockNumber: task.creation.blockNumber }, observedBlock: { hash: task.creation.blockHash, number: task.creation.blockNumber } }));
    return result;
  } });
  const outer = Object.freeze({ id: 'alpha', supported: { repository: 'legacy', commit: '0'.repeat(40), tree: '0'.repeat(40) }, forCampaign: campaign => { assert.equal(campaign, h.context.campaign); return concrete; } });
  return { h, context: { ...h.context, adapter: outer } };
}
test('new selected compatibility profile requires full exact runtime evidence before service effects', async () => {
  for (const settings of [{ omit: true }, { mismatch: true }]) {
    const { h, context } = runtimeFixture(settings); const result = await createVerificationAutomation({ apiKey: 'SYNTHETIC_KEY', serviceAuthorization: h.serviceAuthorization, fetch: h.fetch })(context);
    assert.equal(result.state, 'blocked'); assert.equal(h.requests, 0);
  }
});
test('new selected compatibility profile verifies sources with fresh exact runtime consistency', async () => {
  const { h, context } = runtimeFixture(); const result = await createVerificationAutomation({ apiKey: 'SYNTHETIC_KEY', serviceAuthorization: h.serviceAuthorization, fetch: h.fetch, sleep: async () => {} })(context);
  assert.equal(result.state, 'verified'); assert.equal(h.requests, 5); assert.equal(result.authorityComplete, false);
});
test('fresh locally derived compiler output drift blocks service acceptance', async () => {
  const { h, context } = runtimeFixture({ outputDrift: true }); const result = await createVerificationAutomation({ apiKey: 'SYNTHETIC_KEY', serviceAuthorization: h.serviceAuthorization, fetch: h.fetch, sleep: async () => {} })(context);
  assert.equal(result.state, 'blocked'); assert.equal(h.requests, 0);
});
