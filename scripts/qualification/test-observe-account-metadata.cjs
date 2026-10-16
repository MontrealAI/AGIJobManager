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
const F = { ...C.priorObservation.finalized, transactions: [] };
// Exact ENS runtime retained by canonical 19:50 receipt SHA-256
// 5be20406e1f41b6f44a9a926aafc024b65a199c9309489694f512e06033ac15a.
const fixtureCodes = ["0x608060405234801561001057600080fd5b50600436106100cf5760003560e01c80635b0fc9c31161008c578063b83f866311610066578063b83f86631461042c578063cf40882314610476578063e985e9c5146104f8578063f79fe53814610574576100cf565b80635b0fc9c3146103025780635ef2c7f014610350578063a22cb465146103dc576100cf565b80630178b8bf146100d457806302571be31461014257806306ab5923146101b057806314ab90381461021c57806316a25cbd1461025e5780631896f70a146102b4575b600080fd5b610100600480360360208110156100ea57600080fd5b81019080803590602001909291905050506105ba565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b61016e6004803603602081101561015857600080fd5b810190808035906020019092919050505061068f565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b610206600480360360608110156101c657600080fd5b810190808035906020019092919080359060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610764565b6040518082815260200191505060405180910390f35b61025c6004803603604081101561023257600080fd5b8101908080359060200190929190803567ffffffffffffffff169060200190929190505050610919565b005b61028a6004803603602081101561027457600080fd5b8101908080359060200190929190505050610aab565b604051808267ffffffffffffffff1667ffffffffffffffff16815260200191505060405180910390f35b610300600480360360408110156102ca57600080fd5b8101908080359060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610b80565b005b61034e6004803603604081101561031857600080fd5b8101908080359060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610d42565b005b6103da600480360360a081101561036657600080fd5b810190808035906020019092919080359060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803567ffffffffffffffff169060200190929190505050610eba565b005b61042a600480360360408110156103f257600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803515159060200190929190505050610edc565b005b610434610fdd565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b6104f66004803603608081101561048c57600080fd5b8101908080359060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803567ffffffffffffffff169060200190929190505050611003565b005b61055a6004803603604081101561050e57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff16906020019092919050505061101e565b604051808215151515815260200191505060405180910390f35b6105a06004803603602081101561058a57600080fd5b81019080803590602001909291905050506110b2565b604051808215151515815260200191505060405180910390f35b60006105c5826110b2565b61067e57600260009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16630178b8bf836040518263ffffffff1660e01b81526004018082815260200191505060206040518083038186803b15801561063c57600080fd5b505afa158015610650573d6000803e3d6000fd5b505050506040513d602081101561066657600080fd5b8101908080519060200190929190505050905061068a565b61068782611120565b90505b919050565b600061069a826110b2565b61075357600260009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166302571be3836040518263ffffffff1660e01b81526004018082815260200191505060206040518083038186803b15801561071157600080fd5b505afa158015610725573d6000803e3d6000fd5b505050506040513d602081101561073b57600080fd5b8101908080519060200190929190505050905061075f565b61075c8261115f565b90505b919050565b600083600080600083815260200190815260200160002060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690503373ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614806108615750600160008273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff165b61086a57600080fd5b6000868660405160200180838152602001828152602001925050506040516020818303038152906040528051906020012090506108a781866111e2565b85877fce0457fe73731f824cc272376169235128c118b49d344817417c6d108d155e8287604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390a38093505050509392505050565b81600080600083815260200190815260200160002060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690503373ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff161480610a145750600160008273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff165b610a1d57600080fd5b837f1d4f9bbfc9cab89d66e1a1562f2233ccbf1308cb4f63de2ead5787adddb8fa6884604051808267ffffffffffffffff1667ffffffffffffffff16815260200191505060405180910390a28260008086815260200190815260200160002060010160146101000a81548167ffffffffffffffff021916908367ffffffffffffffff16021790555050505050565b6000610ab6826110b2565b610b6f57600260009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166316a25cbd836040518263ffffffff1660e01b81526004018082815260200191505060206040518083038186803b158015610b2d57600080fd5b505afa158015610b41573d6000803e3d6000fd5b505050506040513d6020811015610b5757600080fd5b81019080805190602001909291905050509050610b7b565b610b788261122f565b90505b919050565b81600080600083815260200190815260200160002060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690503373ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff161480610c7b5750600160008273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff165b610c8457600080fd5b837f335721b01866dc23fbee8b6b2c7b1e14d6f05c28cd35a2c934239f94095602a084604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390a28260008086815260200190815260200160002060010160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050505050565b81600080600083815260200190815260200160002060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690503373ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff161480610e3d5750600160008273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff165b610e4657600080fd5b610e5084846111e2565b837fd4735d920b0f87494915f556dd9b54c8f309026070caea5c737245152564d26684604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390a250505050565b6000610ec7868686610764565b9050610ed4818484611262565b505050505050565b80600160003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548160ff0219169083151502179055508173ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c3183604051808215151515815260200191505060405180910390a35050565b600260009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b61100d8484610d42565b611018848383611262565b50505050565b6000600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16905092915050565b60008073ffffffffffffffffffffffffffffffffffffffff1660008084815260200190815260200160002060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614159050919050565b600080600083815260200190815260200160002060010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050919050565b60008060008084815260200190815260200160002060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690503073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156111d85760009150506111dd565b809150505b919050565b6000819050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff161415611220573090505b61122a8382611455565b505050565b600080600083815260200190815260200160002060010160149054906101000a900467ffffffffffffffff169050919050565b60008084815260200190815260200160002060010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614611383578160008085815260200190815260200160002060010160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550827f335721b01866dc23fbee8b6b2c7b1e14d6f05c28cd35a2c934239f94095602a083604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390a25b60008084815260200190815260200160002060010160149054906101000a900467ffffffffffffffff1667ffffffffffffffff168167ffffffffffffffff1614611450578060008085815260200190815260200160002060010160146101000a81548167ffffffffffffffff021916908367ffffffffffffffff160217905550827f1d4f9bbfc9cab89d66e1a1562f2233ccbf1308cb4f63de2ead5787adddb8fa6882604051808267ffffffffffffffff1667ffffffffffffffff16815260200191505060405180910390a25b505050565b8060008084815260200190815260200160002060000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550505056fea265627a7a72315820e307c1741e952c90d504ae303fa3fa1e5f6265200c65304d90abaa909d2dee4b64736f6c63430005100032"];
// Synthetic state words are test inputs, not observations of these role roots.
const fixtureWords = ['0x' + 'ab'.repeat(12) + '12'.repeat(20), '0x' + '00'.repeat(12) + '34'.repeat(20)];
let ethers, realEthers, passed = 0;
const pendingGroups = [];
async function test(name, fn) { await fn(); passed++; process.stdout.write('PASS ' + name + '\n'); }
function replay(change) {
  const calls = [];
  const transport = async (raw, timeout, cap) => {
    const p = JSON.parse(raw); calls.push(p); assert(timeout > 0 && timeout <= 20000); assert(cap > 0 && cap <= 524288);
    let result;
    if (p.method === 'eth_chainId') result = '0x1';
    else if (p.method === 'eth_getBlockByNumber') result = clone(F);
    else if (p.method === 'eth_getCode') result = fixtureCodes[C.dependencies.findIndex((d) => d.address === p.params[0])];
    else if (p.method === 'eth_getStorageAt') result = fixtureWords[C.ownerSlots.findIndex((s) => s.key === p.params[1])];
    else assert.fail('Forbidden method');
    const envelope = { jsonrpc: '2.0', id: p.id, result };
    if (change) { const changed = await change(envelope, p, calls.length); if (changed !== undefined) return changed; }
    return Buffer.from(JSON.stringify(envelope));
  };
  return { transport, calls };
}
async function run(change, options = {}) { const fixture = replay(change); const report = await m.observe({ transport: fixture.transport, ethers, collectorCommit: commit, ...options }); return { report, calls: fixture.calls }; }
async function stopped(change, count) { const { report, calls } = await run(change); assert.equal(report.status, 'STOPPED'); assert.equal(report.reason, 'OBSERVATION_STOPPED'); if (count) assert.equal(calls.length, count); const text = m.validateReport(report, ethers).toString(); assert(!text.includes('SUPER_SECRET')); return report; }
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
  const localNoRelocation = process.argv.length === 5 && process.argv[4] === '--local-no-relocation';
  assert(process.argv.length === 4 || localNoRelocation); assert.equal(process.argv[2], '--dependency-root');
  const source = process.argv[3], temp = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-offline-'));
  try {
    const a = path.join(temp, 'canonical-a'), b = path.join(temp, 'canonical-b');
    if (!localNoRelocation) await test('canonical dependency relocation has no original scratch-path fallback', () => {
      copyDependencies(source, a); fs.renameSync(a, b); assert(!fs.existsSync(a)); realEthers = m.loadEthers(b); assert.equal(realEthers.version, '6.17.0');
      fs.symlinkSync(b, a, 'dir'); assert.throws(() => m.loadEthers(a)); fs.unlinkSync(a);
      const lock = path.join(b, 'package-lock.json'), original = fs.readFileSync(lock); fs.appendFileSync(lock, ' '); assert.throws(() => m.loadEthers(b)); fs.writeFileSync(lock, original);
      const pkg = path.join(b, 'node_modules/ethers/package.json'), bytes = fs.readFileSync(pkg); const bad = JSON.parse(bytes); bad.version = '6.17.1'; fs.writeFileSync(pkg, JSON.stringify(bad)); assert.throws(() => m.loadEthers(b)); fs.writeFileSync(pkg, bytes);
      assert.throws(() => m.loadEthers(path.join(temp, 'missing'))); assert.throws(() => m.loadEthers('relative'));
    });
    else {
      // Explicit local resource limit only. The hosted command omits this option.
      pendingGroups.push('canonical dependency relocation');
      fs.mkdirSync(b); fs.copyFileSync(path.join(source, 'package-lock.json'), path.join(b, 'package-lock.json'));
      realEthers = require(require('node:module').createRequire(path.join(source, 'package.json')).resolve('ethers'));
      assert.equal(realEthers.version, '6.17.0');
    }
    // Use the real locked ethers with the independently retained runtime preimage.
    ethers = realEthers;
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
    await test('full fixed seven-call sequence retains exact runtime, words and low160 owners', async () => {
      const { report, calls } = await run(); assert.equal(report.status, 'OBSERVED_WITH_CANONICAL_PIN'); assert.equal(calls.length, 7);
      const retained = JSON.parse(m.validateReport(report, ethers));
      assert.equal(retained.dependencies.length, 1); assert.equal(retained.files.length, 4);
      assert.deepEqual(retained.dependencies.map((d) => d.code.runtime), fixtureCodes);
      assert.deepEqual(retained.owners.map((o) => o.word), fixtureWords);
      assert.deepEqual(retained.owners.map((o) => o.owner), ['0x' + '12'.repeat(20), '0x' + '34'.repeat(20)]);
      assert.deepEqual(retained.owners.map((o) => o.key), C.ownerSlots.map((s) => s.key));
      for (const [i, o] of retained.owners.entries()) {
        assert.equal(Buffer.from(o.word.slice(2), 'hex').length, 32);
        assert.equal('0x' + Buffer.from(o.word.slice(2), 'hex').subarray(12).toString('hex'), o.owner);
        assert.equal(BigInt(o.word) & ((1n << 160n) - 1n), BigInt(o.owner));
        assert.equal(o.node, realEthers.namehash(C.ownerSlots[i].name));
        assert.equal(o.key, realEthers.keccak256(realEthers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'uint256'], [o.node, 0])));
      }
      assert.deepEqual(report.priorObservation, C.priorObservation); assert.equal(report.historicalNoFallback, true);
      assert(Object.values(report.approval).every((v) => v === false)); assert(report.scope.includes('Historical conditional'));
      assert.deepEqual(calls.map((p) => [p.method, p.params]), m.requestPlan());
      assert.equal(calls.filter((p) => p.method === 'eth_getCode').length, 1);
      assert.equal(calls.filter((p) => p.method === 'eth_getStorageAt').length, 2);
      for (const p of calls.filter((p) => ['eth_getCode', 'eth_getStorageAt'].includes(p.method))) assert.deepEqual(p.params.at(-1), { blockHash: F.hash, requireCanonical: true });
      assert(!Object.hasOwn(report, 'accounts') && !Object.hasOwn(report, 'pending'));
      assert.equal(C.mode, 'fixed-ens-two-word-20261016');
      assert.equal(F.hash, '0x59f68739717ff05434d8b3ad2555549c0216178541f19ce944ba296163f97f6d');
      assert.equal(F.number, '0x18fe3f8'); assert.equal(C.dependencies[0].address, '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e');
      assert.deepEqual(C.ownerSlots.map((s) => s.key), ['0xc78e2b314987901db0f7d20ba0c8bb5d7b0577c356a2fe6ee0af68531003e4d5', '0x78a277a1ca05a7d99d6d7a7bcd3e40f9380d8278bc57f4d3fdc26c8f49bb2ea1']);
      assert.equal(realEthers.keccak256(fixtureCodes[0]), C.dependencies[0].expectedKeccak256);
      assert.equal((fixtureCodes[0].length - 2) / 2, C.dependencies[0].expectedBytes);
    });
    await test('method/address/key/block allowlist rejects all overrides before transport', async () => {
      let n = 0; const r = { requests: [], responseBytes: 0 }, client = m.createClient(async () => { n++; return Buffer.from('{}'); }, r); client.pins.push(C.priorObservation.finalized);
      for (const method of ['eth_getBalance', 'eth_getTransactionCount', 'eth_call', 'eth_getProof', 'debug_traceCall', 'trace_call', 'wallet_sendCalls', 'personal_unlockAccount', 'eth_sign', 'eth_signTransaction', 'eth_sendTransaction', 'eth_sendRawTransaction', 'eth_accounts']) await assert.rejects(client.rpc(method, []));
      const ref = { blockHash: F.hash, requireCanonical: true }, address = C.dependencies[0].address, key = C.ownerSlots[0].key;
      const invalid = [['eth_chainId', ['0x1']], ...['pending', 'latest', 'finalized', 'earliest', '0x1', hash('1')].map((b) => ['eth_getBlockByNumber', [b, false]]), ['eth_getBlockByNumber', [F.number, true]]];
      for (const method of ['eth_getCode', 'eth_getStorageAt']) {
        const params = method === 'eth_getCode' ? [address, ref] : [address, key, ref];
        for (const other of ['0x' + '1'.repeat(40), address.toLowerCase(), '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401']) invalid.push([method, [other, ...params.slice(1)]]);
        for (const badRef of ['latest', 'pending', 'finalized', F.number, { blockHash: F.hash, requireCanonical: false }, { blockHash: hash('0'), requireCanonical: true }, { blockHash: F.hash, requireCanonical: true, extra: 'x' }, { blockNumber: F.number, requireCanonical: true }]) invalid.push([method, [...params.slice(0, -1), badRef]]);
        invalid.push([method, [...params, 'extra']]); invalid.push([method, params.slice(0, -1)]);
      }
      for (const other of ['0x0', '0x2', hash('0'), key.toUpperCase(), C.ownerSlots[0].node, C.ownerSlots[1].node, hash('1')]) invalid.push(['eth_getStorageAt', [address, other, ref]]);
      for (const [method, params] of invalid) await assert.rejects(client.rpc(method, params));
      assert.equal(n, 0); assert.equal(r.requests.length, 0);
      for (const badPin of [null, {}, { ...C.priorObservation.finalized, hash: hash('c') }, { ...C.priorObservation.finalized, number: '0x1' }]) assert.throws(() => m.assertRequest('eth_getStorageAt', [address, key, ref], [badPin]));
    });
    await test('wrong chain, malformed blocks, duplicate/truncated/invalid UTF8 JSON and IDs stop', async () => {
      for (const result of ['0x2', '0x01', 1, null]) await stopped(responseFault(1, (e) => { e.result = result; }), 1);
      for (const result of [null, { ...F, number: '0x00' }, { ...F, hash: '0x12' }, { ...F, transactions: [{}] }, { ...F, timestamp: '-1' }]) await stopped(responseFault(2, (e) => { e.result = result; }), 2);
      for (const raw of ['{"jsonrpc":"2.0","id":1,"id":1,"result":"0x1"}', '{"jsonrpc":"2.0","id":1,"result":"0x1"', '{"jsonrpc":"2.0","id":2,"result":"0x1"}', '{"jsonrpc":"2.0","id":1,"result":"0x1","error":"SUPER_SECRET"}', '{"jsonrpc":"2.0","id":1,"result":"0x1","extra":"SUPER_SECRET"}', '[]', '{"__proto__":{}}']) await stopped(responseFault(1, () => Buffer.from(raw)), 1);
      await stopped(responseFault(1, () => Buffer.from([0xff])), 1);
    });
    await test('wrong ENS size/hash, empty or delegation-marker code stops before storage', async () => {
      for (const code of ['0x', '0xef0100' + '1'.repeat(40), '0x6000', '0x0', '0xGG', '0X', fixtureCodes[0].slice(0, -2) + (fixtureCodes[0].endsWith('01') ? '02' : '01')]) {
        const report = await stopped(responseFault(3, (e) => { e.result = code; }), 3);
        assert.equal(report.dependencies.length, 0); assert.equal(report.owners.length, 0);
      }
    });
    await test('both owner words reject malformed and zero-low160 values without fallback', async () => {
      const invalid = [null, false, 0, [], {}, '0x', '0x0', '0x' + '1'.repeat(63), '0x' + '1'.repeat(65), '0x' + '1'.repeat(66), '0x' + 'G'.repeat(64), '0x' + 'A'.repeat(64), '0X' + '1'.repeat(64), '0x' + '0'.repeat(64), '0x' + 'ff'.repeat(12) + '00'.repeat(20)];
      for (let i = 0; i < 2; i++) for (const word of invalid) {
        const report = await stopped(responseFault(4 + i, (e) => { e.result = word; }), 4 + i);
        assert.equal(report.dependencies.length, 1); assert.equal(report.owners.length, i);
        assert.deepEqual(report.owners.map((o) => o.word), fixtureWords.slice(0, i));
        assert.equal(report.historicalNoFallback, null);
        assert(report.requests.every((p) => p.method !== 'eth_call'));
        assert.equal(report.requests.filter((p) => p.method === 'eth_getStorageAt').length, i + 1);
      }
      for (let i = 0; i < 2; i++) {
        const minimum = '0x' + '0'.repeat(63) + '1';
        const { report } = await run(responseFault(4 + i, (e) => { e.result = minimum; }));
        assert.equal(report.status, 'OBSERVED_WITH_CANONICAL_PIN'); assert.equal(report.owners[i].word, minimum); assert.equal(report.owners[i].owner, '0x' + '0'.repeat(39) + '1'); m.validateReport(report, ethers);
      }
    });
    await test('both fixed headers and surrounding chain checks reject drift without repinning', async () => {
      for (const at of [2, 6]) for (const field of ['number', 'hash', 'parentHash', 'timestamp']) {
        const changed = ['hash', 'parentHash'].includes(field) ? hash('c') : '0x' + (BigInt(F[field]) + 1n).toString(16);
        await stopped(responseFault(at, (e) => { e.result[field] = changed; }), at);
      }
      for (const at of [1, 7]) for (const wrong of ['0x2', '0x01', 1, null]) await stopped(responseFault(at, (e) => { e.result = wrong; }), at);
      for (const at of [2, 6]) for (const result of [null, { ...F, number: '0x00' }, { ...F, hash: '0x12' }, { ...F, transactions: [{}] }, { ...F, timestamp: '-1' }]) await stopped(responseFault(at, (e) => { e.result = result; }), at);
    });
    await test('failures at all seven request positions stop once, redact errors and preserve only accepted prefixes', async () => {
      for (let at = 1; at <= 7; at++) {
        const faults = [() => { throw Error('SUPER_SECRET'); }, (e) => Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: e.id, error: { message: 'SUPER_SECRET', code: -32000 } })), () => Buffer.from('[]'), () => Buffer.from([0xff]), (e) => Buffer.from('{"jsonrpc":"2.0","id":' + e.id + ',"id":' + e.id + ',"result":"SUPER_SECRET"}'), (e) => { e.id++; }, (e) => { e.jsonrpc = '1.0'; }, (e) => { e.extra = 'SUPER_SECRET'; }, () => Buffer.from('{')];
        for (const fault of faults) {
          const report = await stopped(responseFault(at, fault), at);
          assert.equal(report.dependencies.length, at > 3 ? 1 : 0);
          assert.equal(report.owners.length, Math.min(Math.max(at - 4, 0), 2));
          assert.equal(report.historicalNoFallback, null);
          assert.equal(report.requests.at(-1).outcome, 'STOPPED');
          assert(Object.values(report.approval).every((v) => v === false));
        }
      }
      await stopped(responseFault(1, () => Buffer.alloc(C.limits.responseBytes + 1, 32)), 1);
    });
    await test('request, response-byte, overall-time and sequential budgets', async () => {
      const r = { requests: [], responseBytes: 0 }; let count = 0;
      const c = m.createClient(async (raw) => { count++; const p = JSON.parse(raw); return Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: p.id, result: '0x1' })); }, r);
      for (let i = 0; i < 7; i++) await c.rpc('eth_chainId', []); await assert.rejects(c.rpc('eth_chainId', [])); assert.equal(count, 7);
      let clock = 1000, contacts = 0; const d = m.createClient(async () => { contacts++; }, { requests: [], responseBytes: 0 }, () => clock); clock += C.limits.overallMs; await assert.rejects(d.rpc('eth_chainId', [])); assert.equal(contacts, 0);
      let release; const e = m.createClient(() => new Promise((resolve) => { release = resolve; }), { requests: [], responseBytes: 0 }); const first = e.rpc('eth_chainId', []); await assert.rejects(e.rpc('eth_chainId', [])); release(Buffer.from('{"jsonrpc":"2.0","id":1,"result":"0x1"}')); await first;
      let tick = 0; const { report } = await run(undefined, { now: () => 1000 + (++tick > 8 ? C.limits.overallMs : 0) }); assert.equal(report.status, 'STOPPED');
    });
    await test('fixed HTTPS options, default TLS, status/redirect/encoding/timeout/byte failures', async () => {
      const f = fakeRequest(); await m.makeHttpsTransport(f.request)('{}', 100, 1000); assert.equal(f.calls.length, 1);
      assert.deepEqual(Object.keys(f.calls[0]).sort(), ['agent', 'headers', 'hostname', 'method', 'path', 'port', 'protocol'].sort()); assert.equal(f.calls[0].hostname, 'eth-mainnet.g.alchemy.com'); assert.equal(f.calls[0].path, '/public'); assert.equal(f.calls[0].agent, false);
      for (const fault of [{ status: 302 }, { status: 500 }, { headers: { location: 'https://evil.invalid' } }, { headers: { 'content-type': 'text/html' } }, { headers: { 'content-encoding': 'gzip' } }, { headers: { 'content-length': '999999' } }, { headers: { 'content-length': '2' }, body: Buffer.from('{}x') }, { body: Buffer.alloc(1001) }, { event: 'error' }, { event: 'aborted' }, { throwRequest: true }, { hang: true }]) { const f = fakeRequest(fault); await assert.rejects(m.makeHttpsTransport(f.request)('{}', 5, 1000), { message: 'OBSERVATION_STOPPED' }); assert.equal(f.calls.length, 1); }
    });
    await test('report exact allowlist, real code rehash, decoded words and exclusive reservation', async () => {
      const { report } = await run();
      for (const key of ['balance', 'privateKey', 'rawTransaction', 'signature', 'authorization', 'operationalAcceptance', 'accounts', 'pending']) { const bad = clone(report); bad[key] = 'SUPER_SECRET'; assert.throws(() => m.validateReport(bad, ethers)); }
      for (const target of ['source', 'dependencies', 'owners', 'requests']) { const bad = clone(report); const node = Array.isArray(bad[target]) ? bad[target][0] : bad[target]; node.rawCode = 'SUPER_SECRET'; assert.throws(() => m.validateReport(bad, ethers)); }
      const changes = [(r) => { r.dependencies[0].code.runtime = fixtureCodes[0].slice(0, -2) + '01'; }, (r) => { r.dependencies[0].code.bytes++; }, (r) => { r.dependencies[0].code.keccak256 = hash('f'); }, (r) => { r.dependencies.push(r.dependencies[0]); }, (r) => { r.dependencies.pop(); }, (r) => { r.owners.reverse(); }, (r) => { r.owners[1] = r.owners[0]; }, (r) => { r.owners.pop(); }, (r) => { r.owners.push(r.owners[0]); }, (r) => { r.owners[0].word = hash('0'); }, (r) => { r.owners[0].word = fixtureWords[1]; }, (r) => { r.owners[0].owner = '0x' + '00'.repeat(20); }, (r) => { r.owners[0].key = C.ownerSlots[1].key; }, (r) => { r.owners[0].node = C.ownerSlots[1].node; }, (r) => { r.owners[0].blockHash = hash('e'); }, (r) => { r.owners[0].address = '0x' + '1'.repeat(40); }, (r) => { r.owners[0].name = 'other.eth'; }, (r) => { r.priorObservation.reportSha256 = 'f'.repeat(64); }, (r) => { r.jobsSource.commit = 'f'.repeat(40); }, (r) => { r.mode = 'generic'; }, (r) => { r.historicalNoFallback = null; }, (r) => { r.requests.reverse(); }, (r) => { r.responseBytes++; }, (r) => { r.pin.number = '0x1'; }];
      for (const key of Object.keys(C.pathProof)) changes.push((r) => { r.pathProof[key] = 'changed'; });
      changes.push((r) => { delete r.pathProof; });
      for (const key of Object.keys(C.approval)) changes.push((r) => { r.approval[key] = true; });
      for (let i = 0; i < 7; i++) {
        changes.push((r) => { r.requests[i].responseSha256 = null; });
        changes.push((r) => { r.responseBytes -= r.requests[i].bytes; r.requests[i].bytes = 0; });
        changes.push((r) => { r.responseBytes += C.limits.responseBytes + 1 - r.requests[i].bytes; r.requests[i].bytes = C.limits.responseBytes + 1; });
      }
      for (const i of [3, 4]) changes.push((r) => { r.requests[i].params[1] = C.ownerSlots[i === 3 ? 1 : 0].key; });

      for (const change of changes) { const bad = clone(report); change(bad); assert.throws(() => m.validateReport(bad, ethers)); }
      const out = path.join(temp, 'receipt.json'), fd = m.reserveOutput(out); fs.writeFileSync(fd, m.validateReport(report, ethers)); fs.closeSync(fd); assert.throws(() => m.reserveOutput(out)); assert(fs.statSync(out).size < C.limits.reportBytes);
      const link = path.join(temp, 'alias.json'); fs.symlinkSync(out, link); assert.throws(() => m.reserveOutput(link)); assert.throws(() => m.reserveOutput('relative.json'));
    });
    await test('exhaustive stopped-prefix matrix rejects impossible code/word/request histories', async () => {
      const { report } = await run(); let accepted = 0, rejected = 0;
      for (let n = 0; n <= 7; n++) for (let mask = 0; mask < (1 << n); mask++) for (let dep = 0; dep <= 1; dep++) for (let owner = 0; owner <= 2; owner++) for (const pinPresent of [false, true]) {
        const r = clone(report); r.status = 'STOPPED'; r.reason = 'OBSERVATION_STOPPED'; r.historicalNoFallback = null;
        r.requests = r.requests.slice(0, n); r.requests.forEach((q, i) => { q.outcome = mask & (1 << i) ? 'STOPPED' : 'RECEIVED'; });
        r.responseBytes = r.requests.reduce((sum, q) => sum + q.bytes, 0); r.dependencies = r.dependencies.slice(0, dep); r.owners = r.owners.slice(0, owner); if (!pinPresent) r.pin = null;
        const stoppedLast = n > 0 && (mask & (1 << (n - 1))) !== 0;
        const terminalData = n >= 3 && n <= 5, data = Math.min(Math.max(n - 2, 0), 3), retained = dep + owner;
        const possible = (mask === 0 || mask === (1 << (n - 1))) && (!owner || dep === 1) && (!retained || pinPresent) && (n < 3 || pinPresent) && (!(n <= 1 || (n === 2 && stoppedLast)) || !pinPresent) && retained >= data - (terminalData ? 1 : 0) && retained <= data && (!(terminalData && stoppedLast) || retained === data - 1);
        if (possible) { m.validateReport(r, ethers); accepted++; }
        else { assert.throws(() => m.validateReport(r, ethers)); rejected++; }
      }
      assert(accepted > 0 && rejected > 1000); process.stdout.write('PREFIX_MATRIX ' + JSON.stringify({ accepted, rejected }) + '\n');
      for (const pin of [false, 0, '', [], 'invalid']) { const r = clone(report); r.pin = pin; assert.throws(() => m.validateReport(r, ethers)); }
    });
    await test('CLI preflight failures preserve a generic STOPPED receipt without contact', async () => {
      const lock = path.join(b, 'package-lock.json'), bytes = fs.readFileSync(lock); fs.appendFileSync(lock, ' ');
      const out = path.join(temp, 'stopped.json'), stderr = process.stderr.write; let errorText = '';
      try { process.stderr.write = (s) => { errorText += s; return true; }; await m.main(['--dependency-root', b, '--collector-commit', commit, '--output', out, '--mode', C.mode]); }
      finally { process.stderr.write = stderr; process.exitCode = 0; fs.writeFileSync(lock, bytes); }
      const report = JSON.parse(fs.readFileSync(out)); assert.equal(report.status, 'STOPPED'); assert.equal(report.requests.length, 0); assert.equal(errorText, 'OBSERVATION_STOPPED\n'); m.validateReport(report, ethers);
    });
    await test('CLI has one literal mode and no provider/address/slot/block/hash injection path', async () => {
      const stderr = process.stderr.write; let errorText = '';
      const out = path.join(temp, 'injected.json');
      const args = ['--dependency-root', source, '--collector-commit', commit, '--output', out, '--mode', C.mode];
      const invalid = [args.slice(0, 6), [...args.slice(0, 7), 'generic'], [...args.slice(0, 7), 'fixed-ens-two-word-20261017']];
      for (const flag of ['--endpoint', '--provider', '--address', '--slot', '--key', '--block', '--block-hash', '--expected-hash', '--ethers', '--transport', '--mode']) invalid.push([...args, flag, 'SUPER_SECRET']);
      try { process.stderr.write = (s) => { errorText += s; return true; }; for (const argv of invalid) { await m.main(argv); assert.equal(fs.existsSync(out), false); process.exitCode = 0; } }
      finally { process.stderr.write = stderr; process.exitCode = 0; }
      assert.equal(errorText, 'OBSERVATION_STOPPED\n'.repeat(invalid.length)); assert.equal(externalAttempts, 0);
    });
    await test('workflow has exact opened-only same-repo branch gate and immutable source', () => {
      const y = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/account-metadata-observation.yml'), 'utf8');
      assert(y.includes('types: [opened]')); assert(y.includes('GIT_NO_LAZY_FETCH=1 GIT_ALLOW_PROTOCOL=')); assert(y.includes('protocol.allow=never')); assert(!y.includes('$(git -C')); assert(y.includes("github.event.pull_request.head.repo.full_name == 'MontrealAI/AGIJobManager'")); assert(y.includes("github.event.pull_request.head.ref == 'qualification/jobs-ens-two-word-20261016'")); assert(y.includes(C.source.commit)); assert(y.includes(C.source.tree)); assert(y.includes(C.source.lockSha256)); assert(!/pull_request_target|workflow_dispatch|synchronize|secrets\./.test(y)); assert(!y.includes('--local-no-relocation')); assert(y.includes('--mode ' + C.mode)); assert(y.includes('github.run_attempt == 1')); assert(y.indexOf('test-observe-account-metadata.cjs') < y.indexOf('Observe the fixed historical ENS words once'));
    });
    assert.equal(externalAttempts, 0); process.stdout.write(JSON.stringify({ status: pendingGroups.length ? 'PARTIAL_LOCAL_PASS' : 'PASS', tests: passed, pendingGroups, syntheticKnownHashSuccessFixture: false, realRetainedRuntimePreimage: true, syntheticOwnerWords: true, externalTransportAttempts: externalAttempts, plannedRequests: 7 }) + '\n');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
