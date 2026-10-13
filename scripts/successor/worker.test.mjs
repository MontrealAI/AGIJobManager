import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { request } from 'node:http';
import { startWorker, createClient, sign, loadJournal } from './worker.mjs';
import { canonical } from '../../site/assets/successor/safe.mjs';

function fixtureDriver() {
  let value = '', output = '', failing = false;
  return { identity: { name: 'protocol-test-double', browser: 'not-a-browser' }, setFail: () => failing = true, observe: async () => { if (failing) throw Error('refresh failed'); return { png: 'ZmFrZQ==', state: { value, output } }; }, act: async (action, text) => { if (action === 'type') value = text; else output = value; }, stop: async () => {} };
}
async function environment(fn, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'successor-boundary-')), journalPath = path.join(directory, 'attempts.jsonl'), secret = randomBytes(32).toString('hex'), driver = fixtureDriver(); let worker;
  try { worker = await startWorker({ pairingSecret: secret, journalPath, driver, ...options }); await fn({ worker, secret, driver, journalPath }); }
  finally { await worker?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}
test('paired capabilities, actual output boundary, stale observations and revocation', () => environment(async ({ worker, secret }) => {
  const client = await createClient(worker.url, secret), capabilities = await client.call('/capabilities'); assert.equal(capabilities.provider, 'fixture'); assert.equal(capabilities.permissions.signer, false);
  const observation = await client.call('/observe'); await client.call('/act', { frame: observation.frame, action: 'type', value: 'public result' });
  await assert.rejects(client.call('/act', { frame: observation.frame, action: 'click', value: '' }), { code: 'STALE_OBSERVATION' });
  const fresh = await client.call('/observe'); await client.call('/act', { frame: fresh.frame, action: 'click', value: '' }); const result = await client.call('/observe'); assert.equal(result.state.output, 'public result');
  await client.call('/stop'); await assert.rejects(client.call('/observe'), { code: 'WORKER_REVOKED' });
}));
test('cross-origin, DNS rebinding, unauthenticated and forged requests are denied', () => environment(async ({ worker, secret }) => {
  for (const headers of [{ origin: 'https://malicious.test' }, { host: 'attacker.test' }, { 'sec-fetch-site': 'cross-site' }]) {
    const status = await new Promise((resolve, reject) => { const req = request(worker.url + '/pair', { method: 'POST', headers: { 'content-type': 'application/json', 'x-pair-secret': secret, ...headers } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end(canonical({ nonce: 'a'.repeat(64) })); }); assert.equal(status, 403);
  }
  await assert.rejects(createClient(worker.url, 'b'.repeat(64)), { code: 'PAIRING_RESPONSE' });
  await assert.rejects(createClient('http://localhost:1234', secret), { code: 'WORKER_ENDPOINT' });
  await assert.rejects(createClient('https://169.254.169.254', secret), { code: 'WORKER_ENDPOINT' });
}));
test('captured authenticated requests and pairing nonces cannot be replayed, including after restart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'successor-replay-')), journalPath = path.join(dir, 'journal'), secret = 'c'.repeat(64), nonce = 'd'.repeat(64); let worker;
  try {
    worker = await startWorker({ pairingSecret: secret, journalPath, driver: fixtureDriver() });
    const pairBody = canonical({ nonce }), pair = () => fetch(worker.url + '/pair', { method: 'POST', headers: { 'content-type': 'application/json', 'x-pair-secret': secret }, body: pairBody });
    const response = await pair(), data = await response.json(), key = sign(secret, { client: nonce, server: data.nonce, session: data.session });
    const headers = { 'content-type': 'application/json', 'x-session': data.session, 'x-counter': '1', 'x-request-mac': sign(key, { counter: 1, method: 'POST', route: '/observe', body: '{}' }) };
    assert.equal((await fetch(worker.url + '/observe', { method: 'POST', headers, body: '{}' })).status, 200);
    assert.equal((await fetch(worker.url + '/observe', { method: 'POST', headers, body: '{}' })).status, 403);
    await worker.close(); worker = await startWorker({ pairingSecret: secret, journalPath, driver: fixtureDriver() }); assert.equal((await pair()).status, 403);
    const client = await createClient(worker.url, secret); assert.equal((await client.call('/capabilities')).budgets.used, 1);
  } finally { await worker?.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
test('failed refresh clears old frame and consumes durable budget before action', () => environment(async ({ worker, secret, driver, journalPath }) => {
  const client = await createClient(worker.url, secret), observed = await client.call('/observe'); driver.setFail(); await assert.rejects(client.call('/observe'));
  await assert.rejects(client.call('/act', { frame: observed.frame, action: 'click', value: '' }), { code: 'STALE_OBSERVATION' });
  assert.equal(loadJournal(journalPath).filter(e => e.action.startsWith('attempt:')).length, 2);
}));
test('call, elapsed-time, action, secret and uncertain transport boundaries', () => environment(async ({ worker, secret }) => {
  const client = await createClient(worker.url, secret), observed = await client.call('/observe');
  await assert.rejects(client.call('/act', { frame: observed.frame, action: 'navigate', value: 'https://evil.test' }), { code: 'ACTION_DENIED' });
  await assert.rejects(client.call('/observe'), { code: 'WORKER_BUDGET' });
}, { maxCalls: 1 }));
test('expired frames and session expiry deny dispatch', async () => {
  let clock = 1800000000000;
  await environment(async ({ worker, secret }) => {
    const client = await createClient(worker.url, secret), observed = await client.call('/observe'); clock += 6000;
    await assert.rejects(client.call('/act', { frame: observed.frame, action: 'type', value: 'x' }), { code: 'STALE_OBSERVATION' });
    clock += 120000; await assert.rejects(client.call('/observe'));
  }, { now: () => clock });
});
test('unsafe journals and torn attempts fail closed', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'successor-journal-')), file = path.join(dir, 'log');
  try { fs.writeFileSync(file, '{}', { mode: 0o600 }); assert.throws(() => loadJournal(file), { code: 'JOURNAL_TORN' }); fs.writeFileSync(file, '{}\n'); assert.throws(() => loadJournal(file)); fs.chmodSync(file, 0o644); assert.throws(() => loadJournal(file), { code: 'PRIVATE_FILE' }); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
