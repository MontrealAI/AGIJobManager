'use strict';
// This test suite is entirely offline, including transport-option/error tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
let externalAttempts = 0;
for (const [module, method] of [['node:https', 'request'], ['node:http', 'request'], ['node:net', 'connect'], ['node:tls', 'connect']]) require(module)[method] = () => { externalAttempts++; throw Error('EXTERNAL_TRANSPORT_FORBIDDEN'); };
const m = require('./observe-account-metadata.cjs');
const C = m.CONFIG, commit = '1'.repeat(40), hash = (v) => '0x' + v.repeat(64), clone = (v) => JSON.parse(JSON.stringify(v));
const F = { number: '0x100', hash: hash('a'), parentHash: hash('9'), timestamp: '0x1000', transactions: [] };
const L = { number: '0x102', hash: hash('b'), parentHash: hash('8'), timestamp: '0x1018', transactions: [hash('7')] };
const marker = '0xef0100' + C.accounts[2].address.slice(2).toLowerCase();
let ethers, passed = 0;
async function test(name, fn) { await fn(); passed++; process.stdout.write('PASS ' + name + '\n'); }
function replay(change) {
  const calls = [];
  const transport = async (raw, timeout, cap) => {
    const p = JSON.parse(raw); calls.push(p); assert(timeout > 0 && timeout <= 20000); assert(cap > 0 && cap <= 524288);
    let result;
    if (p.method === 'eth_chainId') result = '0x1';
    else if (p.method === 'eth_getBlockByNumber') result = clone(['finalized', F.number].includes(p.params[0]) ? F : L);
    else if (p.method === 'eth_getCode') result = p.params[0] === C.accounts[0].address ? marker : p.params[0] === C.accounts[1].address ? '0x' : '0x6000600055';
    else if (p.method === 'eth_getTransactionCount') result = p.params[1] === 'pending' ? '0x4' : p.params[1].blockHash === F.hash ? '0x2' : '0x3';
    else assert.fail('Forbidden method');
    const envelope = { jsonrpc: '2.0', id: p.id, result };
    if (change) { const changed = await change(envelope, p, calls.length); if (changed !== undefined) return changed; }
    return Buffer.from(JSON.stringify(envelope));
  };
  return { transport, calls };
}
async function run(change, options = {}) { const fixture = replay(change); const report = await m.observe({ transport: fixture.transport, ethers, collectorCommit: commit, ...options }); return { report, calls: fixture.calls }; }
async function stopped(change, count) { const { report, calls } = await run(change); assert.equal(report.status, 'STOPPED'); assert.equal(report.reason, 'OBSERVATION_STOPPED'); if (count) assert.equal(calls.length, count); const text = m.validateReport(report).toString(); assert(!text.includes('SUPER_SECRET')); return report; }
function responseFault(at, mutate) { return (e, p, i) => { if (i === at) return mutate(e, p); }; }
function copyDependencies(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const file of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(source, file), path.join(destination, file));
  // Copy the installed package closure, dereferencing input links. No network/install.
  const copied = new Set();
  function copyPackage(name, fromRoot) {
    const candidates = [path.join(fromRoot, 'node_modules', name), path.join(source, 'node_modules', name)];
    const input = candidates.find((p) => fs.existsSync(path.join(p, 'package.json')));
    assert(input, 'Installed dependency missing: ' + name);
    const real = fs.realpathSync(input), pkg = JSON.parse(fs.readFileSync(path.join(real, 'package.json')));
    const target = path.join(destination, 'node_modules', name);
    if (copied.has(name)) { assert.equal(JSON.parse(fs.readFileSync(path.join(target, 'package.json'))).version, pkg.version); return; }
    copied.add(name); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(real, target, { recursive: true, dereference: true });
    for (const dep of Object.keys(pkg.dependencies || {})) {
      if (fs.existsSync(path.join(target, 'node_modules', dep, 'package.json'))) continue;
      copyPackage(dep, real);
    }
  }
  copyPackage('ethers', source);
}
function fakeRequest({ status = 200, headers = {}, body = Buffer.from('{}'), event = 'end', throwRequest = false, hang = false } = {}) {
  const calls = [];
  const request = (options, callback) => {
    calls.push(options); if (throwRequest) throw Error('SUPER_SECRET');
    const req = new EventEmitter(); req.destroy = () => { req.destroyed = true; };
    req.end = (payload) => { req.payload = payload; if (hang) return;
      queueMicrotask(() => { const res = new EventEmitter(); res.statusCode = status; res.headers = { 'content-type': 'application/json', ...headers }; res.destroy = () => { res.destroyed = true; }; callback(res); if (res.destroyed) return; if (body.length) res.emit('data', body); if (!res.destroyed) res.emit(event, event === 'error' ? Error('SUPER_SECRET') : undefined); });
    }; return req;
  }; return { request, calls };
}
async function main() {
  assert.equal(process.versions.node, C.source.nodeVersion);
  assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--dependency-root');
  const source = process.argv[3], temp = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-offline-'));
  try {
    const a = path.join(temp, 'canonical-a'), b = path.join(temp, 'canonical-b');
    await test('canonical dependency relocation has no original scratch-path fallback', () => {
      copyDependencies(source, a); fs.renameSync(a, b); assert(!fs.existsSync(a)); ethers = m.loadEthers(b); assert.equal(ethers.version, '6.17.0');
      fs.symlinkSync(b, a, 'dir'); assert.throws(() => m.loadEthers(a)); fs.unlinkSync(a);
      const lock = path.join(b, 'package-lock.json'), original = fs.readFileSync(lock); fs.appendFileSync(lock, ' '); assert.throws(() => m.loadEthers(b)); fs.writeFileSync(lock, original);
      const pkg = path.join(b, 'node_modules/ethers/package.json'), bytes = fs.readFileSync(pkg); const bad = JSON.parse(bytes); bad.version = '6.17.1'; fs.writeFileSync(pkg, JSON.stringify(bad)); assert.throws(() => m.loadEthers(b)); fs.writeFileSync(pkg, bytes);
      assert.throws(() => m.loadEthers(path.join(temp, 'missing'))); assert.throws(() => m.loadEthers('relative'));
    });
    await test('source identity scrubs inherited Git overrides and never invokes a missing-object promisor', () => {
      const { execFileSync } = require('node:child_process');
      const repo = path.join(temp, 'git-source'), remote = path.join(temp, 'git-remote');
      fs.mkdirSync(repo); fs.mkdirSync(remote);
      const env = { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
      const git = (...args) => execFileSync('git', ['-C', repo, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      git('init'); git('config', 'user.name', 'Disposable Fixture'); git('config', 'user.email', 'fixture@example.invalid');
      fs.writeFileSync(path.join(repo, 'file'), 'fixture'); git('add', 'file'); git('commit', '-m', 'fixture');
      const expected = m.sourceIdentity(repo), overrides = { GIT_DIR: remote, GIT_WORK_TREE: remote, GIT_OBJECT_DIRECTORY: remote, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'protocol.allow', GIT_CONFIG_VALUE_0: 'always', GIT_NO_LAZY_FETCH: '0', GIT_ALLOW_PROTOCOL: 'file' };
      const old = Object.fromEntries(Object.keys(overrides).map((k) => [k, process.env[k]]));
      try { Object.assign(process.env, overrides); assert.deepEqual(m.sourceIdentity(repo), expected); }
      finally { for (const [k, v] of Object.entries(old)) if (v === undefined) delete process.env[k]; else process.env[k] = v; }
      const sentinel = path.join(temp, 'PROMISOR_INVOKED'), uploader = path.join(temp, 'sentinel-upload-pack');
      fs.writeFileSync(uploader, '#!/bin/sh\nprintf invoked > "' + sentinel + '"\nexit 1\n', { mode: 0o700 });
      git('config', 'remote.origin.url', remote); git('config', 'remote.origin.promisor', 'true'); git('config', 'remote.origin.uploadpack', uploader);
      const object = path.join(repo, '.git/objects', expected.commit.slice(0, 2), expected.commit.slice(2)); fs.unlinkSync(object);
      assert.throws(() => m.sourceIdentity(repo)); assert.equal(fs.existsSync(sentinel), false);
      // Positive fixture control: unguarded Git really attempts the local transport.
      assert.throws(() => git('rev-parse', 'HEAD^{tree}')); assert.equal(fs.readFileSync(sentinel, 'utf8'), 'invoked');
    });
    await test('strict config and secret/runtime override refusals', () => {
      assert.throws(() => m.loadConfig(Buffer.from(JSON.stringify({ ...C, endpoint: 'https://evil.invalid' }))));
      for (const key of ['PRIVATE_KEY', 'API_KEY', 'RPC_URL', 'GITHUB_TOKEN', 'NODE_OPTIONS', 'NODE_PATH', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'NODE_EXTRA_CA_CERTS', 'NODE_TLS_REJECT_UNAUTHORIZED', 'SSL_CERT_FILE', 'WALLET']) assert.throws(() => m.checkEnvironment({ [key]: 'SUPER_SECRET' }));
      m.checkEnvironment({ PATH: '/usr/bin', HOME: '/tmp', LANG: 'C.UTF-8' });
    });
    await test('full 28-call happy sequence preserves metadata-only pins and labels', async () => {
      const { report, calls } = await run(); assert.equal(report.status, 'OBSERVED_WITH_CANONICAL_PINS'); assert.equal(calls.length, 28); m.validateReport(report);
      assert.equal(report.accounts.length, 6); assert.equal(report.dependencies.length, 5); assert.equal(report.pending.length, 3);
      assert.equal(report.accounts[0].code.exactCode, marker); assert(report.dependencies.find((d) => d.role === 'AGIALPHA').scope.includes('not-constructor'));
      assert(report.dependencies.find((d) => d.role === 'helper-resolver').scope.includes('optional-helper'));
      assert(report.pending.every((p) => p.scope === 'unpinned-transient-not-atomic-no-reservation'));
      assert(report.source.commit !== report.collectorCommit); assert.equal(report.files.length, 4);
      for (const p of calls.filter((p) => ['eth_getCode', 'eth_getTransactionCount'].includes(p.method) && p.params[1] !== 'pending')) assert.equal(p.params[1].requireCanonical, true);
      assert(!JSON.stringify(report).includes('6000600055'));
    });
    await test('empty creator remains a permitted observation only', async () => { const { report } = await run((e, p) => { if (p.method === 'eth_getCode' && p.params[0] === C.accounts[0].address) e.result = '0x'; }); assert.equal(report.status, 'OBSERVED_WITH_CANONICAL_PINS'); m.validateReport(report); });
    await test('method/address/shape allowlist rejects before transport', async () => {
      let n = 0; const r = { requests: [], responseBytes: 0 }, client = m.createClient(async () => { n++; return Buffer.from('{}'); }, r); client.pins.push(F, L);
      for (const method of ['eth_getBalance', 'eth_call', 'eth_getStorageAt', 'debug_traceCall', 'trace_call', 'wallet_sendCalls', 'personal_unlockAccount', 'eth_sign', 'eth_signTransaction', 'eth_sendTransaction', 'eth_sendRawTransaction', 'eth_accounts']) await assert.rejects(client.rpc(method, []));
      for (const [method, params] of [['eth_chainId', ['0x1']], ['eth_getBlockByNumber', ['pending', false]], ['eth_getBlockByNumber', ['latest', true]], ['eth_getCode', [C.accounts[0].address, 'latest']], ['eth_getCode', [C.accounts[0].address, 'pending']], ['eth_getCode', ['0x' + '1'.repeat(40), { blockHash: F.hash, requireCanonical: true }]], ['eth_getCode', [C.accounts[0].address, { blockHash: F.hash, requireCanonical: false }]], ['eth_getCode', [C.accounts[0].address, { blockHash: hash('0'), requireCanonical: true }]], ['eth_getCode', [C.accounts[0].address, { blockHash: F.hash, requireCanonical: true, extra: 'x' }]], ['eth_getTransactionCount', [C.dependencies[0].address, 'pending']], ['eth_getCode', [C.dependencies[0].address, { blockHash: L.hash, requireCanonical: true }]]]) await assert.rejects(client.rpc(method, params));
      assert.equal(n, 0); assert.equal(r.requests.length, 0);
    });
    await test('wrong chain, malformed blocks, duplicate/truncated/invalid UTF8 JSON and IDs stop', async () => {
      for (const result of ['0x2', '0x01', 1, null]) await stopped(responseFault(1, (e) => { e.result = result; }), 1);
      for (const result of [null, { ...F, number: '0x00' }, { ...F, hash: '0x12' }, { ...F, transactions: [{}] }, { ...F, timestamp: '-1' }]) await stopped(responseFault(2, (e) => { e.result = result; }), 2);
      for (const raw of ['{"jsonrpc":"2.0","id":1,"id":1,"result":"0x1"}', '{"jsonrpc":"2.0","id":1,"result":"0x1"', '{"jsonrpc":"2.0","id":2,"result":"0x1"}', '{"jsonrpc":"2.0","id":1,"result":"0x1","error":"SUPER_SECRET"}', '{"jsonrpc":"2.0","id":1,"result":"0x1","extra":"SUPER_SECRET"}', '[]', '{"__proto__":{}}']) await stopped(responseFault(1, () => Buffer.from(raw)), 1);
      await stopped(responseFault(1, () => Buffer.from([0xff])), 1);
    });
    await test('changed marker, contract creator, nonempty governor and empty dependencies stop', async () => {
      for (const code of ['0xef0100' + '1'.repeat(40), '0x6000', '0x0', '0xGG', '0X']) await stopped(responseFault(4, (e) => { e.result = code; }), 4);
      await stopped(responseFault(6, (e) => { e.result = '0x6000'; }), 6);
      await stopped(responseFault(10, (e) => { e.result = '0x'; }), 10);
      for (const nonce of ['0x01', '-1', '0x', '0x' + 'f'.repeat(65), 1]) await stopped(responseFault(5, (e) => { e.result = nonce; }), 5);
      await stopped(responseFault(16, (e) => { e.result = '0x1'; }), 16);
      await stopped(responseFault(21, (e) => { e.result = '0x1'; }), 21);
    });
    await test('canonicality and ending chain/head contradictions fail without repinning', async () => {
      await stopped(responseFault(3, (e) => { e.result.hash = F.hash; }), 3);
      await stopped(responseFault(24, (e) => { e.result.hash = hash('c'); }), 24);
      await stopped(responseFault(25, (e) => { e.result.parentHash = hash('c'); }), 25);
      await stopped(responseFault(26, (e) => { e.result = '0x2'; }), 26);
      await stopped(responseFault(27, (e) => { e.result.hash = hash('c'); }), 28);
      await stopped(responseFault(28, (e) => { e.result.number = '0xff'; }), 28);
    });
    await test('provider failures are redacted, partial results preserved, and never retried', async () => {
      const report = await stopped(responseFault(18, () => { throw Error('SUPER_SECRET'); }), 18); assert(report.accounts.length >= 4); assert.equal(report.requests.at(-1).outcome, 'STOPPED');
      await stopped(responseFault(1, () => Buffer.alloc(C.limits.responseBytes + 1, 32)), 1);
    });
    await test('request, cumulative-byte, overall-time and sequential budgets', async () => {
      const r = { requests: [], responseBytes: 0 }; let count = 0;
      const c = m.createClient(async (raw) => { count++; const p = JSON.parse(raw); return Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: p.id, result: '0x1' })); }, r);
      for (let i = 0; i < 64; i++) await c.rpc('eth_chainId', []); await assert.rejects(c.rpc('eth_chainId', [])); assert.equal(count, 64);
      const r2 = { requests: [], responseBytes: 0 }; let byteCount = 0;
      const b = m.createClient(async (raw) => { byteCount++; const p = JSON.parse(raw); return Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: p.id, result: '0x1' }).padEnd(C.limits.responseBytes, ' ')); }, r2);
      for (let i = 0; i < 8; i++) await b.rpc('eth_chainId', []); await assert.rejects(b.rpc('eth_chainId', [])); assert.equal(byteCount, 8);
      let clock = 1000, contacts = 0; const d = m.createClient(async () => { contacts++; }, { requests: [], responseBytes: 0 }, () => clock); clock += C.limits.overallMs; await assert.rejects(d.rpc('eth_chainId', [])); assert.equal(contacts, 0);
      let release; const e = m.createClient(() => new Promise((resolve) => { release = resolve; }), { requests: [], responseBytes: 0 }); const first = e.rpc('eth_chainId', []); await assert.rejects(e.rpc('eth_chainId', [])); release(Buffer.from('{"jsonrpc":"2.0","id":1,"result":"0x1"}')); await first;
      let tick = 0; const { report } = await run(undefined, { now: () => 1000 + (++tick > 8 ? C.limits.overallMs : 0) }); assert.equal(report.status, 'STOPPED');
    });
    await test('fixed HTTPS options, default TLS, status/redirect/encoding/timeout/byte failures', async () => {
      const f = fakeRequest(); await m.makeHttpsTransport(f.request)('{}', 100, 1000); assert.equal(f.calls.length, 1);
      assert.deepEqual(Object.keys(f.calls[0]).sort(), ['agent', 'headers', 'hostname', 'method', 'path', 'port', 'protocol'].sort()); assert.equal(f.calls[0].hostname, 'eth-mainnet.g.alchemy.com'); assert.equal(f.calls[0].path, '/public'); assert.equal(f.calls[0].agent, false);
      for (const fault of [{ status: 302 }, { status: 500 }, { headers: { location: 'https://evil.invalid' } }, { headers: { 'content-type': 'text/html' } }, { headers: { 'content-encoding': 'gzip' } }, { headers: { 'content-length': '999999' } }, { headers: { 'content-length': '2' }, body: Buffer.from('{}x') }, { body: Buffer.alloc(1001) }, { event: 'error' }, { event: 'aborted' }, { throwRequest: true }, { hang: true }]) { const f = fakeRequest(fault); await assert.rejects(m.makeHttpsTransport(f.request)('{}', 5, 1000), { message: 'OBSERVATION_STOPPED' }); assert.equal(f.calls.length, 1); }
    });
    await test('report output exact allowlist, secret/code scope and exclusive reservation', async () => {
      const { report } = await run();
      for (const key of ['balance', 'privateKey', 'rawTransaction', 'signature', 'authorization', 'operationalAcceptance']) { const bad = clone(report); bad[key] = 'SUPER_SECRET'; assert.throws(() => m.validateReport(bad)); }
      for (const target of ['source', 'accounts', 'dependencies', 'requests']) { const bad = clone(report); const node = Array.isArray(bad[target]) ? bad[target][0] : bad[target]; node.rawCode = 'SUPER_SECRET'; assert.throws(() => m.validateReport(bad)); }
      const bad = clone(report); bad.accounts[0].code.exactCode = 'SUPER_SECRET'; assert.throws(() => m.validateReport(bad));
      const out = path.join(temp, 'receipt.json'), fd = m.reserveOutput(out); fs.writeFileSync(fd, m.validateReport(report)); fs.closeSync(fd); assert.throws(() => m.reserveOutput(out)); assert(fs.statSync(out).size < C.limits.reportBytes);
      const link = path.join(temp, 'alias.json'); fs.symlinkSync(out, link); assert.throws(() => m.reserveOutput(link)); assert.throws(() => m.reserveOutput('relative.json'));
    });
    await test('CLI preflight failures preserve a generic STOPPED receipt without contact', async () => {
      const lock = path.join(b, 'package-lock.json'), bytes = fs.readFileSync(lock); fs.appendFileSync(lock, ' ');
      const out = path.join(temp, 'stopped.json'), stderr = process.stderr.write; let errorText = '';
      try { process.stderr.write = (s) => { errorText += s; return true; }; await m.main(['--dependency-root', b, '--collector-commit', commit, '--output', out]); }
      finally { process.stderr.write = stderr; process.exitCode = 0; fs.writeFileSync(lock, bytes); }
      const report = JSON.parse(fs.readFileSync(out)); assert.equal(report.status, 'STOPPED'); assert.equal(report.requests.length, 0); assert.equal(errorText, 'OBSERVATION_STOPPED\n'); m.validateReport(report);
    });
    await test('workflow has exact opened-only same-repo branch gate and immutable source', () => {
      const y = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/account-metadata-observation.yml'), 'utf8');
      assert(y.includes('types: [opened]')); assert(y.includes('GIT_NO_LAZY_FETCH=1 GIT_ALLOW_PROTOCOL=')); assert(y.includes('protocol.allow=never')); assert(!y.includes('$(git -C')); assert(y.includes("github.event.pull_request.head.repo.full_name == 'MontrealAI/AGIJobManager'")); assert(y.includes("github.event.pull_request.head.ref == 'qualification/account-metadata-observation-20261016'")); assert(y.includes(C.source.commit)); assert(y.includes(C.source.tree)); assert(y.includes(C.source.lockSha256)); assert(!/pull_request_target|workflow_dispatch|synchronize|secrets\./.test(y));
    });
    assert.equal(externalAttempts, 0); process.stdout.write(JSON.stringify({ status: 'PASS', tests: passed, externalTransportAttempts: externalAttempts, plannedRequests: 28 }) + '\n');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
