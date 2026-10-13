import fs from 'node:fs';
import { createServer } from 'node:http';
import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { fail, canonical, parseStrict, keys, publicOnly } from '../../site/assets/successor/safe.mjs';

const digest = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
export const sign = (secret, value) => createHmac('sha256', secret).update(typeof value === 'string' ? value : canonical(value)).digest('hex');
function equal(a, b) { return typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
export function privateFile(file, create = false) {
  if (create && !fs.existsSync(file)) fs.writeFileSync(file, '', { mode: 0o600, flag: 'wx' });
  const stat = fs.lstatSync(file); fail(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0 && (process.getuid === undefined || stat.uid === process.getuid()), 'PRIVATE_FILE');
}
export function loadJournal(file) {
  privateFile(file, true); fail(fs.statSync(file).size <= 2_000_000, 'JOURNAL_LIMIT');
  const raw = fs.readFileSync(file, 'utf8'); fail(!raw || raw.endsWith('\n'), 'JOURNAL_TORN');
  const entries = raw.trim() ? raw.trim().split('\n').map(line => parseStrict(line, 4000)) : [];
  for (const [i, event] of entries.entries()) {
    keys(event, ['sequence', 'previous', 'action', 'timestamp', 'sha256'], 'JOURNAL_FIELDS'); const { sha256, ...body } = event;
    fail(event.sequence === i && event.previous === (i ? entries[i - 1].sha256 : null) && sha256 === digest(body), 'JOURNAL_CHANGED');
  }
  return entries;
}
export async function startWorker({ pairingSecret, journalPath, driver, maxCalls = 24, maxSeconds = 120, now = Date.now, port = 0 }) {
  fail(/^[a-f0-9]{64}$/.test(pairingSecret), 'PAIRING_SECRET');
  fail(Number.isInteger(maxCalls) && maxCalls >= 1 && maxCalls <= 100 && Number.isInteger(maxSeconds) && maxSeconds >= 1 && maxSeconds <= 600, 'WORKER_LIMITS');
  const journal = loadJournal(journalPath); let session = null, busy = false, frame = null, frameAt = 0, revoked = journal.some(e => e.action === 'revoke'), used = journal.filter(e => e.action.startsWith('attempt:')).length;
  const firstAttempt = journal.find(e => e.action.startsWith('attempt:'))?.timestamp;
  const started = firstAttempt || now(), runtimeSha256 = digest({ source: digest(fs.readFileSync(new URL('./worker.mjs', import.meta.url), 'utf8')), driver: driver.identity, capabilities: ['screenshot', 'type', 'click'], isolation: 'local-fixture-only', maxCalls, maxSeconds });
  function append(action) {
    const body = { sequence: journal.length, previous: journal.at(-1)?.sha256 || null, action, timestamp: now() }, event = { ...body, sha256: digest(body) };
    privateFile(journalPath); const fd = fs.openSync(journalPath, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW);
    try { fs.writeSync(fd, canonical(event) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } journal.push(event);
  }
  const consume = action => { fail(!revoked, 'WORKER_REVOKED'); fail(used < maxCalls && now() - started < maxSeconds * 1000, 'WORKER_BUDGET'); append('attempt:' + action); used++; };
  async function bounded(action) {
    let timer;
    try { return await Promise.race([action(), new Promise((resolve, reject) => { timer = setTimeout(() => { revoked = true; frame = null; append('revoke'); void driver.stop(); reject(Object.assign(new Error('WORKER_TIMEOUT'), { code: 'WORKER_TIMEOUT' })); }, Math.max(1, Math.min(3000, maxSeconds * 1000 - (now() - started)))); })]); }
    finally { clearTimeout(timer); }
  }
  const server = createServer(async (req, res) => {
    let authenticated = false, responseKey, counter;
    const send = (status, data) => {
      const raw = canonical(data); res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
      if (authenticated) res.setHeader('X-Response-Mac', sign(responseKey, { counter, status, body: raw })); res.writeHead(status).end(raw);
    };
    try {
      fail(req.headers.host === `127.0.0.1:${server.address().port}` && req.socket.remoteAddress === '127.0.0.1' && !req.headers.origin && !req.headers['sec-fetch-site'], 'WORKER_ORIGIN');
      fail(req.method === 'POST' && ['/pair', '/capabilities', '/observe', '/act', '/stop'].includes(req.url) && req.headers['content-type'] === 'application/json', 'WORKER_ROUTE');
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; fail(size <= 4096, 'WORKER_BODY'); chunks.push(chunk); }
      const raw = Buffer.concat(chunks).toString('utf8'), body = parseStrict(raw, 4096);
      if (req.url === '/pair') {
        keys(body, ['nonce'], 'PAIR_FIELDS'); fail(!session && !revoked && /^[a-f0-9]{64}$/.test(body.nonce) && !journal.some(e => e.action === 'paired:' + digest(body.nonce)) && equal(req.headers['x-pair-secret'], pairingSecret), 'PAIRING_DENIED');
        const nonce = randomBytes(32).toString('hex'), sessionId = randomBytes(24).toString('hex'), sessionKey = sign(pairingSecret, { client: body.nonce, server: nonce, session: sessionId });
        session = { id: sessionId, key: sessionKey, counter: 0, expiresAt: now() + 120000 }; const response = { session: sessionId, nonce, expiresAt: session.expiresAt, runtimeSha256 };
        append('paired:' + digest(body.nonce)); send(200, { ...response, mac: sign(pairingSecret, response) }); return;
      }
      counter = Number(req.headers['x-counter']); responseKey = session?.key;
      fail(session && equal(req.headers['x-session'], session.id) && Number.isSafeInteger(counter) && counter === session.counter + 1 && now() < session.expiresAt, 'WORKER_SESSION');
      fail(equal(req.headers['x-request-mac'], sign(session.key, { counter, method: req.method, route: req.url, body: raw })), 'WORKER_MAC');
      // Consume the sequence before any response or mutation; lost responses are not replayed.
      session.counter = counter; authenticated = true;
      if (req.url === '/stop') { keys(body, [], 'STOP_FIELDS'); revoked = true; frame = null; append('revoke'); await driver.stop(); send(200, { stopped: true, authority: 'revoked' }); return; }
      fail(!busy && !revoked, revoked ? 'WORKER_REVOKED' : 'WORKER_BUSY');
      if (req.url === '/capabilities') {
        keys(body, [], 'CAPABILITY_FIELDS'); send(200, { schema: 'successor-worker/v1', runtimeSha256, driver: driver.identity, capabilities: ['screenshot', 'type', 'click'], permissions: { scope: 'local-fixture-only', network: false, nativeDesktop: false, signer: false }, budgets: { maxCalls, used, maxSeconds, started, spendUSDC: '0', retries: 0, concurrency: 1 }, independentController: false, provider: 'fixture', ready: used < maxCalls && now() - started < maxSeconds * 1000, expiresAt: session.expiresAt }); return;
      }
      busy = true;
      try {
        if (req.url === '/observe') {
          keys(body, [], 'OBSERVE_FIELDS'); frame = null; consume('observe');
          const observation = await bounded(() => driver.observe()); fail(observation && typeof observation.png === 'string' && observation.png.length <= 1_400_000, 'OBSERVATION'); fail(!revoked, 'WORKER_REVOKED');
          frame = randomBytes(16).toString('hex'); frameAt = now(); send(200, { frame, observedAt: frameAt, expiresAt: frameAt + 5000, screenshotBase64: observation.png, state: observation.state, used });
        } else {
          keys(body, ['frame', 'action', 'value'], 'ACTION_FIELDS'); fail(frame && body.frame === frame && now() - frameAt <= 5000, 'STALE_OBSERVATION');
          fail(['type', 'click'].includes(body.action) && typeof body.value === 'string' && body.value.length <= 200 && (body.action !== 'click' || body.value === ''), 'ACTION_DENIED'); publicOnly(body.value);
          frame = null; consume(body.action); await bounded(() => driver.act(body.action, body.value)); fail(!revoked, 'WORKER_REVOKED'); send(200, { outcome: 'performed', observationRequired: true, used });
        }
      } finally { busy = false; }
    } catch (error) { frame = null; send(403, { code: error.code || 'WORKER_FAILURE', stopped: revoked, previousObservationInvalid: true }); }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.maxConnections = 8;
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, runtimeSha256, close: async () => { revoked = true; frame = null; await driver.stop(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}

export async function createClient(url, secret) {
  const endpoint = new URL(url); fail(endpoint.protocol === 'http:' && endpoint.hostname === '127.0.0.1' && endpoint.port && endpoint.pathname === '/' && !endpoint.search && !endpoint.hash && !endpoint.username && !endpoint.password, 'WORKER_ENDPOINT');
  const clientNonce = randomBytes(32).toString('hex');
  const request = async (route, body, headers = {}) => fetch(new URL(route, endpoint), { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000), headers: { 'content-type': 'application/json', ...headers }, body });
  const response = await request('/pair', canonical({ nonce: clientNonce }), { 'x-pair-secret': secret }), paired = await response.json();
  fail(response.ok && paired.mac && equal(paired.mac, sign(secret, { session: paired.session, nonce: paired.nonce, expiresAt: paired.expiresAt, runtimeSha256: paired.runtimeSha256 })), 'PAIRING_RESPONSE');
  const key = sign(secret, { client: clientNonce, server: paired.nonce, session: paired.session }); let counter = 0, uncertain = false;
  return { runtimeSha256: paired.runtimeSha256, call: async (route, data = {}) => {
    fail(!uncertain && ['/capabilities', '/observe', '/act', '/stop'].includes(route), 'CLIENT_UNCERTAIN'); const body = canonical(data), sequence = ++counter;
    try {
      const result = await request(route, body, { 'x-session': paired.session, 'x-counter': String(sequence), 'x-request-mac': sign(key, { counter: sequence, method: 'POST', route, body }) });
      const raw = await result.text(); fail(raw.length <= 1_500_000 && equal(result.headers.get('x-response-mac'), sign(key, { counter: sequence, status: result.status, body: raw })), 'RESPONSE_AUTHENTICATION');
      const payload = parseStrict(raw, 1_500_000); if (!result.ok) { const error = new Error(payload.code); error.code = payload.code; throw error; } return payload;
    } catch (error) { if (!error.code || error.code === 'RESPONSE_AUTHENTICATION') uncertain = true; throw error; }
  } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.error('Use npm run successor:rehearse for the fixture worker. This module does not launch a native desktop, provider or wallet.');
}
