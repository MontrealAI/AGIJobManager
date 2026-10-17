'use strict';
// TEST ONLY. Local canonical-number bridge is not public EIP-1898/finality evidence.
const fs = require('node:fs'), path = require('node:path'), https = require('node:https');
const crypto = require('node:crypto'), { execFileSync } = require('node:child_process');
const READ_METHODS = new Set(['eth_chainId', 'eth_getCode', 'eth_getTransactionCount', 'eth_getBlockByNumber', 'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_call', 'eth_estimateGas']);
const FAILURES = new Set(['malformed', 'redirect', 'oversized', 'timeout', 'error', 'wrong-id', 'accept-drop']);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function createEphemeralTls(directory) {
  fs.mkdirSync(directory, { mode: 0o700 });
  const p = name => path.join(directory, name);
  fs.writeFileSync(p('extensions.cnf'), 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1,DNS:localhost\n', { flag: 'wx', mode: 0o600 });
  const run = args => execFileSync('openssl', args, { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] });
  run(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '1', '-subj', '/CN=Manager disposable native fixture CA', '-keyout', p('ca.key'), '-out', p('ca.pem'), '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
  run(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-subj', '/CN=127.0.0.1', '-keyout', p('server.key'), '-out', p('server.csr')]);
  run(['x509', '-req', '-in', p('server.csr'), '-CA', p('ca.pem'), '-CAkey', p('ca.key'), '-set_serial', '0x' + crypto.randomBytes(16).toString('hex'), '-out', p('server.pem'), '-days', '1', '-sha256', '-extfile', p('extensions.cnf')]);
  for (const file of fs.readdirSync(directory)) fs.chmodSync(p(file), 0o600);
  // Signing the server certificate finishes the CA's work; retain only public CA.
  fs.unlinkSync(p('ca.key'));
  return { caFile: p('ca.pem'), caSha256: hash(fs.readFileSync(p('ca.pem'))), key: fs.readFileSync(p('server.key')), cert: fs.readFileSync(p('server.pem')),
    dispose() { for (const name of ['server.key', 'server.csr', 'extensions.cnf']) if (fs.existsSync(p(name))) fs.unlinkSync(p(name)); } };
}
async function createNativeCoreRpc({ rpc, directory }) {
  const tls = createEphemeralTls(directory), sockets = new Set();
  const counts = { read: {}, relay: {}, backendRawSubmissions: 0, forbidden: 0 };
  const adaptations = [], requests = [], interruptions = [], hooks = [], faults = { read: [], relay: [] };
  async function bridged(method, params) {
    params = structuredClone(params);
    if (method === 'eth_getBlockByNumber' && params[0] === 'finalized') {
      adaptations.push({ kind: 'LOCAL_FINALIZED_TO_LATEST', method }); params[0] = 'latest';
    }
    const at = params.at(-1);
    if (at && typeof at === 'object' && at.requireCanonical === true) {
      const before = await rpc('eth_getBlockByHash', [at.blockHash, false]);
      if (!before || (await rpc('eth_getBlockByNumber', [before.number, false]))?.hash !== at.blockHash) throw Error('Requested local block is not canonical.');
      const result = await rpc(method, [...params.slice(0, -1), before.number]);
      if ((await rpc('eth_getBlockByNumber', [before.number, false]))?.hash !== at.blockHash) throw Error('Local canonical block changed during adapted read.');
      adaptations.push({ kind: 'LOCAL_CANONICAL_HASH_TO_NUMBER', method, blockHash: at.blockHash, blockNumber: before.number });
      return result;
    }
    return rpc(method, params);
  }
  function serverFor(kind) {
    const server = https.createServer({ key: tls.key, cert: tls.cert, minVersion: 'TLSv1.2' }, async (request, response) => {
      try {
        if (request.method !== 'POST' || request.url !== '/') { response.writeHead(405).end(); return; }
        let size = 0; const chunks = [];
        for await (const chunk of request) { size += chunk.length; if (size > 256 * 1024) throw Error('Fixture request exceeds bound.'); chunks.push(chunk); }
        const body = JSON.parse(Buffer.concat(chunks));
        if (!body || body.jsonrpc !== '2.0' || !Number.isSafeInteger(body.id) || !Array.isArray(body.params)) throw Error('Malformed fixture request.');
        counts[kind][body.method] = (counts[kind][body.method] || 0) + 1;
        requests.push({ endpoint: kind, method: body.method, id: body.id }); // Deliberately excludes raw bytes and private keys.
        const allowed = kind === 'read' ? READ_METHODS.has(body.method) : body.method === 'eth_sendRawTransaction' && body.params.length === 1;
        if (!allowed) { counts.forbidden++; throw Error('Method forbidden at this isolated endpoint.'); }
        const index = faults[kind].findIndex(f => !f.method || f.method === body.method);
        const fault = index < 0 ? null : faults[kind].splice(index, 1)[0];
        const json = value => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)); };
        if (fault) {
          if (fault.kind === 'redirect') { response.writeHead(307, { location: 'https://127.0.0.1:1/' }).end(); return; }
          if (fault.kind === 'malformed') { response.writeHead(200).end('{'); return; }
          if (fault.kind === 'oversized') { response.writeHead(200, { 'content-length': String(3 * 1024 * 1024) }); response.end('x'.repeat(70000)); return; }
          if (fault.kind === 'timeout') return; // Production's unchanged 20-second deadline must abort this socket.
          if (fault.kind === 'error') { json({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: 'Injected disposable fixture error' } }); return; }
          if (fault.kind === 'wrong-id') { json({ jsonrpc: '2.0', id: body.id + 1, result: null }); return; }
          if (fault.kind === 'accept-drop') {
            if (kind !== 'relay') throw Error('Accept/drop is relay-only.');
            counts.backendRawSubmissions++; await rpc(body.method, body.params); request.socket.destroy(); return;
          }
        }
        if (kind === 'relay') counts.backendRawSubmissions++;
        const result = await (kind === 'read' ? bridged(body.method, body.params) : rpc(body.method, body.params));
        const hookIndex = hooks.findIndex(h => h.endpoint === kind && h.method === body.method);
        if (hookIndex >= 0) { const hook = hooks.splice(hookIndex, 1)[0]; await hook.callback(); interruptions.push({ endpoint: kind, method: body.method, label: hook.label }); }
        json({ jsonrpc: '2.0', id: body.id, result });
      } catch (error) { if (!response.destroyed) { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message: error.message } })); } }
    });
    server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    return server;
  }
  const servers = { read: serverFor('read'), relay: serverFor('relay') };
  try { for (const server of Object.values(servers)) await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); }
  catch (error) { for (const server of Object.values(servers)) server.close(); tls.dispose(); throw error; }
  const endpoints = Object.fromEntries(Object.entries(servers).map(([kind, server]) => [kind, `https://127.0.0.1:${server.address().port}/`]));
  return { endpoints, caFile: tls.caFile, caSha256: tls.caSha256,
    inject(endpoint, fault) { if (!faults[endpoint] || !FAILURES.has(fault.kind)) throw Error('Unknown fixture fault.'); faults[endpoint].push({ ...fault }); },
    onceBeforeReply(endpoint, method, label, callback) { if (!faults[endpoint] || typeof callback !== 'function') throw Error('Invalid fixture interruption hook.'); hooks.push({ endpoint, method, label, callback }); },
    snapshot() { return structuredClone({ counts, adaptations, requests, interruptions, tls: { childOnlyExtraCa: true, certificateVerificationEnabled: true, caSha256: tls.caSha256 }, localOnly: true, publicProviderQualified: false }); },
    async close() { for (const socket of sockets) socket.destroy(); await Promise.all(Object.values(servers).map(server => new Promise(resolve => server.close(resolve)))); tls.dispose(); },
  };
}
module.exports = { createEphemeralTls, createNativeCoreRpc, READ_METHODS };
