'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), https = require('node:https'), tls = require('node:tls'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const { transmitOnce } = require('../hardhat.cjs');
test('broadcast uses one verified HTTPS request; 429, 503, redirects, wrong id and RPC errors never retry', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ubuntu-hardhat-tls-')), cert = path.join(dir, 'cert.pem'), key = path.join(dir, 'tls.pem'), originalCa = tls.getCACertificates('default');
  let server, requests = 0, mode = 'success';
  try {
    cp.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=Disposable HTTP transport fixture', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
    server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (request, response) => {
      requests++; let body = ''; request.on('data', b => { body += b; }); request.on('end', () => {
        const message = JSON.parse(body); assert.equal(message.method, 'eth_sendRawTransaction');
        if (mode === 'success') return response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: '0x' + 'ab'.repeat(32) }));
        if (mode === 'wrong-id') return response.end(JSON.stringify({ jsonrpc: '2.0', id: 'wrong', result: '0x' + 'ab'.repeat(32) }));
        if (mode === 'rpc-error') return response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { message: 'PRIVATE_DIAGNOSTIC' } }));
        response.writeHead(Number(mode), { 'Retry-After': '0', Location: '/redirect' }); response.end('{}');
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const url = `https://127.0.0.1:${server.address().port}`;
    await assert.rejects(transmitOnce(url, '0x02')); assert.equal(requests, 0, 'Untrusted CA must fail before HTTP');
    tls.setDefaultCACertificates([...originalCa, fs.readFileSync(cert, 'utf8')]);
    assert.equal(await transmitOnce(url, '0x02'), '0x' + 'ab'.repeat(32)); assert.equal(requests, 1);
    for (mode of ['429', '503', '302', 'wrong-id', 'rpc-error']) {
      const before = requests; await assert.rejects(transmitOnce(url, '0x02'), error => error.message === 'SUBMISSION_UNCERTAIN'); assert.equal(requests, before + 1);
    }
  } finally { tls.setDefaultCACertificates(originalCa); if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }); fs.rmSync(dir, { recursive: true }); }
});
