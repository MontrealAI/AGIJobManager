'use strict';
// Public metadata witness only. Importing this file never contacts a provider.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const { TextDecoder } = require('node:util');
const ROOT = path.resolve(__dirname, '../..');
const CONFIG_SHA256 = '5f477822736c3122155c0a3d5bca3b60fb73f6017b70331db04802011357b043';
const FILES = ['.github/workflows/account-metadata-observation.yml', 'scripts/qualification/observe-account-metadata.cjs', 'scripts/qualification/test-observe-account-metadata.cjs', 'config/account-metadata-observation.json'];
const fail = () => { throw new Error('OBSERVATION_STOPPED'); };
const check = (v) => { if (!v) fail(); };
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keys = (o, k) => check(o && !Array.isArray(o) && typeof o === 'object' && equal(Object.keys(o).sort(), [...k].sort()));
const hash = (v) => { check(typeof v === 'string' && /^0x[0-9a-f]{64}$/.test(v)); return v; };
const quantity = (v) => { check(typeof v === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/.test(v)); return BigInt(v); };
const hex = (v) => { check(typeof v === 'string' && /^0x(?:[0-9a-f]{2})*$/.test(v)); return v; };
const freeze = (v) => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };

// JSON.parse alone silently accepts duplicate keys. Parse bounded JSON without that ambiguity.
function strictJson(raw) {
  check(Buffer.isBuffer(raw) && raw.length <= 524288);
  const s = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  let i = 0, nodes = 0;
  const ws = () => { while (/[\x20\t\r\n]/.test(s[i] || '\0')) i++; };
  function string() {
    const start = i++;
    while (i < s.length) {
      const c = s[i++];
      if (c === '\\') { check(i < s.length); i++; }
      else if (c === '"') return JSON.parse(s.slice(start, i));
    }
    fail();
  }
  function value(depth) {
    check(depth <= 32 && ++nodes <= 20000); ws();
    if (s[i] === '"') return string();
    if (s[i] === '{') {
      i++; ws(); const out = Object.create(null), seen = new Set();
      if (s[i] === '}') { i++; return out; }
      for (;;) {
        check(s[i] === '"'); const k = string();
        check(!seen.has(k) && !['__proto__', 'constructor', 'prototype'].includes(k)); seen.add(k); ws();
        check(s[i++] === ':'); out[k] = value(depth + 1); ws();
        const c = s[i++]; if (c === '}') return out; check(c === ','); ws();
      }
    }
    if (s[i] === '[') {
      i++; ws(); const out = []; if (s[i] === ']') { i++; return out; }
      for (;;) { out.push(value(depth + 1)); ws(); const c = s[i++]; if (c === ']') return out; check(c === ','); }
    }
    for (const [token, result] of [['true', true], ['false', false], ['null', null]]) {
      if (s.startsWith(token, i)) { i += token.length; return result; }
    }
    const m = /^(?:-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(s.slice(i));
    check(m); i += m[0].length; const n = Number(m[0]); check(Number.isSafeInteger(n)); return n;
  }
  const result = value(0); ws(); check(i === s.length); return result;
}
function loadConfig(raw = fs.readFileSync(path.join(ROOT, FILES[3]))) {
  check(sha256(raw) === CONFIG_SHA256); return freeze(strictJson(raw));
}
const CONFIG = loadConfig();
function checkEnvironment(env) {
  // The workflow supplies a clean env. Reject secrets and runtime/TLS/proxy overrides before contact.
  for (const k of Object.keys(env)) {
    check(!/(?:TOKEN|SECRET|PASSWORD|PRIVATE|MNEMONIC|WALLET|SIGNER|LEDGER|RPC|API_KEY|CREDENTIAL)/i.test(k));
    check(!/^(?:NODE_|OPENSSL_|SSL_|LD_|DYLD_|NPM_CONFIG_)/i.test(k) && !/^(?:HTTPS?_PROXY|ALL_PROXY|NO_PROXY)$/i.test(k));
  }
}
function loadEthers(root) {
  check(typeof root === 'string' && path.isAbsolute(root));
  const canonical = fs.realpathSync(root); check(canonical === path.resolve(root));
  check(sha256(fs.readFileSync(path.join(canonical, 'package-lock.json'))) === CONFIG.source.lockSha256);
  const req = createRequire(path.join(canonical, 'package.json'));
  const entry = fs.realpathSync(req.resolve('ethers'));
  check(entry === path.join(canonical, 'node_modules/ethers/lib.commonjs/index.js'));
  const pkg = path.join(canonical, 'node_modules/ethers/package.json');
  check(fs.realpathSync(pkg) === pkg);
  check(strictJson(fs.readFileSync(pkg)).version === CONFIG.source.ethersVersion);
  // Resolve every runtime dependency inside this canonical root; no ancestor fallback.
  const local = createRequire(entry);
  for (const name of ['@noble/curves/secp256k1', '@noble/hashes/sha3', '@adraffy/ens-normalize', 'aes-js', 'tslib', 'ws']) {
    const resolved = fs.realpathSync(local.resolve(name)); check(resolved.startsWith(canonical + path.sep));
  }
  const before = new Set(Object.keys(require.cache));
  const ethers = req('ethers');
  for (const file of Object.keys(require.cache)) if (!before.has(file)) check(fs.realpathSync(file).startsWith(canonical + path.sep));
  check(ethers.version === CONFIG.source.ethersVersion);
  check(ethers.keccak256('0x') === '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  for (const a of [...CONFIG.accounts, ...CONFIG.dependencies]) check(ethers.getAddress(a.address) === a.address);
  return ethers;
}
function sourceIdentity(root) {
  const git = (...args) => execFileSync('git', ['-c', 'protocol.allow=never', '-c', 'core.hooksPath=/dev/null', '-C', root, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, GIT_NO_LAZY_FETCH: '1', GIT_ALLOW_PROTOCOL: '', GIT_NO_REPLACE_OBJECTS: '1', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null' }, timeout: 5000, maxBuffer: 4096, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return { commit: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}') };
}
function inventory() { return FILES.map((file) => ({ file, sha256: sha256(fs.readFileSync(path.join(ROOT, file))) })); }
function block(value) {
  check(value && typeof value === 'object' && !Array.isArray(value));
  const result = { number: value.number, hash: hash(value.hash), parentHash: hash(value.parentHash), timestamp: value.timestamp };
  quantity(result.number); quantity(result.timestamp);
  check(Array.isArray(value.transactions) && value.transactions.every((tx) => typeof tx === 'string' && /^0x[0-9a-f]{64}$/.test(tx)));
  return result;
}
function assertRequest(method, params, pins) {
  check(typeof method === 'string' && Array.isArray(params));
  if (method === 'eth_chainId') return check(params.length === 0);
  if (method === 'eth_getBlockByNumber') {
    check(params.length === 2 && params[1] === false);
    return check(['finalized', 'latest', ...pins.map((p) => p.number)].includes(params[0]));
  }
  check(['eth_getCode', 'eth_getTransactionCount'].includes(method) && params.length === 2);
  const account = CONFIG.accounts.find((a) => a.address === params[0]);
  const dependency = CONFIG.dependencies.find((a) => a.address === params[0]);
  check(account || (dependency && method === 'eth_getCode'));
  if (params[1] === 'pending') return check(account && method === 'eth_getTransactionCount');
  keys(params[1], ['blockHash', 'requireCanonical']);
  check(params[1].requireCanonical === true && pins.some((p) => p.hash === params[1].blockHash));
  // Dependencies are observed at finalized only.
  if (dependency) check(params[1].blockHash === pins[0].hash);
}

// Fixed endpoint and default TLS trust. No redirects, retries, fallback, proxy, or batch support.
function makeHttpsTransport(request = https.request) {
  return (payload, timeoutMs, byteCap) => new Promise((resolve, reject) => {
    let req, timer, settled = false;
    const finish = (error, result) => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (error) { if (req) req.destroy(); reject(new Error('OBSERVATION_STOPPED')); } else resolve(result);
    };
    timer = setTimeout(() => finish(true), timeoutMs);
    try {
      req = request({ protocol: 'https:', hostname: 'eth-mainnet.g.alchemy.com', port: 443, path: '/public', method: 'POST', agent: false,
        headers: { 'content-type': 'application/json', accept: 'application/json', 'content-length': Buffer.byteLength(payload) } }, (res) => {
        const h = res.headers;
        if (res.statusCode !== 200 || h.location !== undefined || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(h['content-type'] || '') || (h['content-encoding'] && h['content-encoding'] !== 'identity') || (h['content-length'] !== undefined && (!/^(?:0|[1-9][0-9]*)$/.test(h['content-length']) || Number(h['content-length']) > byteCap))) { res.destroy(); return finish(true); }
        const chunks = []; let bytes = 0;
        res.on('data', (chunk) => { bytes += chunk.length; if (bytes > byteCap) { res.destroy(); finish(true); } else chunks.push(Buffer.from(chunk)); });
        res.on('end', () => { if (h['content-length'] !== undefined && Number(h['content-length']) !== bytes) return finish(true); finish(false, Buffer.concat(chunks)); });
        res.on('error', () => finish(true)); res.on('aborted', () => finish(true));
      });
      req.on('error', () => finish(true)); req.end(payload);
    } catch { finish(true); }
  });
}
function createClient(transport, report, now = Date.now) {
  const start = now(), pins = [];
  let bytes = 0, active = false;
  async function rpc(method, params) {
    check(!active); assertRequest(method, params, pins);
    check(report.requests.length < CONFIG.limits.requests && bytes < CONFIG.limits.aggregateBytes && now() - start < CONFIG.limits.overallMs);
    const record = { id: report.requests.length + 1, method, params, startedAt: new Date(now()).toISOString(), completedAt: null, bytes: 0, responseSha256: null, outcome: 'STOPPED' };
    report.requests.push(record); active = true;
    let timer;
    try {
      const timeout = Math.min(CONFIG.limits.requestMs, CONFIG.limits.overallMs - (now() - start)); check(timeout > 0);
      const raw = await Promise.race([transport(JSON.stringify({ jsonrpc: '2.0', id: record.id, method, params }), timeout, Math.min(CONFIG.limits.responseBytes, CONFIG.limits.aggregateBytes - bytes)), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('OBSERVATION_STOPPED')), timeout); })]);
      check(Buffer.isBuffer(raw)); record.bytes = Math.min(raw.length, CONFIG.limits.responseBytes + 1); bytes += record.bytes; report.responseBytes = bytes;
      check(raw.length <= CONFIG.limits.responseBytes && bytes <= CONFIG.limits.aggregateBytes && now() - start < CONFIG.limits.overallMs);
      record.responseSha256 = sha256(raw);
      const envelope = strictJson(raw); keys(envelope, ['jsonrpc', 'id', 'result']);
      check(envelope.jsonrpc === '2.0' && envelope.id === record.id);
      record.outcome = 'RECEIVED'; return envelope.result;
    } finally { clearTimeout(timer); active = false; record.completedAt = new Date(now()).toISOString(); }
  }
  return { rpc, pins };
}
function codeSummary(code, subject, ethers) {
  hex(code); const bytes = (code.length - 2) / 2;
  const summary = { bytes, keccak256: ethers.keccak256(code), classification: bytes ? 'public-contract-code' : 'empty-code' };
  if (subject.role === 'creator') {
    const marker = '0xef0100' + CONFIG.accounts[2].address.slice(2).toLowerCase();
    check(code === '0x' || code === marker); summary.exactCode = code;
    if (code !== '0x') summary.classification = '7702-marker-observation-only';
  } else if (subject.role === 'governor') check(bytes === 0);
  else check(bytes > 0);
  return summary;
}
function newReport(collectorCommit, now = Date.now) {
  check(typeof collectorCommit === 'string' && /^[0-9a-f]{40}$/.test(collectorCommit));
  return { schema: CONFIG.schema, status: 'STOPPED', reason: 'OBSERVATION_STOPPED', scope: CONFIG.scope, source: CONFIG.source, collectorCommit, files: inventory(), endpoint: CONFIG.endpoint, startedAt: new Date(now()).toISOString(), completedAt: null, pins: null, headTimingContext: null, accounts: [], dependencies: [], pending: [], requests: [], responseBytes: 0, sourceReferences: CONFIG.sourceReferences };
}
async function observe({ transport, ethers, collectorCommit, now = Date.now }) {
  check(typeof transport === 'function');
  const report = newReport(collectorCommit, now);
  const client = createClient(transport, report, now), rpc = client.rpc;
  try {
    check(await rpc('eth_chainId', []) === CONFIG.chainId);
    const f = block(await rpc('eth_getBlockByNumber', ['finalized', false]));
    const l = block(await rpc('eth_getBlockByNumber', ['latest', false]));
    check(quantity(f.number) <= quantity(l.number) && quantity(f.timestamp) <= quantity(l.timestamp));
    check((f.number === l.number) === (f.hash === l.hash));
    check(f.number !== l.number || equal(f, l));
    if (quantity(l.number) === quantity(f.number) + 1n) check(l.parentHash === f.hash);
    client.pins.push(f, l); report.pins = { finalized: f, latest: l };
    for (const [label, pin] of [['finalized', f], ['latest', l]]) {
      const ref = { blockHash: pin.hash, requireCanonical: true };
      for (const a of CONFIG.accounts) {
        const code = codeSummary(await rpc('eth_getCode', [a.address, ref]), a, ethers);
        const nonce = quantity(await rpc('eth_getTransactionCount', [a.address, ref])).toString();
        const earlier = report.accounts.find((r) => r.role === a.role);
        if (earlier) check(BigInt(nonce) >= BigInt(earlier.nonce));
        report.accounts.push({ ...a, at: label, blockHash: pin.hash, code, nonce });
      }
      if (label === 'finalized') for (const d of CONFIG.dependencies) report.dependencies.push({ ...d, at: 'finalized', blockHash: pin.hash, code: codeSummary(await rpc('eth_getCode', [d.address, ref]), d, ethers) });
    }
    for (const a of CONFIG.accounts) {
      const nonce = quantity(await rpc('eth_getTransactionCount', [a.address, 'pending'])).toString();
      check(BigInt(nonce) >= BigInt(report.accounts.find((r) => r.role === a.role && r.at === 'latest').nonce));
      report.pending.push({ ...a, nonce, scope: 'unpinned-transient-not-atomic-no-reservation' });
    }
    for (const pin of [f, l]) check(equal(block(await rpc('eth_getBlockByNumber', [pin.number, false])), pin));
    check(await rpc('eth_chainId', []) === CONFIG.chainId);
    const finalF = block(await rpc('eth_getBlockByNumber', ['finalized', false]));
    const finalL = block(await rpc('eth_getBlockByNumber', ['latest', false]));
    check(quantity(finalF.number) >= quantity(f.number) && quantity(finalL.number) >= quantity(l.number) && quantity(finalF.number) <= quantity(finalL.number));
    check(quantity(finalF.timestamp) >= quantity(f.timestamp) && quantity(finalL.timestamp) >= quantity(l.timestamp) && quantity(finalF.timestamp) <= quantity(finalL.timestamp));
    for (const head of [finalF, finalL]) for (const pin of [f, l, finalF, finalL]) {
      check((head.number === pin.number) === (head.hash === pin.hash));
      if (head.number === pin.number) check(equal(head, pin));
      if (quantity(head.number) === quantity(pin.number) + 1n) check(head.parentHash === pin.hash);
    }
    report.headTimingContext = { finalized: finalF, latest: finalL, scope: 'end-of-observation-context-only-not-repinned' };
    report.status = 'OBSERVED_WITH_CANONICAL_PINS'; report.reason = null;
  } catch { /* Never retain provider errors, headers, raw payloads, or exception text. */ }
  report.completedAt = new Date(now()).toISOString(); return report;
}

function validateReport(r) {
  keys(r, ['schema', 'status', 'reason', 'scope', 'source', 'collectorCommit', 'files', 'endpoint', 'startedAt', 'completedAt', 'pins', 'headTimingContext', 'accounts', 'dependencies', 'pending', 'requests', 'responseBytes', 'sourceReferences']);
  check(r.schema === CONFIG.schema && r.scope === CONFIG.scope && equal(r.source, CONFIG.source) && equal(r.sourceReferences, CONFIG.sourceReferences) && r.endpoint === CONFIG.endpoint);
  check(['STOPPED', 'OBSERVED_WITH_CANONICAL_PINS'].includes(r.status) && r.reason === (r.status === 'STOPPED' ? 'OBSERVATION_STOPPED' : null));
  check(/^[0-9a-f]{40}$/.test(r.collectorCommit));
  const time = (v) => check(typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)));
  time(r.startedAt); time(r.completedAt);
  check(equal(r.files, inventory()));
  const pin = (p) => { keys(p, ['number', 'hash', 'parentHash', 'timestamp']); quantity(p.number); hash(p.hash); hash(p.parentHash); quantity(p.timestamp); };
  if (r.pins) { keys(r.pins, ['finalized', 'latest']); pin(r.pins.finalized); pin(r.pins.latest); }
  if (r.headTimingContext) { keys(r.headTimingContext, ['finalized', 'latest', 'scope']); pin(r.headTimingContext.finalized); pin(r.headTimingContext.latest); check(r.headTimingContext.scope === 'end-of-observation-context-only-not-repinned'); }
  const summary = (c, role) => {
    keys(c, role === 'creator' ? ['bytes', 'keccak256', 'classification', 'exactCode'] : ['bytes', 'keccak256', 'classification']);
    check(Number.isSafeInteger(c.bytes) && c.bytes >= 0 && c.bytes <= CONFIG.limits.responseBytes / 2); hash(c.keccak256);
    check(['public-contract-code', 'empty-code', '7702-marker-observation-only'].includes(c.classification));
    if (role === 'creator') check(c.exactCode === '0x' || c.exactCode === '0xef0100' + CONFIG.accounts[2].address.slice(2).toLowerCase());
  };
  check(Array.isArray(r.accounts) && r.accounts.length <= 6 && Array.isArray(r.dependencies) && r.dependencies.length <= 5 && Array.isArray(r.pending) && r.pending.length <= 3);
  for (const a of r.accounts) { keys(a, ['role', 'address', 'at', 'blockHash', 'code', 'nonce']); check(CONFIG.accounts.some((s) => a.role === s.role && a.address === s.address)); check(['finalized', 'latest'].includes(a.at) && r.pins && a.blockHash === r.pins[a.at].hash); summary(a.code, a.role); check(/^(?:0|[1-9][0-9]{0,77})$/.test(a.nonce)); }
  for (const d of r.dependencies) { keys(d, ['role', 'address', 'scope', 'at', 'blockHash', 'code']); check(CONFIG.dependencies.some((s) => d.role === s.role && d.address === s.address && d.scope === s.scope)); check(d.at === 'finalized' && r.pins && d.blockHash === r.pins.finalized.hash); summary(d.code, d.role); }
  for (const p of r.pending) { keys(p, ['role', 'address', 'nonce', 'scope']); check(CONFIG.accounts.some((s) => p.role === s.role && p.address === s.address)); check(/^(?:0|[1-9][0-9]{0,77})$/.test(p.nonce) && p.scope === 'unpinned-transient-not-atomic-no-reservation'); }
  check(Array.isArray(r.requests) && r.requests.length <= CONFIG.limits.requests && Number.isSafeInteger(r.responseBytes) && r.responseBytes >= 0 && r.responseBytes <= CONFIG.limits.aggregateBytes + CONFIG.limits.responseBytes);
  for (const [i, q] of r.requests.entries()) { keys(q, ['id', 'method', 'params', 'startedAt', 'completedAt', 'bytes', 'responseSha256', 'outcome']); check(q.id === i + 1); assertRequest(q.method, q.params, r.pins ? [r.pins.finalized, r.pins.latest] : []); time(q.startedAt); time(q.completedAt); check(Number.isSafeInteger(q.bytes) && q.bytes >= 0 && q.bytes <= CONFIG.limits.responseBytes + 1); if (q.responseSha256 !== null) check(/^[0-9a-f]{64}$/.test(q.responseSha256)); check(['RECEIVED', 'STOPPED'].includes(q.outcome)); }
  if (r.status === 'OBSERVED_WITH_CANONICAL_PINS') check(r.pins && r.headTimingContext && r.accounts.length === 6 && r.dependencies.length === 5 && r.pending.length === 3 && r.requests.length === 28 && r.requests.every((q) => q.outcome === 'RECEIVED'));
  const raw = Buffer.from(JSON.stringify(r, null, 2) + '\n'); check(raw.length <= CONFIG.limits.reportBytes); return raw;
}
function reserveOutput(file) {
  check(typeof file === 'string' && path.isAbsolute(file) && path.extname(file) === '.json');
  const dir = path.dirname(file); check(fs.realpathSync(dir) === dir);
  return fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
}
async function main(argv = process.argv.slice(2)) {
  let fd, report;
  try {
    check(argv.length === 6 && argv[0] === '--dependency-root' && argv[2] === '--collector-commit' && argv[4] === '--output');
    report = newReport(argv[3]);
    fd = reserveOutput(argv[5]);
    checkEnvironment(process.env); check(process.versions.node === CONFIG.source.nodeVersion);
    const ethers = loadEthers(argv[1]); check(equal(sourceIdentity(argv[1]), { commit: CONFIG.source.commit, tree: CONFIG.source.tree }));
    const collector = sourceIdentity(ROOT); check(collector.commit === argv[3]);
    report = await observe({ transport: makeHttpsTransport(), ethers, collectorCommit: collector.commit });
    fs.writeFileSync(fd, validateReport(report)); fs.fsyncSync(fd);
    if (report.status !== 'OBSERVED_WITH_CANONICAL_PINS') process.exitCode = 1;
  } catch {
    if (fd !== undefined && report) {
      try { report.status = 'STOPPED'; report.reason = 'OBSERVATION_STOPPED'; report.completedAt = new Date().toISOString(); fs.writeFileSync(fd, validateReport(report)); fs.fsyncSync(fd); } catch { /* Do not print raw errors. */ }
    }
    process.stderr.write('OBSERVATION_STOPPED\n'); process.exitCode = 1;
  }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
module.exports = { CONFIG, FILES, strictJson, loadConfig, checkEnvironment, loadEthers, sourceIdentity, inventory, assertRequest, makeHttpsTransport, createClient, codeSummary, observe, validateReport, reserveOutput, main };
if (require.main === module) main();
