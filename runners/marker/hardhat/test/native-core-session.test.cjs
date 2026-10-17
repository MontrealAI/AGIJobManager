'use strict';
// Lightweight harness unit tests ONLY. npm's test:preflight glob does not execute
// or satisfy the separate, expensive exact-checkout native qualification command.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { createNativeCoreRpc } = require('./helpers/native-core-rpc.cjs');
const root = path.resolve(__dirname, '../..');
const harness = () => import(pathToFileURL(path.join(root, 'scripts/qualification/core-session-native.mjs')).href);
const exporter = () => import(pathToFileURL(path.join(root, 'scripts/qualification/prepare-core-catalog.mjs')).href);
function temporary() { return fs.mkdtempSync(path.join(os.tmpdir(), 'native-core-unit-')); }
const BLOCK_HASH = '0x' + '11'.repeat(32);

test('native harness child environment drops inherited providers, keys, loaders and Git state', async () => {
  const { childEnvironment } = await harness();
  const env = childEnvironment({ NODE_EXTRA_CA_CERTS: '/private/fixture-ca.pem', MANAGER_READ_RPC_URL: 'https://127.0.0.1:1/', MANAGER_RELAY_RPC_URL: 'https://127.0.0.1:2/' });
  assert.deepEqual(Object.keys(env).sort(), ['PATH', 'HOME', 'LANG', 'TZ', 'NODE_EXTRA_CA_CERTS', 'MANAGER_READ_RPC_URL', 'MANAGER_RELAY_RPC_URL'].sort());
  for (const key of ['NODE_TLS_REJECT_UNAUTHORIZED', 'NODE_OPTIONS']) assert.throws(() => childEnvironment({ [key]: 'unsafe' }), /bypass/);
});
test('native harness launches a fresh actual Node child and captures exit/output', async () => {
  const dir = temporary(); try { const file = path.join(dir, 'child.mjs'); fs.writeFileSync(file, "console.log(process.pid); console.error('expected fixture failure'); process.exitCode = 7;\n"); const { nativeProcess } = await harness(); const r = await nativeProcess(file, [], { cwd: dir }); assert.equal(r.code, 7); assert.notEqual(Number(r.stdout.trim()), process.pid); assert.match(r.stderr, /expected fixture failure/); } finally { fs.rmSync(dir, { recursive: true }); }
});
test('native runner records timeout as failure rather than successful empty output', async () => {
  const dir = temporary(); try { const file = path.join(dir, 'child.mjs'); fs.writeFileSync(file, 'setTimeout(() => {}, 10000);\n'); const { nativeProcess } = await harness(); const r = await nativeProcess(file, [], { cwd: dir, timeoutMs: 50 }); assert.equal(r.timedOut, true); assert.equal(r.signal, 'SIGKILL'); assert.equal(r.code, null); } finally { fs.rmSync(dir, { recursive: true }); }
});
test('catalog exporter requires exact flags and fresh external nonsymlink paths', async () => {
  const { parseFlags, safeExternalPath } = await exporter();
  assert.deepEqual(parseFlags(['--one', 'a'], ['one']), { one: 'a' });
  for (const args of [[], ['--one'], ['--one', 'a', '--one', 'b'], ['--other', 'a']]) assert.throws(() => parseFlags(args, ['one']));
  const dir = temporary(); try { const actual = path.join(dir, 'actual'); fs.mkdirSync(actual); const alias = path.join(dir, 'alias'); fs.symlinkSync(actual, alias); assert.throws(() => safeExternalPath(path.join(alias, 'out'), [root]), /symlink/); assert.throws(() => safeExternalPath(path.join(root, 'bad'), [root]), /outside/); } finally { fs.rmSync(dir, { recursive: true }); }
});
test('catalog exporter retains occupied output instead of silently overwriting', async () => {
  const { writeNew } = await exporter(), dir = temporary(); try { const file = path.join(dir, 'evidence'); writeNew(file, 'before'); assert.throws(() => writeNew(file, 'after'), /EEXIST/); assert.equal(fs.readFileSync(file, 'utf8'), 'before'); assert.equal(fs.statSync(file).mode & 0o777, 0o600); } finally { fs.rmSync(dir, { recursive: true }); }
});
test('loopback fixture uses separate normally verified HTTPS endpoints and child-only CA', async () => {
  const dir = temporary(), calls = []; let bridge;
  try {
    bridge = await createNativeCoreRpc({ directory: path.join(dir, 'tls'), rpc: async (method, params) => { calls.push({ method, params }); if (method === 'eth_getBlockByHash' || method === 'eth_getBlockByNumber') return { hash: BLOCK_HASH, number: '0x1' }; return method === 'eth_chainId' ? '0x1' : '0x'; } });
    assert.notEqual(bridge.endpoints.read, bridge.endpoints.relay);
    assert.equal(fs.existsSync(path.join(dir, 'tls/ca.key')), false);
    const { nativeProcess, childEnvironment } = await harness(), file = path.join(dir, 'fetch.mjs');
    fs.writeFileSync(file, "const r=await fetch(process.argv[2],{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method:process.argv[3],params:JSON.parse(process.argv[4])})}); console.log(await r.text());\n");
    const untrusted = await nativeProcess(file, [bridge.endpoints.read, 'eth_chainId', '[]'], { cwd: dir }); assert.notEqual(untrusted.code, 0); assert.equal(bridge.snapshot().requests.length, 0);
    const env = childEnvironment({ NODE_EXTRA_CA_CERTS: bridge.caFile });
    const send = async (endpoint, method, params) => { const r = await nativeProcess(file, [endpoint, method, JSON.stringify(params)], { cwd: dir, env }); assert.equal(r.code, 0, r.stderr); return JSON.parse(r.stdout); };
    assert.equal((await send(bridge.endpoints.read, 'eth_chainId', [])).result, '0x1');
    assert((await send(bridge.endpoints.read, 'eth_sendRawTransaction', ['0x02'])).error);
    assert((await send(bridge.endpoints.relay, 'eth_getCode', ['0x', 'latest'])).error);
    await send(bridge.endpoints.read, 'eth_getBlockByNumber', ['finalized', false]);
    await send(bridge.endpoints.read, 'eth_getCode', ['0x2222222222222222222222222222222222222222', { blockHash: BLOCK_HASH, requireCanonical: true }]);
    assert(calls.some(x => x.method === 'eth_getCode' && x.params[1] === '0x1'));
    const snapshot = bridge.snapshot(); assert.equal(snapshot.counts.backendRawSubmissions, 0); assert.equal(snapshot.counts.forbidden, 2);
    assert(snapshot.adaptations.some(x => x.kind === 'LOCAL_FINALIZED_TO_LATEST')); assert(snapshot.adaptations.some(x => x.kind === 'LOCAL_CANONICAL_HASH_TO_NUMBER'));
    assert.equal(snapshot.tls.certificateVerificationEnabled, true); assert.equal(snapshot.publicProviderQualified, false);
    for (const record of snapshot.requests) assert.deepEqual(Object.keys(record).sort(), ['endpoint', 'id', 'method']);
  } finally { if (bridge) await bridge.close(); assert.equal(fs.existsSync(path.join(dir, 'tls/server.key')), false); fs.rmSync(dir, { recursive: true }); }
});
test('canonical-number adapter rejects noncanonical requested hash before EVM read', async () => {
  const dir = temporary(); let bridge, numberedReads = 0;
  try {
    bridge = await createNativeCoreRpc({ directory: path.join(dir, 'tls'), rpc: async method => { if (method === 'eth_getBlockByHash') return { number: '0x1', hash: BLOCK_HASH }; if (method === 'eth_getBlockByNumber') return { number: '0x1', hash: '0x' + '22'.repeat(32) }; numberedReads++; return '0x'; } });
    const { nativeProcess, childEnvironment } = await harness(), file = path.join(dir, 'fetch.mjs');
    fs.writeFileSync(file, `const r=await fetch(process.argv[2],{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getCode',params:['0x2222222222222222222222222222222222222222',{blockHash:'${BLOCK_HASH}',requireCanonical:true}]})});console.log(await r.text());`);
    const r = await nativeProcess(file, [bridge.endpoints.read], { cwd: dir, env: childEnvironment({ NODE_EXTRA_CA_CERTS: bridge.caFile }) }); assert.equal(r.code, 0); assert.match(r.stdout, /not canonical/); assert.equal(numberedReads, 0);
  } finally { if (bridge) await bridge.close(); fs.rmSync(dir, { recursive: true }); }
});
test('ordinary Node preflight is explicitly not the dedicated native acceptance gate', async () => {
  const { REPORT_SCHEMA, NODE_VERSION } = await harness(); assert.equal(REPORT_SCHEMA, 'manager-native-core-session-qualification-v1'); assert.equal(NODE_VERSION, 'v22.23.2');
  const text = fs.readFileSync(path.join(root, 'scripts/qualification/core-session-native.mjs'), 'utf8');
  assert(!text.includes('core-session-fixture.cjs')); assert(!text.includes('F.source'));
  assert(text.includes('observeSource(root, expectedCommit, expectedTree)'));
  assert(text.includes("sourceIncludesHarness: root === harnessRoot"));
});

test('catalog Git helper denies missing-object fetches despite inherited and local protocol overrides', async () => {
  const { cleanGit } = await exporter(), cp = require('node:child_process'), dir = temporary();
  const gitEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
  const git = (...args) => cp.execFileSync('git', args, { cwd: dir, env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const saved = Object.fromEntries(['GIT_NO_LAZY_FETCH', 'GIT_ALLOW_PROTOCOL'].map(k => [k, process.env[k]]));
  try {
    git('init', '--quiet'); fs.writeFileSync(path.join(dir, 'tracked.txt'), 'Disposable missing-object fixture only.\n'); git('add', 'tracked.txt');
    git('-c', 'user.name=Disposable Native Test', '-c', 'user.email=native-fixture@example.invalid', 'commit', '--quiet', '-m', 'Disposable native no-fetch fixture');
    const tree = git('rev-parse', 'HEAD^{tree}'), sentinel = path.join(dir, '.git/FETCH_ATTEMPTED'), upload = path.join(dir, '.git/local-upload-pack');
    fs.writeFileSync(upload, `#!/bin/sh\nprintf attempted > '${sentinel}'\nexit 1\n`, { mode: 0o700 });
    git('config', 'extensions.partialClone', 'origin'); git('config', 'remote.origin.promisor', 'true'); git('config', 'remote.origin.url', dir); git('config', 'remote.origin.uploadpack', upload); git('config', 'protocol.file.allow', 'always');
    fs.unlinkSync(path.join(dir, '.git/objects', tree.slice(0, 2), tree.slice(2)));
    process.env.GIT_NO_LAZY_FETCH = '0'; process.env.GIT_ALLOW_PROTOCOL = 'file';
    assert.throws(() => cleanGit(dir, 'cat-file', '-p', tree)); assert.equal(fs.existsSync(sentinel), false, 'Offline catalog helper invoked a fetch transport');
    // Local-only positive control: the unguarded fixture can invoke its mock
    // upload-pack. No socket, external repository, provider or credential exists.
    assert.throws(() => git('cat-file', '-p', tree)); assert.equal(fs.readFileSync(sentinel, 'utf8'), 'attempted');
  } finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } fs.rmSync(dir, { recursive: true }); }
});

test('native failure assertion accepts only the handled redacted boundary, never a crash or leaked detail', async () => {
  const { assertNativeFailure, NATIVE_FAILURE_MESSAGES } = await harness();
  for (const kind of ['core', 'export']) {
    const child = { code: 1, signal: null, timedOut: false, oversized: false, stdout: '', stderr: NATIVE_FAILURE_MESSAGES[kind] + '\n' };
    assert.doesNotThrow(() => assertNativeFailure(child, kind));
    for (const change of [{ code: 0 }, { code: 7 }, { code: null, signal: 'SIGKILL' }, { timedOut: true }, { oversized: true }, { stdout: 'success\n' }, { stderr: '' }, { stderr: child.stderr + 'PRIVATE_SENTINEL\n' }, { stderr: 'Error: detailed fixture failure\n' }]) assert.throws(() => assertNativeFailure({ ...child, ...change }, kind));
  }
});
test('actual native CLI argument failures are redacted while module validation retains precise reasons', async () => {
  const { nativeProcess, assertNativeFailure } = await harness(), CLI = require('../scripts/core-session.cjs'), X = require('../scripts/export-verification-package.cjs');
  const dir = temporary();
  try {
    assert.throws(() => CLI.flags(['--out']), /Arguments must be --name value pairs/);
    assert.throws(() => X.main(['--private-sentinel', 'DISPOSABLE_PRIVATE_SENTINEL']), /Use only --catalog/);
    const core = await nativeProcess(path.join(root, 'hardhat/scripts/core-session.cjs'), ['plan', '--out'], { cwd: root });
    const exported = await nativeProcess(path.join(root, 'hardhat/scripts/export-verification-package.cjs'), ['--private-sentinel', 'DISPOSABLE_PRIVATE_SENTINEL'], { cwd: root });
    assertNativeFailure(core, 'core'); assertNativeFailure(exported, 'export');
    assert.equal(core.stderr.includes('Arguments must'), false); assert.equal(exported.stderr.includes('DISPOSABLE_PRIVATE_SENTINEL'), false);
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally { fs.rmSync(dir, { recursive: true }); }
});
test('durable-state snapshots detect bytes, modes and dangling entries without following aliases', async () => {
  const { durableStateDigest } = await harness(), dir = temporary();
  try {
    const state = path.join(dir, 'session'); fs.mkdirSync(state); const signed = path.join(state, 'signed.json'); fs.writeFileSync(signed, 'DISPOSABLE_CAPABILITY');
    const before = durableStateDigest(state); assert.equal(before.length, 64); assert.equal(durableStateDigest(state), before);
    fs.appendFileSync(signed, 'changed'); assert.notEqual(durableStateDigest(state), before); fs.writeFileSync(signed, 'DISPOSABLE_CAPABILITY'); assert.equal(durableStateDigest(state), before);
    const mode = fs.statSync(signed).mode & 0o777; fs.chmodSync(signed, mode ^ 0o100); assert.notEqual(durableStateDigest(state), before); fs.chmodSync(signed, mode); assert.equal(durableStateDigest(state), before);
    fs.symlinkSync(path.join(dir, 'missing'), path.join(state, 'attempt')); assert.notEqual(durableStateDigest(state), before);
    const outside = path.join(dir, 'outside'); fs.writeFileSync(outside, 'before'); fs.symlinkSync(outside, path.join(state, 'alias')); const aliased = durableStateDigest(state); fs.writeFileSync(outside, 'after'); assert.equal(durableStateDigest(state), aliased);
    assert.equal(durableStateDigest(path.join(dir, 'absent')), durableStateDigest(path.join(dir, 'also-absent')));
  } finally { fs.rmSync(dir, { recursive: true }); }
});
