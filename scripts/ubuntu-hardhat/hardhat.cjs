'use strict';
const path = require('node:path'), { createRequire } = require('node:module'), { pathToFileURL } = require('node:url');
const { need, sourceGuard } = require('./safety.cjs');
const https = require('node:https'), crypto = require('node:crypto');

function transmitOnce(url, raw) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID(), body = JSON.stringify({ jsonrpc: '2.0', id, method: 'eth_sendRawTransaction', params: [raw] });
    const request = https.request(url, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }, timeout: 30000 }, response => {
      let bytes = ''; response.setEncoding('utf8');
      response.setTimeout(30000, () => response.destroy());
      response.on('data', part => { bytes += part; if (bytes.length > 65536) response.destroy(); });
      response.on('error', () => reject(Error('SUBMISSION_UNCERTAIN')));
      response.on('aborted', () => reject(Error('SUBMISSION_UNCERTAIN')));
      response.on('end', () => {
        try { const result = JSON.parse(bytes); need(response.statusCode === 200 && result.jsonrpc === '2.0' && result.id === id && !result.error && /^0x[0-9a-f]{64}$/.test(result.result), 'SUBMISSION_UNCERTAIN'); resolve(result.result); }
        catch { reject(Error('SUBMISSION_UNCERTAIN')); }
      });
    });
    request.on('timeout', () => request.destroy()); request.on('error', () => reject(Error('SUBMISSION_UNCERTAIN'))); request.end(body);
  });
}

// Hardhat's public HRE API. No source config import, dotenv, default accounts,
// unlocked signer, wallet plugin, compilation, telemetry task or child signer.
async function connectHardhat(root, url) {
  const guard = sourceGuard(root, 'manager');
  const requireNative = createRequire(path.join(root, 'package.json'));
  need(requireNative('hardhat/package.json').version === '3.17.0' && requireNative('ethers').version === '6.17.0', 'QUALIFIED_DEPENDENCIES_REQUIRED');
  const { createHardhatRuntimeEnvironment } = await import(pathToFileURL(requireNative.resolve('hardhat/hre')).href);
  const hre = await createHardhatRuntimeEnvironment({ networks: { production: { type: 'http', chainType: 'l1', chainId: 1, url, accounts: [], timeout: 30000 } } }, { network: 'production' }, root);
  const connection = await hre.network.create('production');
  const E = requireNative('ethers');
  const allowed = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_getCode', 'eth_getBalance', 'eth_getTransactionCount', 'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_call', 'eth_getLogs', 'eth_getStorageAt', 'eth_estimateGas']);
  const rpc = (method, params) => { need(allowed.has(method), 'READ_PROVIDER_METHOD_FORBIDDEN'); return connection.provider.request({ method, params }); };
  const provider = new E.BrowserProvider({ request: ({ method, params }) => rpc(method, params) }, undefined, { cacheTimeout: -1 });
  // Hardhat HTTP retries rate-limit responses. Keep broadcast out of that retry
  // path: this isolated HTTPS POST has no retries or redirects of any kind.
  return { hre, E, provider, rpc, transmit: raw => transmitOnce(url, raw), assert: guard.assert, close: async () => { provider.destroy(); await connection.close(); } };
}
module.exports = { connectHardhat, transmitOnce };
