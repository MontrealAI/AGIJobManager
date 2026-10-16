'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const { createRequire } = require('node:module');
const root = process.env.UBUNTU_TEST_MANAGER_ROOT;
assert(root, 'Set UBUNTU_TEST_MANAGER_ROOT to the exact disposable-test dependency checkout');
const E = createRequire(path.join(root, 'package.json'))('ethers');
const { GOVERNOR, environment, canonical, sha } = require('../safety.cjs'), { unsigned, review, sendOne } = require('../send.cjs'), { flags } = require('../terminal.cjs');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ubuntu-hardhat-unit-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const key = require('node:crypto').randomBytes(32), wallet = new E.Wallet(new E.SigningKey(key)), secret = key.toString('hex');
  const envelope = { type: 2, chainId: 1, from: wallet.address, nonce: 0, to: null, value: '0', data: '0x60006000f3', gasLimit: '100000', maxFeePerGas: '10000000000', maxPriorityFeePerGas: '1000000000', accessList: [] };
  let sends = 0, prompts = 0, failures = {}, drift = false, signed;
  const native = { binding: { project: 'manager', sourceCommit: '1'.repeat(40), sourceTree: '2'.repeat(40), creator: wallet.address, governor: GOVERNOR, session: path.join(dir, 'session'), planHash: '3'.repeat(64) }, plan: {}, assert() {}, fresh: async () => {}, current: async () => ({ index: 0, operation: 'Synthetic', envelope }), checkSigned(raw) { signed = raw; return E.Transaction.from(raw); } };
  const runtime = { E, assert() {}, rpc: async (m, a) => {
    if (Object.hasOwn(failures, m)) return failures[m];
    if (m === 'eth_chainId') return '0x1';
    if (m === 'eth_getBlockByNumber') return { hash: '0x' + '44'.repeat(32), number: '0x1', gasLimit: '0x1c9c380', baseFeePerGas: '0x1' };
    if (m === 'eth_getCode') return '0x';
    if (m === 'eth_getTransactionCount') return '0x0';
    if (m === 'eth_getBalance') return '0x10000000000000000';
    throw Error('Unexpected read');
  }, transmit: async raw => { sends++; return E.keccak256(raw); } };
  const expectedReview = review(native, { index: 0, operation: 'Synthetic', envelope }, E);
  const prompt = async () => { prompts++; return Buffer.from(key); };
  const run = extra => sendOne({ runtime, native, expectedReview, assertInputs: () => { if (drift) throw Error('DRIFT'); }, prompt, ...extra });
  t.after(() => key.fill(0));
  return { dir, key, secret, envelope, native, runtime, expectedReview, run, prompt, failures, setDrift() { drift = true; }, sends: () => sends, prompts: () => prompts, signed: () => signed };
}
test('exact locally signed transaction sends once; persistent files contain only public attempt identity', async t => {
  const f = fixture(t), result = await f.run(); assert.equal(f.sends(), 1); assert.equal(f.prompts(), 1); assert.equal(result.resendAllowed, false);
  const dir = f.native.binding.session + '.ubuntu-hardhat', files = fs.readdirSync(dir); assert.equal(files.length, 1);
  const bytes = fs.readFileSync(path.join(dir, files[0]), 'utf8'); assert(!bytes.includes(f.secret)); assert(!bytes.includes(f.signed()));
  assert.equal(JSON.parse(bytes).transactionHash, result.transactionHash); assert.equal(fs.statSync(path.join(dir, files[0])).mode & 0o777, 0o600);
  await assert.rejects(f.run(), /ALREADY_ATTEMPTED/); assert.equal(f.sends(), 1); assert.equal(f.prompts(), 1);
});
test('lost submission response remains one attempt across restart, with no fee or nonce replacement', async t => {
  const f = fixture(t); let calls = 0; f.runtime.transmit = async () => { calls++; throw Error('PRIVATE_PROVIDER_RESPONSE'); };
  await assert.rejects(f.run()); await assert.rejects(f.run(), /ALREADY_ATTEMPTED/); assert.equal(calls, 1);
});
for (const [name, mutate] of Object.entries({
  'wrong chain': f => { f.failures.eth_chainId = '0x2'; },
  'marker-bearing deployer': f => { f.failures.eth_getCode = '0xef0100' + '11'.repeat(20); },
  'nonce drift': f => { f.failures.eth_getTransactionCount = '0x1'; },
  'insufficient fee balance': f => { f.failures.eth_getBalance = '0x0'; },
  'gas ceiling drift': f => { f.failures.eth_getBlockByNumber = { hash: '0x' + '44'.repeat(32), number: '0x1', gasLimit: '0x1' }; },
  'fee ceiling drift': f => { f.failures.eth_getBlockByNumber = { hash: '0x' + '44'.repeat(32), number: '0x1', gasLimit: '0xffffff', baseFeePerGas: '0xffffffffff' }; },
  'expired native plan': f => { f.native.plan.expiresAt = new Date(0).toISOString(); },
  'public input drift': f => { f.setDrift(); },
  'review changed': f => { f.expectedReview.envelope = { ...f.envelope, nonce: 9 }; },
})) test(name + ' refuses before prompting or sending', async t => { const f = fixture(t); mutate(f); await assert.rejects(f.run()); assert.equal(f.sends(), 0); assert.equal(f.prompts(), 0); });
test('wrong chosen-deployer key is cleared and never submits', async t => {
  const f = fixture(t), wrong = require('node:crypto').randomBytes(32);
  await assert.rejects(f.run({ prompt: async () => wrong }), /KEY_MISMATCH/); assert(wrong.every(b => b === 0)); assert.equal(f.sends(), 0);
});
test('source drift while entering the key clears the buffer and never signs or submits', async t => {
  const f = fixture(t), key = Buffer.from(f.key);
  await assert.rejects(f.run({ prompt: async () => { f.setDrift(); return key; } })); assert(key.every(b => b === 0)); assert.equal(f.sends(), 0); assert.equal(f.signed(), undefined);
});
test('native signature mismatch refuses before the first submission', async t => { const f = fixture(t); f.native.checkSigned = () => ({ hash: E.ZeroHash }); await assert.rejects(f.run(), /SIGNED_TRANSACTION_MISMATCH/); assert.equal(f.sends(), 0); });
test('existing process gate cannot be broken automatically', async t => { const f = fixture(t), dir = f.native.binding.session + '.ubuntu-hardhat'; fs.mkdirSync(dir, { mode: 0o700 }); fs.mkdirSync(path.join(dir, 'active-send')); await assert.rejects(f.run()); assert.equal(f.prompts(), 0); });
test('authorization lists, governor keys and altered transaction fields are rejected', t => {
  const f = fixture(t);
  for (const change of [{ authorizationList: [] }, { type: 4 }, { chainId: 2 }, { from: GOVERNOR }, { value: '1' }, { accessList: [{ address: f.envelope.from, storageKeys: [] }] }, { nonce: -1 }]) assert.throws(() => unsigned(E, { ...f.envelope, ...change }, f.native.binding.creator));
});
test('key/seed/loaders/debug configuration and unknown CLI options are rejected', () => {
  for (const name of ['PRIVATE_KEY', 'MAINNET_PRIVATE_KEY', 'MNEMONIC', 'NODE_OPTIONS', 'NODE_PATH', 'DEBUG', 'HARDHAT_CONFIG', 'NODE_V8_COVERAGE']) assert.throws(() => environment({ [name]: 'synthetic-forbidden' }));
  for (const args of [['send', '--key', 'forbidden'], ['send', '--config', 'a', '--config', 'b'], ['deploy'], ['review']]) assert.throws(() => flags(args));
});
test('real Linux terminal hides paste, restores echo on success/backspace/abort/malformed input, rejects redirected input', async () => {
  const helper = path.join(__dirname, 'pty-runner.py'), child = path.join(__dirname, 'prompt-child.cjs');
  for (const [entry, code] of [['ab'.repeat(32) + '\r', 0], ['0x' + 'cd'.repeat(32) + '\r', 0], ['aa' + '\u007f\u007f' + 'ef'.repeat(32) + '\r', 0], ['ab'.repeat(12) + '\u0003', 1], ['z\r', 1], ['ab'.repeat(33) + '\r', 1], ['ab'.repeat(32) + '\rhidden-extra', 1]]) {
    const result = cp.spawnSync('python3', [helper, process.execPath, child], { input: JSON.stringify({ entry, secrets: [entry.slice(0, 20)].filter(s => s.length >= 20) }), encoding: 'utf8', timeout: 50000 });
    assert.equal(result.status, 0, result.stderr); const report = JSON.parse(result.stdout); assert.equal(report.code, code, report.output); assert(report.echoRestored && report.secretAbsent && report.promptObserved);
  }
  const redirected = cp.spawnSync(process.execPath, [child], { input: 'ab'.repeat(32) + '\n', encoding: 'utf8' }); assert.equal(redirected.status, 1); assert(!redirected.stdout.includes('ab'.repeat(32)));
});
test('production CLI failures never render malformed arguments, private config values or exception detail', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ubuntu-hardhat-redaction-')); t.after(() => fs.rmSync(dir, { recursive: true }));
  const sentinel = 'DISPOSABLE_PRIVATE_FIELD_SENTINEL', file = path.join(dir, 'bad-config.json'), bytes = JSON.stringify({ project: sentinel }); fs.writeFileSync(file, bytes, { mode: 0o600 });
  const env = { ...process.env }; for (const key of ['NODE_PATH', 'NODE_OPTIONS', 'DEBUG']) delete env[key];
  for (const args of [['send', '--key', sentinel], ['review', '--config', file, '--config-sha', sha(Buffer.from(bytes)), '--out', path.join(dir, 'unused')]]) {
    const result = cp.spawnSync(process.execPath, [path.resolve(__dirname, '../terminal.cjs'), ...args], { env, encoding: 'utf8' });
    assert.equal(result.status, 1); assert(!result.stdout.includes(sentinel) && !result.stderr.includes(sentinel)); assert.match(result.stderr, /UBUNTU_HARDHAT_STOPPED/); assert(!/(?:^|\n)\s+at /.test(result.stderr));
  }
});
