import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes, createHash } from 'node:crypto';
import { browserDriver } from './browser-driver.mjs';
import { startWorker, createClient, loadJournal } from './worker.mjs';
import { fail } from '../../site/assets/successor/safe.mjs';

const output = path.resolve(process.argv[2] || 'build/successor-rehearsal');
fail(!fs.existsSync(output), 'OUTPUT_EXISTS'); fs.mkdirSync(output, { recursive: true });
const privateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'successor-worker-'));
let worker;
try {
  const secret = randomBytes(32).toString('hex'), driver = await browserDriver(process.env.SUCCESSOR_CHROMIUM ? { executablePath: process.env.SUCCESSOR_CHROMIUM, args: ['--no-sandbox'] } : {});
  worker = await startWorker({ pairingSecret: secret, journalPath: path.join(privateDirectory, 'attempts.jsonl'), driver });
  const client = await createClient(worker.url, secret), capabilities = await client.call('/capabilities');
  fail(capabilities.runtimeSha256 === worker.runtimeSha256 && capabilities.provider === 'fixture' && capabilities.permissions.signer === false, 'HANDSHAKE');
  const before = await client.call('/observe'); await client.call('/act', { frame: before.frame, action: 'type', value: 'Public learning garden' });
  let staleRejected = false; try { await client.call('/act', { frame: before.frame, action: 'click', value: '' }); } catch (error) { staleRejected = error.code === 'STALE_OBSERVATION'; }
  const typed = await client.call('/observe'); await client.call('/act', { frame: typed.frame, action: 'click', value: '' }); const after = await client.call('/observe');
  // Checker uses exact expected original input, not the worker's success label.
  const checked = after.state.title === 'Public learning garden' && after.state.result === ['Project:', 'Public learning garden'].join(' ');
  fail(checked && staleRejected, 'REHEARSAL_CHECK');
  await client.call('/stop'); let revoked = false; try { await client.call('/observe'); } catch (error) { revoked = error.code === 'WORKER_REVOKED'; } fail(revoked, 'REVOCATION');
  const screenshot = Buffer.from(after.screenshotBase64, 'base64'); fs.writeFileSync(path.join(output, 'result.png'), screenshot);
  const evidence = { schema: 'successor-browser-rehearsal/v1', provider: 'fixture', liveProvider: false, independentController: false, nativeMac: false, runtimeSha256: worker.runtimeSha256, driver: driver.identity, checks: { actualKeyboardInput: true, actualPointerClick: true, outputChecked: checked, staleFrameRejected: staleRejected, revocationStopsFutureDispatch: revoked }, output: after.state, screenshotSha256: createHash('sha256').update(screenshot).digest('hex'), attempts: loadJournal(path.join(privateDirectory, 'attempts.jsonl')).filter(e => e.action.startsWith('attempt:')).length, payments: 'none', qualification: 'not-evaluated', liveCommissioning: ['actual provider access and bills', 'commissioned runtime and isolated resources', 'independently controlled reviewer', 'signed principal grant and current admission', 'real-machine recovery and supervision evidence'] };
  fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n'); console.log(JSON.stringify(evidence, null, 2));
} finally { await worker?.close(); fs.rmSync(privateDirectory, { recursive: true, force: true }); }
