import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const output = path.resolve('build/pages'), evidenceDir = path.resolve('build/successor-browser'); fs.mkdirSync(evidenceDir, { recursive: true });
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost'), route = decodeURIComponent(url.pathname);
  if (!route.startsWith('/AGIJobManager/')) { res.writeHead(404).end(); return; }
  const relative = route.slice('/AGIJobManager/'.length), file = path.resolve(output, relative.endsWith('/') ? relative + 'index.html' : relative);
  if (!file.startsWith(output + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', { '.html': 'text/html', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.SUCCESSOR_CHROMIUM ? { headless: true, executablePath: process.env.SUCCESSOR_CHROMIUM, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : { headless: true });
const results = [], pages = [];
const { default: AxeBuilder } = await import('../../ui/node_modules/@axe-core/playwright/dist/index.mjs');
async function open(url, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options }), page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = [], network = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) network.push(request.url()); });
  await context.route('**/*', route => /^https?:/.test(route.request().url()) && new URL(route.request().url()).origin !== origin ? route.abort() : route.continue());
  await context.addInitScript(() => { window.__walletCalls = 0; window.ethereum = { request() { window.__walletCalls++; throw Error('Unexpected wallet access'); } }; });
  pages.push({ page, context, errors, network }); await page.goto(url); return page;
}
async function reflow(page, label) {
  const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth })); assert.ok(layout.width <= layout.viewport + 1, `${label}: ${JSON.stringify(layout)}`);
}
async function run(page) { await page.locator('#example').click(); await page.locator('#run').click(); await page.locator('#result-content').waitFor({ state: 'visible' }); assert.equal(await page.locator('#error').isVisible(), false); }
async function improve(page) { await page.locator('#keep-version').click(); await page.locator('#improve-local').click(); await page.waitForFunction(() => document.querySelector('#comparison').textContent.length > 0); assert.equal(await page.locator('#keep-version').isEnabled(), true); await page.locator('#keep-version').click(); }
async function download(page, id, destination) { const pending = page.waitForEvent('download'); await page.locator('#' + id).click(); const file = await pending; await file.saveAs(destination); return fs.readFileSync(destination, 'utf8'); }
try {
  for (const lang of ['en', 'fr']) for (const width of [320, 390, 768, 1440]) {
    const page = await open(`${origin}/AGIJobManager/${lang === 'fr' ? 'fr/' : ''}successor/`, { viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.className), 'skip'); await page.keyboard.press('Enter');
    await page.locator('#name').focus(); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'purpose');
    await reflow(page, `${lang} ${width}`); assert.equal(await page.locator('h1').count(), 1);
    await page.locator('#run').click(); await page.locator('#error').waitFor({ state: 'visible' }); assert.equal(await page.evaluate(() => document.activeElement.id), 'error');
    await run(page); await page.frameLocator('#preview').locator('table').waitFor();
    await improve(page); await page.frameLocator('#preview').getByText(/identical-id-once/).waitFor();
    await page.locator('#rollback').click(); await page.frameLocator('#preview').getByText(/every-row/).waitFor();
    await page.locator('#larger').click(); await reflow(page, `${lang} ${width} enlarged`); assert.equal(await page.locator('#larger').getAttribute('aria-pressed'), 'true');
    for (const id of ['run', 'download-html']) { const box = await page.locator('#' + id).boundingBox(); assert.ok(box.width >= 44 && box.height >= 44); }
    const before = await page.locator('#purpose').inputValue(); await page.locator('#language').click(); assert.equal(await page.locator('#purpose').inputValue(), before); assert.equal(await page.locator('#larger').getAttribute('aria-pressed'), 'true'); await page.locator('#language').click();
    await page.locator('#larger').click();
    const accessible = await page.locator('#create').ariaSnapshot(); assert.ok(accessible.includes('textbox') && accessible.includes('radio'));
    results.push({ lang, width, keyboardLabels: true, enlargedReflow: true, analyst: true, improved: true, rollback: true, languageKeepsInput: true });
    if (width === 1440) {
      await page.locator('#improve-local').click(); await page.waitForFunction(() => document.querySelector('#comparison').textContent.length > 0); await page.locator('#keep-version').click();
      const jsonFile = path.join(evidenceDir, `capsule-${lang}.json`), htmlFile = path.join(evidenceDir, `My-Omega-${lang}.html`);
      const capsule = JSON.parse(await download(page, 'download-capsule', jsonFile)); assert.equal(capsule.payload.state.candidates.find(c => c.id === capsule.payload.state.active).manifest.variant, 'improved');
      await download(page, 'download-html', htmlFile);
      const restored = await open(pathToFileURL(htmlFile).href); await restored.locator('#restore-preview').waitFor({ state: 'visible' });
      assert.equal(await restored.locator('#result-content').isVisible(), false, 'restore is not automatic');
      await restored.locator('#restore-consent').check(); await restored.locator('#restore').click(); await restored.locator('#public-consent').check(); await restored.locator('#run').click(); await restored.frameLocator('#preview').getByText(/identical-id-once/).waitFor();
      const roundtrip = JSON.parse(await download(restored, 'download-capsule', path.join(evidenceDir, `restored-${lang}.json`)));
      assert.equal(roundtrip.payload.state.active, capsule.payload.state.active); assert.equal(roundtrip.payload.state.authority, 'none');
      await page.locator('#prepare-job').locator('..').evaluate(element => element.open = true);
      await page.locator('#budget').fill('100'); await page.locator('#prepare-job').click(); await page.locator('#job-results').waitFor({ state: 'visible' });
      assert.ok((await page.locator('#economics').textContent()).includes('52 USDC'));
      await page.evaluate(() => localStorage.setItem('agijobmanager_usdc_v096_builder_draft_v11_1', '{"prior":"preserve"}'));
      await page.locator('#handoff-consent').check(); await page.locator('#handoff').click(); await page.locator('#replace-console').waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => localStorage.getItem('agijobmanager_usdc_v096_builder_draft_v11_1')), '{"prior":"preserve"}');
      await download(page, 'backup-console', path.join(evidenceDir, `old-console-${lang}.json`)); await page.locator('#replace-consent').check(); await page.locator('#handoff').click();
      assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('agijobmanager_usdc_v096_builder_draft_v11_1'))).jobPayout, '100');
      await page.locator('[name=kind][value=website]').check(); await page.locator('#example').click(); await page.locator('#new-mission').check(); await page.locator('#run').click(); await page.frameLocator('#preview').locator('h1').waitFor();
      await page.locator('#keep-version').click(); await page.locator('#improve-local').click(); await page.waitForFunction(() => document.querySelector('#comparison').textContent.length > 0); await page.frameLocator('#preview').locator('nav a').first().waitFor();
      const sandbox = await page.locator('#preview').getAttribute('sandbox'); assert.equal(sandbox, '');
      const metrics = await page.evaluate(() => ({ navigationMs: performance.getEntriesByType('navigation')[0]?.duration, heapBytes: performance.memory?.usedJSHeapSize || null })); results.push({ lang, metrics, htmlBytes: fs.statSync(path.join(output, lang === 'fr' ? 'fr/successor/index.html' : 'successor/index.html')).size });
      const audit = await new AxeBuilder({ page }).exclude('#preview').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      fs.writeFileSync(path.join(evidenceDir, `axe-${lang}.json`), JSON.stringify({ tool: audit.testEngine, tested: audit.passes.map(p => p.id), violations: audit.violations, incomplete: audit.incomplete.map(p => ({ id: p.id, impact: p.impact })) }, null, 2));
      assert.deepEqual(audit.violations, [], 'WCAG automated checks');
      await page.screenshot({ path: path.join(evidenceDir, `builder-${lang}-desktop.png`), fullPage: true });
      await page.emulateMedia({ media: 'print' }); await page.pdf({ path: path.join(evidenceDir, `builder-${lang}-print.pdf`), format: 'A4' }); await page.emulateMedia({ media: 'screen' });
      results.push({ lang, offlineRestore: true, deterministicRerun: true, independentStorageContext: true, explicitConsoleConflict: true, website: true, sandbox: true, printRendered: true });
    }
  }
  const noStorage = await open(`${origin}/AGIJobManager/successor/`); await noStorage.evaluate(() => { Object.defineProperty(window, 'localStorage', { get() { throw Error('denied'); } }); });
  await run(noStorage); await noStorage.locator('#save').locator('..').locator('..').evaluate(element => element.open = true); await noStorage.locator('#save').click(); assert.ok((await noStorage.locator('#error').textContent()).includes('STORAGE'));
  const noJS = await open(`${origin}/AGIJobManager/fr/successor/`, { javaScriptEnabled: false }); assert.ok(await noJS.locator('noscript').isVisible()); assert.equal(await noJS.locator('#run').isDisabled(), true);
  const hostile = await open(`${origin}/AGIJobManager/successor/`); await hostile.locator('[name=kind][value=website]').check(); await hostile.locator('#example').click(); await hostile.locator('#site-title').fill('<img src=x onerror=alert(1)>'); await hostile.locator('#run').click(); await hostile.frameLocator('#preview').locator('h1').waitFor(); assert.equal(await hostile.frameLocator('#preview').locator('img').count(), 0);
  for (const lang of ['en', 'fr']) {
    const page = await open(`${origin}/AGIJobManager/${lang === 'fr' ? 'fr/' : ''}successor/`);
    await run(page); await page.locator('#keep-version').click();
    const before = JSON.parse(await download(page, 'download-capsule', path.join(evidenceDir, `before-recovery-${lang}.json`)));
    await page.locator('#import-file').locator('..').evaluate(element => element.open = true);
    await page.locator('#import-file').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(before)) });
    await page.locator('#restore-preview').waitFor({ state: 'visible' }); await page.locator('#restore-consent').check();
    await page.locator('#import-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') });
    await page.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#restore-preview').isVisible(), false, 'failed inspection must revoke the old restore preview');
    assert.equal(await page.locator('#restore-consent').isChecked(), false, 'old restore consent must not survive a new import');
    // Hold a real worker response to exercise a user interaction during computation,
    // then deliver it after Stop to cover a late completion without timing guesses.
    await page.evaluate(() => {
      const NativeWorker = window.Worker; window.__nativeWorker = NativeWorker;
      window.Worker = class extends NativeWorker {
        set onmessage(callback) { super.onmessage = event => { window.__deliverWorker = () => callback(event); }; }
      };
    });
    await page.locator('#improve-local').click(); await page.waitForFunction(() => typeof window.__deliverWorker === 'function');
    for (const id of ['run', 'keep-version', 'rollback', 'retain', 'prepare-job', 'restore', 'load', 'import-file', 'language', 'data']) {
      assert.equal(await page.locator('#' + id).isDisabled(), true, `${id} cannot race a pending worker`);
    }
    assert.equal(await page.locator('#stop').isEnabled(), true);
    await page.locator('#stop').click(); await page.locator('#error').waitFor({ state: 'visible' });
    await page.evaluate(() => { window.__deliverWorker(); delete window.__deliverWorker; });
    const after = JSON.parse(await download(page, 'download-capsule', path.join(evidenceDir, `after-stop-${lang}.json`)));
    assert.deepEqual(after.payload.state, before.payload.state, 'stop and late completion preserve the chosen version and history');
    assert.equal(await page.locator('#data').isEnabled(), true);
    await page.locator('#improve-local').click(); await page.waitForFunction(() => typeof window.__deliverWorker === 'function');
    await page.evaluate(() => { window.__deliverWorker(); delete window.__deliverWorker; });
    await page.waitForFunction(() => document.querySelector('#comparison').textContent.length > 0);
    assert.equal(await page.locator('#rollback').isDisabled(), true, 'an unchosen candidate is not a previous version');
    await page.locator('#keep-version').click(); assert.equal(await page.locator('#rollback').isEnabled(), true);
    await page.locator('#rollback').click();
    const recovered = JSON.parse(await download(page, 'download-capsule', path.join(evidenceDir, `recovered-${lang}.json`)));
    assert.equal(recovered.payload.state.active, before.payload.state.active);
    await page.evaluate(() => { window.Worker = window.__nativeWorker; });
    await page.locator('#prepare-job').locator('..').evaluate(element => element.open = true);
    await page.locator('#budget').fill('100'); await page.locator('#prepare-job').click(); await page.locator('#job-results').waitFor({ state: 'visible' });
    await page.locator('#handoff-consent').check();
    await page.locator('#budget').fill(''); await page.locator('#prepare-job').click(); await page.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#job-results').isVisible(), false, 'a rejected new request must revoke the old handoff preview');
    assert.equal(await page.locator('#handoff-consent').isChecked(), false);
    results.push({ lang, failedImportRevokesPreview: true, failedPlanRevokesHandoff: true, pendingWorkerSerialized: true, stoppedWorkPreserved: true, lateCompletionIgnored: true, rollbackOnlyToChosenVersion: true });
  }
  for (const { page, errors, network } of pages) { assert.deepEqual(errors, [], 'No browser errors or CSP violations'); assert.deepEqual(network, [], 'No external network requests'); if (page !== noJS) assert.equal(await page.evaluate(() => window.__walletCalls), 0); }
  fs.writeFileSync(path.join(evidenceDir, 'evidence.json'), JSON.stringify({ browser: browser.version(), platform: process.platform, provider: 'none', results, realUserSessions: 'NOT_RUN', assistiveTechnologyUserSessions: 'NOT_RUN', conformanceCertification: false }, null, 2) + '\n');
  console.log(`SUCCESSOR browser checks passed: ${results.length} scenarios; actual Chromium ${browser.version()}; real-user/assistive-technology sessions not claimed.`);
} finally { for (const { context } of pages) await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
