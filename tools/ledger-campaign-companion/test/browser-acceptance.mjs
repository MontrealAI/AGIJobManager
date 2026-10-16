import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, mkdir, writeFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Transaction, SigningKey, computeAddress, keccak256 } from 'ethers';
import { policyDigest } from '../src/envelope.mjs';
import { buildBrowserFixture } from '../scripts/browser-build.mjs';
const require = createRequire(import.meta.url);
const packagePath = require.resolve('playwright', { paths: [resolve('scripts/browser-toolchain')] });
const module = await import(pathToFileURL(packagePath));
const { chromium } = module.default ?? module;
const version = require(require.resolve('playwright/package.json', { paths: [resolve('scripts/browser-toolchain')] })).version;
assert.equal(version, '1.62.1', 'EXACT_PLAYWRIGHT_VERSION_REQUIRED');
const results = [];
const CASE_TIMEOUT_MS = 60000;
let acceptanceTimedOut = false, evidenceWrites = Promise.resolve();
const evidence = { schema: 'ledger-companion-browser-evidence-v1', playwright: version, chromiumSandbox: true, syntheticDeviceOnly: true, incrementalReporting: true, caseTimeoutMs: CASE_TIMEOUT_MS, physicalAcceptance: 'NOT_PERFORMED', sourceCommit: /^[a-f0-9]{40}$/.test(process.env.COMPANION_SOURCE_COMMIT ?? '') ? process.env.COMPANION_SOURCE_COMMIT : null, workflowRunId: /^[0-9]+$/.test(process.env.GITHUB_RUN_ID ?? '') ? process.env.GITHUB_RUN_ID : null, tests: results };
const evidenceDirectory = resolve(process.env.COMPANION_BROWSER_EVIDENCE ?? 'manual-ledger-evidence');
await mkdir(evidenceDirectory, { recursive: true });
const directory = await mkdtemp(resolve(tmpdir(), 'companion-browser-'));
let browser, server;
const rawMarkers = new Set(['PRIVATE_DEVICE_RESPONSE_MUST_NOT_APPEAR_0xdeadbeef']);
const logs = [], remoteRequests = [], errors = [];
async function persistEvidence() {
  evidence.passCount = results.filter(value => value.status === 'PASS').length;
  evidence.failCount = results.filter(value => value.status === 'FAIL').length;
  const body = `${JSON.stringify(evidence, null, 2)}\n`;
  evidenceWrites = evidenceWrites.then(async () => { const pending = resolve(evidenceDirectory, '.browser-acceptance.pending.json'); await writeFile(pending, body, { mode: 0o600 }); await rename(pending, resolve(evidenceDirectory, 'browser-acceptance.json')); });
  return evidenceWrites;
}
async function timedStop(name, failureKind) {
  if (acceptanceTimedOut) return;
  acceptanceTimedOut = true; evidence.status = 'FAIL'; evidence.harness = failureKind;
  if (name) { evidence.activeCase = name; results.push({ name, status: 'FAIL', failureKind }); }
  try { await persistEvidence(); } catch { /* The last complete source-bound progress file remains authoritative. */ }
  process.stdout.write(`Browser acceptance stopped: ${failureKind}${name ? ` (${name})` : ''}; no physical device operation.\n`);
  process.exit(2);
}
async function test(name, fn) {
  evidence.status = 'RUNNING'; evidence.phase = 'case'; evidence.activeCase = name; await persistEvidence();
  const watchdog = setTimeout(() => { void timedStop(name, 'TEST_CASE_TIMEOUT'); }, CASE_TIMEOUT_MS);
  try { await fn(); if (!acceptanceTimedOut) results.push({ name, status: 'PASS' }); }
  catch (error) { if (!acceptanceTimedOut) { results.push({ name, status: 'FAIL', failureKind: error?.code === 'ERR_ASSERTION' ? 'ASSERTION_FAILED' : error?.name === 'TimeoutError' ? 'BROWSER_WAIT_TIMED_OUT' : 'TEST_OPERATION_FAILED' }); process.stdout.write(`Browser case failed: ${name}\n`); process.exitCode = 1; } }
  finally { clearTimeout(watchdog); if (!acceptanceTimedOut) { delete evidence.activeCase; await persistEvidence(); } }
}
const sender = computeAddress(new SigningKey(`0x${'19'.repeat(32)}`).publicKey);
function packet({ data = '0x60006000f3', expiry = Date.now() + 3600000 } = {}) {
  const unsigned = Transaction.from({ type: 2, chainId: 1, nonce: 1, to: null, data, value: 0, gasLimit: 16000000, maxFeePerGas: 10000000000n, maxPriorityFeePerGas: 1000000000n, accessList: [] }).unsignedSerialized;
  const review = { chainId: '1', expectedSender: sender, expiresAt: new Date(expiry).toISOString(), maxGasLimit: '16777216', maxFeePerGas: '20000000000', maxPriorityFeePerGas: '2000000000', maxTotalFeeWei: '1000000000000000000', maxValueWei: '0', operationId: 'synthetic-browser-only', sourceSha256: `0x${'42'.repeat(32)}` };
  return { unsigned, expectedUnsignedHash: keccak256(unsigned), expectedPolicyHash: policyDigest(review,keccak256(unsigned)), review };
}
async function page(context, mode = 'success') {
  const p = await context.newPage();
  p.on('dialog', dialog => dialog.accept());
  p.on('console', message => logs.push(message.text()));
  p.on('pageerror', error => errors.push(error.message));
  p.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:')) remoteRequests.push(request.url().split('?')[0]); });
  await p.addInitScript(({ mode }) => {
    const originalNow = Date.now.bind(Date);
    Object.defineProperty(globalThis,'__COMPANION_BROWSER_TEST__',{value:{testOnly:true,mode},configurable:false});
    Date.now = () => globalThis.__COMPANION_BROWSER_TEST__.now ?? originalNow();
    Object.defineProperty(navigator,'hid',{get(){throw new Error('ACTUAL_USB_MUST_NEVER_BE_CALLED');},configurable:false});
  }, { mode });
  await p.goto(`http://127.0.0.1:${server.address().port}/`);
  await p.locator('#status').waitFor();
  return p;
}
async function fill(p, value = packet()) {
  await p.locator('#unsigned').fill(value.unsigned);
  await p.locator('#expectedHash').fill(value.expectedUnsignedHash);
  await p.locator('#review').fill(JSON.stringify(value.review));
  await p.locator('#expectedPolicyHash').fill(value.expectedPolicyHash);
  await p.locator('#path').fill("44'/60'/0'/0/0");
  await p.locator('#ack').check();
  await p.locator('#validate').click();
  return value;
}
async function download(p, selector) {
  const event = p.waitForEvent('download');
  await p.locator(selector).click();
  const d = await event;
  // Download streams remain private and are never written into evidence/artifacts.
  const stream = await d.createReadStream();
  let text = ''; for await (const part of stream) text += part;
  const parsed = JSON.parse(text);
  if (parsed.signedTransaction) rawMarkers.add(parsed.signedTransaction);
  if (parsed.raw) rawMarkers.add(parsed.raw);
  return parsed;
}
try {
  evidence.status = 'RUNNING'; evidence.phase = 'fixture-build'; await persistEvidence();
  await buildBrowserFixture(directory);
  server = createServer(async (request,response) => {
    const files = new Map([['/','index.html'],['/app.js','app.js'],['/style.css','style.css']]);
    if (request.method !== 'GET' || !files.has(request.url)) { response.writeHead(404).end(); return; }
    try {
      const file = files.get(request.url);
      const content = await readFile(resolve(directory,file));
      response.writeHead(200,{'Content-Type': ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'Permissions-Policy':'hid=(self), bluetooth=(), usb=()'}); response.end(content);
    } catch { response.writeHead(503).end(); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    evidence.phase = 'browser-launch'; await persistEvidence();
    browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  } catch (error) {
    evidence.launch = 'BLOCKED_BEFORE_PAGE_LOAD';
    const message = String(error.message);
    evidence.blocker = message.includes("Executable doesn't exist") ? 'PLAYWRIGHT_MATCHED_BROWSER_MISSING' : message.includes('Running as root without --no-sandbox') || message.includes('sandboxing failed') ? 'CHROMIUM_SANDBOX_UNAVAILABLE_IN_CURRENT_ENVIRONMENT' : 'SUPPORTED_BROWSER_LAUNCH_FAILED';
    await writeFile(resolve(evidenceDirectory,'browser-launch-blocker.txt'), message);
    process.exitCode = 2;
  }
  if (browser) {
    evidence.launch = 'PASS'; evidence.browserVersion = browser.version();
    const context = await browser.newContext({ acceptDownloads: true }); context.setDefaultTimeout(10000);
    await test('source-preview-load-create-display-disabled-downloads', async () => {
      const p = await page(context); assert.equal(await p.locator('#sign').isDisabled(),true); assert.equal(await p.locator('#download').isDisabled(),true); assert.equal(await p.locator('#downloadImport').isDisabled(),true);
      await fill(p); assert.match(await p.locator('#summary').textContent(),/CREATE — recipient absent/); assert.equal(await p.locator('#sign').isEnabled(),true); await p.close();
    });
    await test('csp-connect-none-blocks-egress-before-network', async () => {
      const p = await page(context);
      const result = await p.evaluate(async () => { const violations = []; document.addEventListener('securitypolicyviolation',e => violations.push(e.effectiveDirective)); let rejected = false; try { await fetch('https://companion-egress-probe.invalid/never-sent'); } catch { rejected = true; } await new Promise(resolve => setTimeout(resolve,100)); return { rejected, violations }; });
      assert.equal(result.rejected,true); assert.ok(result.violations.includes('connect-src')); await p.close();
    });
    await test('unsigned-hash-change-invalidates-signing', async () => {
      const p = await page(context); const value=await fill(p); const changedHash=`0x${'00'.repeat(32)}`; await p.locator('#expectedHash').fill(changedHash); assert.equal(await p.locator('#sign').isDisabled(),true); await p.locator('#validate').click(); assert.equal(await p.locator('#status').textContent(),'POLICY_HASH_MISMATCH'); await p.locator('#expectedPolicyHash').fill(policyDigest(value.review,changedHash)); await p.locator('#validate').click(); assert.equal(await p.locator('#status').textContent(),'UNSIGNED_HASH_MISMATCH'); assert.equal(await p.evaluate(() => __COMPANION_BROWSER_TEST__.calls ?? 0),0); await p.close();
    });
    await test('stale-plan-refused-at-validation-and-click-time', async () => {
      const p = await page(context); await fill(p,packet({expiry:Date.now()-1000})); assert.equal(await p.locator('#status').textContent(),'INTENT_EXPIRED'); const value = await fill(p); await p.evaluate(now => { __COMPANION_BROWSER_TEST__.now = now; },Date.parse(value.review.expiresAt)+1); await p.locator('#sign').click(); await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('INTENT_EXPIRED')); assert.equal(await p.evaluate(() => __COMPANION_BROWSER_TEST__.calls ?? 0),0); await p.close();
    });
    for (const [mode,code] of [['account-mismatch','DEVICE_ADDRESS_MISMATCH'],['account-changed','SIGNER_MISMATCH'],['path-mismatch','DEVICE_ADDRESS_MISMATCH'],['reject','DEVICE_ACTION_STOPPED_OR_FAILED'],['disconnect','DEVICE_ACTION_FAILED'],['raw-error','SIGNING_FAILED']]) await test(`synthetic-${mode}-fixed-error-no-download`,async () => {
      const p = await page(context,mode); await fill(p); await p.locator('#sign').click(); await p.waitForFunction(code => document.getElementById('status').textContent.startsWith(code),code); assert.equal(await p.locator('#download').isDisabled(),true); assert.equal(await p.locator('#downloadImport').isDisabled(),true); assert.equal((await p.locator('#status').textContent()).includes('PRIVATE_DEVICE_RESPONSE'),false); await p.close();
    });
    await test('largest-eip3860-create-keeps-full-bytes-in-synthetic-chunks',async () => {
      const p = await page(context); const value = await fill(p,packet({data:`0x${'00'.repeat(49152)}`})); await p.locator('#sign').click(); await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Signature validated.')); const full = await download(p,'#download'); assert.equal(full.unsignedTransaction,value.unsigned); assert.equal(await p.evaluate(() => __COMPANION_BROWSER_TEST__.byteLength),(value.unsigned.length-2)/2); assert.ok(await p.evaluate(() => __COMPANION_BROWSER_TEST__.chunkCount)>190); await p.close();
    });
    await test('signed-capability-full-recovery-and-exact-minimal-import',async () => {
      const p = await page(context); await fill(p); await p.locator('#sign').click(); await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Signature validated.')); const full = await download(p,'#download'),minimal = await download(p,'#downloadImport'); assert.deepEqual(Object.keys(minimal),['raw']); assert.equal(minimal.raw,full.signedTransaction); assert.equal(Transaction.from(minimal.raw).from,sender); assert.equal(await p.evaluate(() => __COMPANION_BROWSER_TEST__.calls),1); await p.close();
    });
    await test('expired-after-device-approval-preserves-recovery-refuses-import',async () => {
      const p = await page(context,'expire-after-approval'); await fill(p); await p.locator('#sign').click(); await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('DO_NOT_RELAY')); assert.equal(await p.locator('#downloadImport').isDisabled(),true); const full = await download(p,'#download'); assert.equal(full.status,'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY'); assert.ok(full.signedTransaction); await p.close();
    });
    await test('import-export-rechecks-expiry-at-download-click',async () => {
      const p = await page(context); const value = await fill(p); await p.locator('#sign').click(); await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Signature validated.')); await p.evaluate(now => { __COMPANION_BROWSER_TEST__.now = now; },Date.parse(value.review.expiresAt)+1); await p.locator('#downloadImport').click(); assert.equal(await p.locator('#downloadImport').isDisabled(),true); assert.match(await p.locator('#status').textContent(),/COORDINATOR_IMPORT_EXPIRED_DO_NOT_RELAY/); const full = await download(p,'#download'); assert.equal(full.status,'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY'); await p.close();
    });
    await test('duplicate-sign-click-and-cancel-never-repeat-device-request',async () => {
      const p = await page(context,'wait'); await fill(p); await p.locator('#sign').click(); await p.waitForFunction(() => __COMPANION_BROWSER_TEST__.calls===1); await p.locator('#sign').dispatchEvent('click'); assert.equal(await p.evaluate(() => __COMPANION_BROWSER_TEST__.calls),1); await p.locator('#cancel').click(); await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('DEVICE_ACTION_STOPPED_OR_FAILED')); assert.equal(await p.locator('#download').isDisabled(),true); await p.close();
    });
    await test('browser-disabled-download-does-not-trigger-resigning-or-storage',async () => {
      const denied = await browser.newContext({acceptDownloads:false}); const p = await page(denied); await fill(p); await p.locator('#sign').click(); await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Signature validated.')); const event = p.waitForEvent('download'); await p.locator('#download').click(); const d = await event; assert.ok(await d.failure()); assert.equal(await p.evaluate(() => __COMPANION_BROWSER_TEST__.calls),1); assert.equal(await p.locator('#sign').isDisabled(),true); assert.deepEqual(await p.evaluate(() => ({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0}); await denied.close();
    });
    await context.close();
    const campaign = await import('./browser-campaign.mjs');
    await campaign.runCampaignBrowserTests({ browser, directory, test, results, rawMarkers, logs, remoteRequests, errors });
    await test('no-raw-capability-or-sdk-error-console-output',async () => { assert.equal(logs.some(line => [...rawMarkers].some(raw => line.includes(raw))),false); assert.equal(logs.some(line => /0x02[0-9a-f]{60,}/i.test(line)),false); assert.equal(errors.length,0); });
    evidence.remoteRequestCount = remoteRequests.length; evidence.campaignCoordinatorMode = 'SYNTHETIC_ADAPTER_REAL_BRIDGE_ENGINE';
    evidence.consoleMessageCount = logs.length;
    evidence.unhandledErrorCount = errors.length;
  }
} catch { evidence.harness = 'FAIL'; process.exitCode = 1; }
finally {
  evidence.phase = 'cleanup'; await persistEvidence();
  const cleanupWatchdog = setTimeout(() => { void timedStop(null, 'HARNESS_CLEANUP_TIMEOUT'); }, CASE_TIMEOUT_MS);
  try { await browser?.close(); await new Promise(resolve => server ? server.close(resolve) : resolve()); await rm(directory,{recursive:true,force:true}); } finally { clearTimeout(cleanupWatchdog); }
  evidence.phase = 'complete';
  evidence.status = evidence.harness ? 'FAIL' : evidence.launch !== 'PASS' ? 'BLOCKED' : results.every(value => value.status==='PASS') ? 'PASS' : 'FAIL';
  evidence.passCount = results.filter(value => value.status==='PASS').length; evidence.failCount = results.filter(value => value.status==='FAIL').length;
  await persistEvidence();
  process.stdout.write(`Browser acceptance ${evidence.status}: ${evidence.passCount} passed, ${evidence.failCount} failed; physical acceptance NOT_PERFORMED.\n`);
}
