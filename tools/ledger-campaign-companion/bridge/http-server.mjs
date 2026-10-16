import http from 'node:http';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { BridgeError, exactFields, publicError, reject } from './errors.mjs';

const BODY_LIMIT = 400 * 1024;
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const countHeader = (request, name) => request.rawHeaders.filter((_value, index) => index % 2 === 0 && request.rawHeaders[index].toLowerCase() === name).length;
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function body(request) {
  if (request.headers['content-type'] !== 'application/json' || request.headers['content-encoding'] !== undefined || request.headers['transfer-encoding'] !== undefined || countHeader(request, 'content-length') !== 1 || !/^(0|[1-9][0-9]{0,6})$/.test(request.headers['content-length'] ?? '') || Number(request.headers['content-length']) > BODY_LIMIT) reject('INVALID_REQUEST');
  const chunks = []; let length = 0;
  for await (const chunk of request) { length += chunk.length; if (length > BODY_LIMIT) reject('REQUEST_TOO_LARGE'); chunks.push(chunk); }
  if (length !== Number(request.headers['content-length'])) reject('INVALID_REQUEST');
  let parsed; try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { reject('INVALID_REQUEST'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) reject('INVALID_REQUEST');
  return parsed;
}
function headers(response, { signer, parentOrigin, signerOrigin, api = false }) {
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('Pragma', 'no-cache'); response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', signer
    ? `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; frame-ancestors ${parentOrigin}`
    : `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src ${signerOrigin}; frame-ancestors 'none'`);
  response.setHeader('Permissions-Policy', signer ? 'hid=(self), bluetooth=(), usb=(), camera=(), microphone=(), geolocation=()' : `hid=(self "${signerOrigin}"), bluetooth=(), usb=(), camera=(), microphone=(), geolocation=()`);
  if (!signer) response.setHeader('X-Frame-Options', 'DENY');
  if (api) response.setHeader('Content-Type', 'application/json; charset=utf-8');
}
const send = (response, status, value) => { response.statusCode = status; response.end(JSON.stringify(value)); };
function listen(server, port) { return new Promise((resolve, rejectListen) => { server.once('error', rejectListen); server.listen({ host: '127.0.0.1', port, exclusive: true }, () => { server.removeListener('error', rejectListen); resolve(server.address().port); }); }); }
function shutdownControl(server) {
  const sockets = new Map(); let stopping = false, completion;
  server.on('connection', socket => {
    sockets.set(socket, 0); socket.once('close', () => sockets.delete(socket));
    if (stopping) socket.destroy();
  });
  server.prependListener('request', (request, response) => {
    const socket = request.socket;
    sockets.set(socket, (sockets.get(socket) ?? 0) + 1);
    let finished = false;
    const release = () => {
      if (finished) return; finished = true;
      const count = Math.max(0, (sockets.get(socket) ?? 1) - 1);
      if (!socket.destroyed) sockets.set(socket, count);
      if (stopping && count === 0) socket.destroySoon();
    };
    response.once('finish', release); response.once('close', release);
  });
  return () => {
    if (completion) return completion;
    stopping = true;
    completion = new Promise(resolve => { server.close(() => resolve()); });
    server.closeIdleConnections?.();
    // Browser preconnect sockets have not sent a request and are not always
    // classified as idle HTTP connections by Node. They must not block restart.
    // Accepted requests drain first; their durable signing/relay state is owned
    // by the engine and is never changed or retried by transport shutdown.
    for (const [socket, active] of sockets) if (active === 0) socket.destroy();
    return completion;
  };
}

export async function createBridgeServer({ engine, staticRoot, port = 0, signerPort = 0, sessionTtlMs = 15 * 60 * 1000, now = Date.now }) {
  if (![port, signerPort].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 65535) || !Number.isSafeInteger(sessionTtlMs) || sessionTtlMs < 1000 || sessionTtlMs > 60 * 60 * 1000) reject('INVALID_SERVER_CONFIGURATION');
  const directory = await fs.realpath(staticRoot); let parentOrigin, signerOrigin, token = null, tokenExpiry = 0;
  const routeMethods = { '/api/status': 'status', '/api/prepare': 'prepare', '/api/import': 'importSigned', '/api/observe': 'observe', '/api/relay': 'relayOne', '/api/report': 'report' };
  const parentFiles = new Map([['/', 'campaign.html'], ['/campaign.html', 'campaign.html'], ['/campaign-app.js', 'campaign-app.js'], ['/campaign.css', 'campaign.css']]);
  const signerFiles = new Map([['/campaign-signer.html', 'campaign-signer.html'], ['/campaign-signer.js', 'campaign-signer.js'], ['/campaign.css', 'campaign.css']]);
  const handler = signer => async (request, response) => {
    headers(response, { signer, parentOrigin, signerOrigin, api: request.url?.startsWith('/api/') });
    try {
      const origin = signer ? signerOrigin : parentOrigin;
      if (countHeader(request, 'host') !== 1 || request.headers.host !== new URL(origin).host || !['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress) || typeof request.url !== 'string' || !request.url.startsWith('/') || request.url.startsWith('//') || /[?#\\\x00-\x20]/.test(request.url)) reject('INVALID_REQUEST');
      if (!signer && request.url.startsWith('/api/')) {
        if (request.method !== 'POST' || countHeader(request, 'origin') !== 1 || request.headers.origin !== parentOrigin || request.headers['x-companion-request'] !== '1' || countHeader(request, 'x-companion-request') !== 1) reject('ORIGIN_OR_METHOD_REJECTED');
        const data = await body(request);
        if (request.url === '/api/session') {
          exactFields(data, []); token = randomBytes(32).toString('hex'); tokenExpiry = now() + sessionTtlMs;
          send(response, 200, { token, expiresAt: new Date(tokenExpiry).toISOString() }); return;
        }
        if (!token || now() >= tokenExpiry || countHeader(request, 'authorization') !== 1 || !equal(request.headers.authorization, `Bearer ${token}`)) reject('SESSION_REQUIRED');
        const method = routeMethods[request.url]; if (!method) reject('INVALID_REQUEST');
        if (['status', 'report'].includes(method)) exactFields(data, []);
        const result = await engine[method](data);
        send(response, 200, ['status', 'report'].includes(method) ? { ...result, signerOrigin } : result); return;
      }
      const files = signer ? signerFiles : parentFiles;
      if (request.method !== 'GET' || !files.has(request.url)) reject('INVALID_REQUEST');
      const filename = path.join(directory, files.get(request.url)), stat = await fs.lstat(filename);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 * 1024) reject('STATIC_FILE_REJECTED');
      let bytes = await fs.readFile(filename);
      if (filename.endsWith('.html')) {
        let html = bytes.toString('utf8').replaceAll('__SIGNER_PORT__', new URL(signerOrigin).port).replaceAll('__CAMPAIGN_PARENT_ORIGIN__', parentOrigin);
        if (!signer) html = html.replace('</head>', `<meta name="signer-origin" content="${signerOrigin}"></head>`);
        bytes = Buffer.from(html);
      }
      response.setHeader('Content-Type', contentTypes[path.extname(filename)]); response.statusCode = 200; response.end(bytes);
    } catch (error) { if (!response.headersSent) { response.setHeader('Content-Type', 'application/json; charset=utf-8'); send(response, error instanceof BridgeError && error.code === 'SESSION_REQUIRED' ? 401 : 400, publicError(error)); } else response.destroy(); }
  };
  const parent = http.createServer({ maxHeaderSize: 8192 }, handler(false)), signer = http.createServer({ maxHeaderSize: 8192 }, handler(true));
  const stopParent = shutdownControl(parent), stopSigner = shutdownControl(signer);
  for (const server of [parent, signer]) {
    server.requestTimeout = 15_000; server.headersTimeout = 10_000; server.keepAliveTimeout = 1000;
    server.on('clientError', (_error, socket) => { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); });
  }
  try {
    parentOrigin = `http://127.0.0.1:${await listen(parent, port)}`;
    signerOrigin = `http://127.0.0.1:${await listen(signer, signerPort)}`;
  } catch (error) { await Promise.all([stopParent(), stopSigner()]); throw error; }
  return Object.freeze({ parentOrigin, signerOrigin, close: async () => { token = null; tokenExpiry = 0; await Promise.all([stopParent(), stopSigner()]); } });
}
