import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalJson, prepareVerificationTask, compareExplorerSource, createExplorerVerifier, ETHERSCAN_V2_ENDPOINT } from '../verification/explorer.mjs';

const digest = value => createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const secret = 'SYNTHETIC_SERVER_KEY_NOT_A_CREDENTIAL';
const guid = 'SYNTHETIC_GUID_12345678901234567890';
const addr = '0x1000000000000000000000000000000000000001';
const lib = '0x2000000000000000000000000000000000000002';
const blockHash = `0x${'11'.repeat(32)}`, transactionHash = `0x${'22'.repeat(32)}`;
function fixture(withLibrary = false) {
  const standardInput = { language: 'Solidity', sources: { 'contracts/Example.sol': { content: 'pragma solidity 0.8.37; contract Example {}' } }, settings: { optimizer: { enabled: true, runs: 40 }, viaIR: true, evmVersion: 'shanghai', metadata: { bytecodeHash: 'none' }, libraries: withLibrary ? { 'contracts/Example.sol': { ExampleLib: lib } } : {} } };
  return { schema: 'manual-ledger-verification-task-v1', chainId: 1, address: addr, qualifiedName: 'contracts/Example.sol:Example', compilerVersion: 'v0.8.37+commit.f401782d', standardInput, standardInputSha256: digest(standardInput), constructorArguments: '00'.repeat(32), libraries: withLibrary ? { 'contracts/Example.sol:ExampleLib': lib } : {}, creation: { transactionHash, blockHash, blockNumber: 100, canonical: true, finalized: true, runtimeVerified: true }, licenseType: '3' };
}
function verified(task = fixture()) {
  return { status: '1', message: 'OK', result: [{ SourceCode: canonicalJson(task.standardInput), ABI: '[]', ContractName: 'Example', ContractFileName: 'contracts/Example.sol', CompilerVersion: task.compilerVersion, CompilerType: 'solc', ConstructorArguments: task.constructorArguments, Library: '', SimilarMatch: '' }] };
}
const unverified = () => ({ status: '1', message: 'OK', result: [{ SourceCode: '', ABI: 'Contract source code not verified', ContractName: '', ContractFileName: '', Library: '', SimilarMatch: '' }] });
const response = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers });
function harness({ replies = [], authorization = true, proof, transitionHook, readHook, limits = {} } = {}) {
  const records = [], sleeps = [], journal = new Map(); let transitions = 0;
  const options = {
    apiKey: secret,
    fetch: async (url, options) => {
      const parsed = new URL(url);
      assert.equal(`${parsed.origin}${parsed.pathname}`, ETHERSCAN_V2_ENDPOINT);
      assert.equal(parsed.searchParams.get('chainid'), '1');
      assert.equal(parsed.searchParams.get('apikey'), secret);
      assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit');
      const request = { action: parsed.searchParams.get('action'), method: options.method, fields: options.body ? Object.fromEntries(new URLSearchParams(options.body)) : {}, guid: parsed.searchParams.get('guid') };
      records.push(request);
      assert.ok(replies.length, 'synthetic response queue exhausted');
      const next = replies.shift();
      return typeof next === 'function' ? next(request, journal) : next;
    },
    authorizeService: async info => authorization ? { service: 'etherscan-v2', taskId: info.taskId, submitSource: true } : false,
    validateCanonical: async task => proof ? proof(task) : ({ chainId: 1, address: task.address, ...task.creation, newTarget: true }),
    readState: async taskId => readHook ? readHook(taskId, journal) : copy(journal.get(taskId) ?? null),
    transition: async (next, context) => {
      transitions++;
      if (transitionHook) await transitionHook(next, context, journal);
      const previous = journal.get(next.taskId);
      assert.equal(context.expectedPreviousDigest, previous ? digest(previous) : null);
      journal.set(next.taskId, copy(next));
    },
    sleep: async ms => { sleeps.push(ms); }, clock: () => 1_800_000_000_000,
    limits: { maxPolls: 2, ...limits },
  };
  return { client: createExplorerVerifier(options), options, records, sleeps, journal, get transitions() { return transitions; } };
}

test('offline exact package uses current Etherscan parameter names without credentials', () => {
  const prepared = prepareVerificationTask(fixture(true));
  assert.equal(prepared.submission.endpoint, ETHERSCAN_V2_ENDPOINT);
  assert.equal(prepared.submission.fields.constructorArguments, '00'.repeat(32));
  assert.equal(prepared.submission.fields.codeformat, 'solidity-standard-json-input');
  assert.equal(Object.hasOwn(prepared.submission.fields, 'constructorArguements'), false);
  assert.equal(JSON.stringify(prepared).includes(secret), false);
  assert.equal(Object.isFrozen(prepared.task.standardInput.settings), true);
  assert.equal(prepared.authorityComplete, false); assert.equal(prepared.activationReady, false);
});

for (const [label, mutate] of [
  ['chain', task => { task.chainId = 11155111; }],
  ['schema', task => { task.schema += '-unknown'; }],
  ['hash', task => { task.standardInputSha256 = '0'.repeat(64); }],
  ['settings', task => { task.standardInput.settings.optimizer.runs++; }],
  ['link map', task => { task.libraries = { 'contracts/Example.sol:ExampleLib': lib }; }],
  ['constructor hex', task => { task.constructorArguments = '0x0g'; }],
  ['compiler suffix', task => { task.compilerVersion += '.Emscripten.clang'; }],
  ['license absent', task => { delete task.licenseType; }],
  ['arbitrary endpoint', task => { task.endpoint = 'https://example.invalid'; }],
  ['source URL', task => { task.standardInput.sources['contracts/Example.sol'] = { urls: ['https://example.invalid'] }; task.standardInputSha256 = digest(task.standardInput); }],
  ['old noncanonical creation', task => { task.creation.canonical = false; }],
]) test(`package rejects material ${label} substitution`, () => {
  const task = fixture(); mutate(task);
  assert.throws(() => prepareVerificationTask(task), error => error.code === 'EXPLORER_TASK_INVALID');
});

test('exact response accepts canonical key order and the Etherscan Standard JSON wrapper', () => {
  const task = fixture(true), payload = verified(task); payload.result[0].SourceCode = `{${JSON.stringify(task.standardInput)}}`;
  payload.result[0].Library = `contracts/Example.sol:ExampleLib:${lib}`;
  assert.equal(compareExplorerSource(prepareVerificationTask(task), payload), 'exact');
});

for (const [label, mutate] of [
  ['source', row => { const input = JSON.parse(row.SourceCode); input.sources['contracts/Example.sol'].content += '\n// changed'; row.SourceCode = JSON.stringify(input); }],
  ['compiler', row => { row.CompilerVersion = 'v0.8.36+commit.12345678'; }],
  ['file path', row => { row.ContractFileName = 'contracts/Other.sol'; }],
  ['missing qualified file', row => { row.ContractFileName = ''; }],
  ['constructor', row => { row.ConstructorArguments = 'ff'; }],
  ['similar match', row => { row.SimilarMatch = lib; }],
  ['absent similar-match field', row => { delete row.SimilarMatch; }],
  ['link map', row => { const input = JSON.parse(row.SourceCode); input.settings.libraries = { 'contracts/Example.sol': { ExampleLib: lib } }; row.SourceCode = JSON.stringify(input); }],
]) test(`source acceptance rejects ${label} mismatch`, () => {
  const task = fixture(), payload = verified(task); mutate(payload.result[0]);
  assert.equal(compareExplorerSource(prepareVerificationTask(task), payload), 'mismatch');
});

test('already-verified exact contract is idempotent and cannot grant authority/activation', async () => {
  const h = harness({ replies: [response(verified())] });
  const result = await h.client.verify(fixture());
  assert.equal(result.state, 'verified'); assert.equal(result.explorerStatus, 'EXACT_SOURCE_VERIFIED');
  assert.deepEqual(h.records.map(record => record.method), ['GET']);
  for (const field of ['authorityComplete', 'activationReady', 'productionApproved']) assert.equal(result[field], false);
});

test('source submission requires exact explicit owner service authorization', async () => {
  const h = harness({ replies: [response(unverified())], authorization: false });
  const result = await h.client.verify(fixture());
  assert.equal(result.blocker, 'EXPLORER_SERVICE_AUTHORIZATION_REQUIRED');
  assert.equal(h.records.some(record => record.method === 'POST'), false);
});

test('receipt fields alone cannot bypass trusted fresh canonical proof', async () => {
  const h = harness({ replies: [], proof: task => ({ ...task.creation, chainId: 1, address: task.address }) });
  const result = await h.client.verify(fixture());
  assert.equal(result.blocker, 'EXPLORER_CANONICAL_PROOF_REQUIRED'); assert.equal(h.records.length, 0);
});

test('old address substitution is rejected before any explorer request', async () => {
  const h = harness({ replies: [], proof: task => ({ ...task.creation, chainId: 1, address: lib, newTarget: true }) });
  assert.equal((await h.client.verify(fixture())).blocker, 'EXPLORER_CANONICAL_PROOF_REQUIRED');
  assert.equal(h.records.length, 0);
});

test('POST follows fsynced/read-back attempted marker and exact status/source checks', async () => {
  const h = harness({ replies: [response(unverified()), (_request, journal) => { assert.equal([...journal.values()][0].submissionAttempted, true); assert.equal([...journal.values()][0].state, 'submission-attempted'); return response({ status: '1', result: guid }); }, response({ status: '1', result: 'Pass - Verified' }), response(verified())] });
  const result = await h.client.verify(fixture());
  assert.equal(result.state, 'verified');
  const post = h.records.find(record => record.method === 'POST');
  assert.equal(post.fields.contractname, fixture().qualifiedName); assert.equal(post.fields.compilerversion, fixture().compilerVersion);
  assert.equal(post.fields.constructorArguments, fixture().constructorArguments);
  assert.equal(digest(post.fields.sourceCode), fixture().standardInputSha256);
  assert.equal(JSON.stringify([...h.journal.values()]).includes(secret), false);
});

test('Pass - Verified does not override a similar-source banner', async () => {
  const wrong = verified(); wrong.result[0].SimilarMatch = lib;
  const h = harness({ replies: [response(unverified()), response({ status: '1', result: guid }), response({ status: '1', result: 'Pass - Verified' }), response(wrong)] });
  assert.equal((await h.client.verify(fixture())).blocker, 'EXPLORER_SOURCE_MISMATCH');
});

test('ambiguous POST is never repeated, including a fresh verifier recovery', async () => {
  const h = harness({ replies: [response(unverified()), () => { throw new Error(`PRIVATE_RESPONSE_${secret}`); }, response(unverified()), response(unverified())] });
  const first = await h.client.verify(fixture());
  assert.equal(first.state, 'recovery-required'); assert.equal(JSON.stringify(first).includes(secret), false);
  assert.equal((await h.client.verify(fixture())).state, 'recovery-required');
  const restarted = createExplorerVerifier(h.options);
  assert.equal((await restarted.recover(fixture())).state, 'recovery-required');
  assert.equal(h.records.filter(record => record.method === 'POST').length, 1);
});

test('GET rate limits retry with bounded backoff, while POST rate limit never retries', async () => {
  const h = harness({ authorization: false, replies: [response({ status: '0', result: 'Max rate limit reached' }, 429, { 'retry-after': '60' }), response(unverified())] });
  assert.equal((await h.client.verify(fixture())).blocker, 'EXPLORER_SERVICE_AUTHORIZATION_REQUIRED');
  assert.equal(h.records.length, 2); assert.ok(h.sleeps.some(ms => ms === 10000));
  const p = harness({ replies: [response(unverified()), response({ status: '0', result: 'Max rate limit reached' }, 429)] });
  assert.equal((await p.client.verify(fixture())).explorerStatus, 'EXPLORER_SUBMISSION_UNCERTAIN');
  assert.equal(p.records.filter(record => record.method === 'POST').length, 1);
});

test('pending GUID polls are bounded and recovery performs only GET', async () => {
  const pending = () => response({ status: '0', result: 'Pending in queue' });
  const h = harness({ replies: [response(unverified()), response({ status: '1', result: guid }), pending(), pending(), response(unverified()), response({ status: '1', result: 'Pass - Verified' }), response(verified())] });
  assert.equal((await h.client.verify(fixture())).state, 'pending');
  const before = h.records.length;
  assert.equal((await h.client.recover(fixture())).state, 'verified');
  assert.ok(h.records.slice(before).every(record => record.method === 'GET'));
  assert.equal(h.records.filter(record => record.action === 'checkverifystatus').length, 3);
});

test('read-only recovery never initiates source submission', async () => {
  const h = harness({ replies: [response(unverified())] });
  assert.equal((await h.client.recover(fixture())).state, 'exported');
  assert.equal(h.records.length, 1); assert.equal(h.records[0].method, 'GET');
});

test('journal persistence failure prevents POST and leaves a truthful blocker', async () => {
  const h = harness({ replies: [response(unverified())], transitionHook: next => { if (next.submissionAttempted) throw new Error(`PRIVATE_IO_${secret}`); } });
  assert.equal((await h.client.verify(fixture())).blocker, 'EXPLORER_JOURNAL_UNAVAILABLE');
  assert.equal(h.records.some(record => record.method === 'POST'), false);
});

test('lost persisted-state readback prevents a source POST', async () => {
  const h = harness({ replies: [response(unverified())], readHook: (_taskId, journal) => { const state = [...journal.values()][0]; return state?.submissionAttempted ? null : copy(state ?? null); } });
  assert.equal((await h.client.verify(fixture())).blocker, 'EXPLORER_JOURNAL_UNAVAILABLE');
  assert.equal(h.records.some(record => record.method === 'POST'), false);
});

test('canonical source/receipt drift during a wait stops before submission', async () => {
  let proofCalls = 0;
  const h = harness({ replies: [response(unverified())], proof: task => ({ ...task.creation, chainId: 1, address: task.address, newTarget: ++proofCalls === 1 }) });
  assert.equal((await h.client.verify(fixture())).blocker, 'EXPLORER_CANONICAL_PROOF_REQUIRED');
  assert.equal(h.records.some(record => record.method === 'POST'), false);
});

test('a journal belonging to another task is rejected before network effects', async () => {
  const h = harness(); const task = fixture(), id = prepareVerificationTask(task).taskId;
  h.journal.set(id, { schema: 'manual-ledger-explorer-state-v1', taskId: '0'.repeat(64), state: 'pending', submissionAttempted: true, updatedAt: new Date().toISOString(), guid });
  await assert.rejects(h.client.verify(task), error => error.code === 'EXPLORER_JOURNAL_INVALID');
  assert.equal(h.records.length, 0);
});

test('timeouts are bounded and sanitized', async () => {
  const h = harness({ limits: { timeoutMs: 50, readAttempts: 2 }, replies: [() => new Promise(() => {}), () => new Promise(() => {})] });
  const result = await h.client.verify(fixture());
  assert.equal(result.blocker, 'EXPLORER_READ_UNAVAILABLE'); assert.equal(h.records.length, 2);
});

test('oversized service response is rejected before source submission', async () => {
  const h = harness({ replies: [response(verified(), 200, { 'content-length': String(30 * 1024 * 1024) })] });
  assert.equal((await h.client.verify(fixture())).blocker, 'EXPLORER_READ_UNAVAILABLE');
  assert.equal(h.records.length, 1);
});

test('unknown service failure details are fixed/redacted and never readiness evidence', async () => {
  const h = harness({ replies: [response(unverified()), response({ status: '1', result: guid }), response({ status: '0', result: `PRIVATE_ERROR_${secret}` })] });
  const result = await h.client.verify(fixture());
  assert.equal(result.blocker, 'EXPLORER_VERIFICATION_FAILED'); assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(result.activationReady, false);
});

test('concurrent requests in one verifier serialize and cannot duplicate a source POST', async () => {
  const h = harness({ replies: [response(unverified()), response({ status: '1', result: guid }), response({ status: '1', result: 'Pass - Verified' }), response(verified()), response(verified())] });
  const result = await Promise.all([h.client.verify(fixture()), h.client.verify(fixture())]);
  assert.ok(result.every(item => item.state === 'verified'));
  assert.equal(h.records.filter(record => record.method === 'POST').length, 1);
});

test('an HTML transient error is retried only as a bounded GET', async () => {
  const h = harness({ authorization: false, replies: [new Response('<html>temporary outage</html>', { status: 503 }), response(unverified())] });
  assert.equal((await h.client.verify(fixture())).blocker, 'EXPLORER_SERVICE_AUTHORIZATION_REQUIRED');
  assert.equal(h.records.length, 2); assert.ok(h.records.every(record => record.method === 'GET'));
});

test('malformed POST success is ambiguous and cannot be resubmitted', async () => {
  const h = harness({ replies: [response(unverified()), response({ status: '1', result: 'bad' }), response(unverified())] });
  assert.equal((await h.client.verify(fixture())).explorerStatus, 'EXPLORER_SUBMISSION_UNCERTAIN');
  assert.equal((await h.client.verify(fixture())).state, 'recovery-required');
  assert.equal(h.records.filter(record => record.method === 'POST').length, 1);
});

test('previously exact service evidence disappearing does not permit new submission', async () => {
  const h = harness({ replies: [response(verified()), response(unverified())] });
  assert.equal((await h.client.verify(fixture())).state, 'verified');
  assert.equal((await h.client.verify(fixture())).blocker, 'EXPLORER_VERIFIED_SOURCE_CHANGED');
  assert.ok(h.records.every(record => record.method === 'GET'));
});

test('redirected source response is rejected without a follow-up source POST', async () => {
  const redirected = response(verified()); Object.defineProperty(redirected, 'redirected', { value: true });
  const h = harness({ replies: [redirected] });
  assert.equal((await h.client.verify(fixture())).blocker, 'EXPLORER_READ_UNAVAILABLE');
  assert.equal(h.records.length, 1);
});
