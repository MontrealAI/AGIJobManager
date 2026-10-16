'use strict';
// Exactly two literal ENS owner storage words at one historical pin. Importing never contacts a provider.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const { TextDecoder } = require('node:util');
const ROOT = path.resolve(__dirname, '../..');
const CONFIG_SHA256 = '34517626f7c941922e9724ef824b99a6cac30ad70ab6ab85bb98c0bcc65732d2';
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
  for (const a of CONFIG.dependencies) check(ethers.getAddress(a.address) === a.address);
  for (const slot of CONFIG.ownerSlots) {
    check(ethers.namehash(slot.name) === slot.node);
    check(ethers.keccak256(slot.node + '00'.repeat(32)) === slot.key);
  }
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
  if (method === 'eth_getBlockByNumber') return check(equal(params, [CONFIG.priorObservation.finalized.number, false]));
  check(method === 'eth_getCode' || method === 'eth_getStorageAt');
  check(params.length === (method === 'eth_getCode' ? 2 : 3));
  check(params[0] === CONFIG.dependencies[0].address);
  if (method === 'eth_getStorageAt') check(CONFIG.ownerSlots.some((s) => s.key === params[1]));
  const ref = params.at(-1);
  keys(ref, ['blockHash', 'requireCanonical']);
  check(ref.requireCanonical === true && ref.blockHash === CONFIG.priorObservation.finalized.hash);
  check(pins.length === 1); requireObservationPin(pins[0]);
}
function requestPlan() {
  const pin = CONFIG.priorObservation.finalized, ref = { blockHash: pin.hash, requireCanonical: true };
  return [['eth_chainId', []], ['eth_getBlockByNumber', [pin.number, false]],
    ['eth_getCode', [CONFIG.dependencies[0].address, ref]],
    ...CONFIG.ownerSlots.map((s) => ['eth_getStorageAt', [CONFIG.dependencies[0].address, s.key, ref]]),
    ['eth_getBlockByNumber', [pin.number, false]], ['eth_chainId', []]];
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
  check(bytes === subject.expectedBytes && bytes > 0 && !code.startsWith('0xef0100'));
  check(ethers && typeof ethers.keccak256 === 'function');
  const digest = ethers.keccak256(code); check(digest === subject.expectedKeccak256);
  return { bytes, keccak256: digest, classification: 'public-contract-code', runtime: code };
}
function ownerSummary(word, slot) {
  hash(word); const owner = '0x' + word.slice(-40);
  check(owner !== '0x' + '0'.repeat(40));
  return { role: slot.role, name: slot.name, node: slot.node, key: slot.key, address: CONFIG.dependencies[0].address, blockHash: CONFIG.priorObservation.finalized.hash, word, owner };
}
function newReport(collectorCommit, now = Date.now) {
  check(typeof collectorCommit === 'string' && /^[0-9a-f]{40}$/.test(collectorCommit));
  return { schema: CONFIG.schema, mode: CONFIG.mode, status: 'STOPPED', reason: 'OBSERVATION_STOPPED', scope: CONFIG.scope, source: CONFIG.source, jobsSource: CONFIG.jobsSource, pathProof: CONFIG.pathProof, collectorCommit, files: inventory(), endpoint: CONFIG.endpoint, priorObservation: CONFIG.priorObservation, startedAt: new Date(now()).toISOString(), completedAt: null, pin: null, dependencies: [], owners: [], historicalNoFallback: null, approval: CONFIG.approval, requests: [], responseBytes: 0, sourceReferences: CONFIG.sourceReferences };
}
function requireObservationPin(pin) {
  keys(pin, ['number', 'hash', 'parentHash', 'timestamp']); quantity(pin.number); hash(pin.hash); hash(pin.parentHash); quantity(pin.timestamp);
  check(equal(pin, CONFIG.priorObservation.finalized));
}
async function observe({ transport, ethers, collectorCommit, now = Date.now }) {
  check(typeof transport === 'function');
  const report = newReport(collectorCommit, now);
  const client = createClient(transport, report, now), rpc = client.rpc;
  try {
    check(await rpc('eth_chainId', []) === CONFIG.chainId);
    const pin = block(await rpc('eth_getBlockByNumber', [CONFIG.priorObservation.finalized.number, false]));
    requireObservationPin(pin);
    client.pins.push(pin); report.pin = pin;
    const ref = { blockHash: pin.hash, requireCanonical: true }, d = CONFIG.dependencies[0];
    const code = codeSummary(await rpc('eth_getCode', [d.address, ref]), d, ethers);
    report.dependencies.push({ role: d.role, address: d.address, blockHash: pin.hash, code });
    for (const slot of CONFIG.ownerSlots) {
      const owner = ownerSummary(await rpc('eth_getStorageAt', [d.address, slot.key, ref]), slot);
      report.owners.push(owner);
    }
    check(equal(block(await rpc('eth_getBlockByNumber', [pin.number, false])), pin));
    check(await rpc('eth_chainId', []) === CONFIG.chainId);
    report.status = 'OBSERVED_WITH_CANONICAL_PIN'; report.reason = null; report.historicalNoFallback = true;
  } catch { /* Never retain provider errors, headers, rejected raw code/words or exception text. */ }
  report.completedAt = new Date(now()).toISOString(); return report;
}
function validateReport(r, ethers) {
  keys(r, ['schema', 'mode', 'status', 'reason', 'scope', 'source', 'jobsSource', 'pathProof', 'collectorCommit', 'files', 'endpoint', 'priorObservation', 'startedAt', 'completedAt', 'pin', 'dependencies', 'owners', 'historicalNoFallback', 'approval', 'requests', 'responseBytes', 'sourceReferences']);
  check(r.schema === CONFIG.schema && r.mode === CONFIG.mode && r.scope === CONFIG.scope && equal(r.source, CONFIG.source) && equal(r.jobsSource, CONFIG.jobsSource) && equal(r.pathProof, CONFIG.pathProof) && equal(r.sourceReferences, CONFIG.sourceReferences) && equal(r.priorObservation, CONFIG.priorObservation) && equal(r.approval, CONFIG.approval) && r.endpoint === CONFIG.endpoint);
  check(['STOPPED', 'OBSERVED_WITH_CANONICAL_PIN'].includes(r.status) && r.reason === (r.status === 'STOPPED' ? 'OBSERVATION_STOPPED' : null));
  check(r.historicalNoFallback === (r.status === 'STOPPED' ? null : true));
  check(/^[0-9a-f]{40}$/.test(r.collectorCommit));
  const time = (v) => check(typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)));
  time(r.startedAt); time(r.completedAt); check(equal(r.files, inventory()));
  check(r.pin === null || (r.pin && typeof r.pin === 'object' && !Array.isArray(r.pin)));
  if (r.pin !== null) requireObservationPin(r.pin);
  check(Array.isArray(r.dependencies) && r.dependencies.length <= 1);
  for (const [i, d] of r.dependencies.entries()) {
    keys(d, ['role', 'address', 'blockHash', 'code']); const expected = CONFIG.dependencies[i];
    check(d.role === expected.role && d.address === expected.address && r.pin && d.blockHash === r.pin.hash);
    keys(d.code, ['bytes', 'keccak256', 'classification', 'runtime']);
    check(equal(d.code, codeSummary(d.code.runtime, expected, ethers)));
  }
  check(Array.isArray(r.owners) && r.owners.length <= 2);
  for (const [i, o] of r.owners.entries()) {
    keys(o, ['role', 'name', 'node', 'key', 'address', 'blockHash', 'word', 'owner']);
    check(equal(o, ownerSummary(o.word, CONFIG.ownerSlots[i])) && r.dependencies.length === 1 && r.pin !== null);
  }
  check(Array.isArray(r.requests) && r.requests.length <= CONFIG.limits.requests && Number.isSafeInteger(r.responseBytes) && r.responseBytes >= 0 && r.responseBytes <= CONFIG.limits.aggregateBytes + CONFIG.limits.responseBytes);
  for (const [i, q] of r.requests.entries()) {
    keys(q, ['id', 'method', 'params', 'startedAt', 'completedAt', 'bytes', 'responseSha256', 'outcome']);
    check(q.id === i + 1); assertRequest(q.method, q.params, r.pin ? [r.pin] : []); time(q.startedAt); time(q.completedAt);
    check(Number.isSafeInteger(q.bytes) && q.bytes >= 0 && q.bytes <= CONFIG.limits.responseBytes + 1);
    if (q.responseSha256 !== null) check(/^[0-9a-f]{64}$/.test(q.responseSha256)); check(['RECEIVED', 'STOPPED'].includes(q.outcome));
    if (q.outcome === 'RECEIVED') check(q.bytes > 0 && q.bytes <= CONFIG.limits.responseBytes && q.responseSha256 !== null);
    if (q.outcome === 'STOPPED') check(i === r.requests.length - 1);
  }
  check(equal(r.requests.map((q) => [q.method, q.params]), requestPlan().slice(0, r.requests.length)));
  check(r.responseBytes === r.requests.reduce((sum, q) => sum + q.bytes, 0));
  if (r.requests.length <= 1 || (r.requests.length === 2 && r.requests[1].outcome === 'STOPPED')) check(r.pin === null);
  if (r.requests.length >= 3) check(r.pin !== null);
  // Exactly one accepted code followed by up to two accepted words. Only the
  // terminal RECEIVED data request can be either accepted or rejected semantically.
  const retained = r.dependencies.length + r.owners.length;
  const dataRequests = Math.min(Math.max(r.requests.length - 2, 0), 3);
  const terminalIsData = r.requests.length >= 3 && r.requests.length <= 5;
  const minimumAccepted = dataRequests - (terminalIsData ? 1 : 0);
  check(retained >= minimumAccepted && retained <= dataRequests);
  if (terminalIsData && r.requests.at(-1).outcome === 'STOPPED') check(retained === minimumAccepted);
  for (let i = 0; i < retained; i++) check(r.requests[i + 2] && r.requests[i + 2].outcome === 'RECEIVED');
  if (r.status === 'OBSERVED_WITH_CANONICAL_PIN') check(r.pin && r.dependencies.length === 1 && r.owners.length === 2 && r.requests.length === 7 && r.requests.every((q) => q.outcome === 'RECEIVED'));
  const raw = Buffer.from(JSON.stringify(r, null, 2) + '\n'); check(raw.length <= CONFIG.limits.reportBytes); return raw;
}

function reserveOutput(file) {
  check(typeof file === 'string' && path.isAbsolute(file) && path.extname(file) === '.json');
  const dir = path.dirname(file); check(fs.realpathSync(dir) === dir);
  return fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
}
async function main(argv = process.argv.slice(2)) {
  let fd, report, ethers;
  try {
    check(argv.length === 8 && argv[0] === '--dependency-root' && argv[2] === '--collector-commit' && argv[4] === '--output' && argv[6] === '--mode' && argv[7] === CONFIG.mode);
    report = newReport(argv[3]);
    fd = reserveOutput(argv[5]);
    checkEnvironment(process.env); check(process.versions.node === CONFIG.source.nodeVersion);
    ethers = loadEthers(argv[1]); check(equal(sourceIdentity(argv[1]), { commit: CONFIG.source.commit, tree: CONFIG.source.tree }));
    const collector = sourceIdentity(ROOT); check(collector.commit === argv[3]);
    report = await observe({ transport: makeHttpsTransport(), ethers, collectorCommit: collector.commit });
    fs.writeFileSync(fd, validateReport(report, ethers)); fs.fsyncSync(fd);
    if (report.status !== 'OBSERVED_WITH_CANONICAL_PIN') process.exitCode = 1;
  } catch {
    if (fd !== undefined && report) {
      try { report.status = 'STOPPED'; report.reason = 'OBSERVATION_STOPPED'; report.historicalNoFallback = null; report.completedAt = new Date().toISOString(); fs.writeFileSync(fd, validateReport(report, ethers)); fs.fsyncSync(fd); } catch { /* Do not print raw errors. */ }
    }
    process.stderr.write('OBSERVATION_STOPPED\n'); process.exitCode = 1;
  }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
module.exports = { CONFIG, FILES, strictJson, loadConfig, checkEnvironment, loadEthers, sourceIdentity, inventory, assertRequest, makeHttpsTransport, createClient, codeSummary, ownerSummary, requestPlan, observe, validateReport, reserveOutput, main };
if (require.main === module) main();
