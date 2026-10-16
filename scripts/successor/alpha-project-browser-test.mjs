import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { builderArtifacts } from './build.mjs';
import { fixture } from './alpha-project-fixture.mjs';
const { chromium } = await import(process.env.SUCCESSOR_PLAYWRIGHT || '@playwright/test');
const base = path.resolve('build/pages'), evidence = path.resolve('build/successor-alpha-browser'); fs.mkdirSync(evidence, { recursive: true });
const server = createServer((req, res) => { const route = new URL(req.url, 'http://localhost').pathname.replace(/^\/AGIJobManager\//, ''), file = path.resolve(base, route.endsWith('/') ? route + 'index.html' : route); if (!file.startsWith(base + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; } res.setHeader('Content-Type', 'text/html'); res.end(fs.readFileSync(file)); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.SUCCESSOR_CHROMIUM ? { executablePath: process.env.SUCCESSOR_CHROMIUM } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const original = await fixture(), results = [];
async function download(page, id, name) { const pending = page.waitForEvent('download'); await page.locator('#' + id).click(); const item = await pending, target = path.join(evidence, name); await item.saveAs(target); return fs.readFileSync(target, 'utf8'); }
try {
  for (const lang of ['en', 'fr']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 } }), page = await context.newPage(), errors = [], external = [];
    page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await context.addInitScript(() => { window.__walletCalls = 0; window.ethereum = { request() { window.__walletCalls++; throw Error('Unexpected wallet call'); } }; });
    await context.route('**/*', route => { const url = route.request().url(); if (/^https?:/.test(url) && new URL(url).origin !== origin) { external.push(url); return route.abort(); } return route.continue(); });
    const url = `${origin}/AGIJobManager/${lang === 'fr' ? 'fr/' : ''}successor/#alpha-project`;
    await page.goto(url);
    for (const [name, buffer, code] of [['bom.json', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(original)]), 'INPUT_BOM'], ['invalid-utf8.json', Buffer.from([0xff, 0xfe, 0x7b]), 'INPUT_UTF8']]) {
      await page.locator('#alpha-file').setInputFiles({ name, mimeType: 'application/json', buffer }); await page.locator('#error').waitFor({ state: 'visible' });
      assert.ok((await page.locator('#error').textContent()).includes(code)); assert.equal(await page.locator('#alpha-preview').isVisible(), false); assert.equal(await page.locator('#alpha-workspace').isVisible(), false);
    }
    await page.locator('#alpha-file').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(original) });
    await page.locator('#alpha-preview').waitFor({ state: 'visible' }); assert.equal(await page.locator('#alpha-workspace').isVisible(), false);
    await page.locator('#alpha-confirm').click(); await page.locator('#error').waitFor({ state: 'visible' }); assert.equal(await page.locator('#alpha-workspace').isVisible(), false);
    await page.locator('#alpha-mapping').check(); await page.locator('#alpha-rights').check(); await page.locator('#alpha-confirm').click();
    await page.locator('#alpha-workspace').waitFor({ state: 'visible' }); assert.equal(await page.locator('#alpha-price').isVisible(), false);
    const imported = JSON.parse(await download(page, 'alpha-download', `imported-${lang}.json`)); assert.equal(imported.history.length, 1); assert.equal(imported.original.raw, original);
    await page.locator('#alpha-run').click(); await page.locator('#alpha-price').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#alpha-result').textContent()).includes('Énergie')); assert.ok((await page.locator('#alpha-result').textContent()).includes('"total": "4"'));
    await page.locator('#alpha-budget').fill('1.0000001'); await page.locator('#alpha-select').check(); await page.locator('#alpha-draft').click(); await page.locator('#error').waitFor({ state: 'visible' }); assert.equal(await page.locator('#alpha-plan').isVisible(), false);
    await page.locator('#alpha-budget').fill('100'); await page.locator('#alpha-draft').click(); await page.locator('#alpha-plan').waitFor({ state: 'visible' });
    const raw = await download(page, 'alpha-download', `planned-${lang}.json`), planned = JSON.parse(raw); assert.equal(planned.history.length, 3); assert.equal(planned.authority, 'none'); assert.equal(planned.settlement, 'not-connected'); assert.equal(await page.locator('#alpha-run').isDisabled(), true);
    const dirty = () => page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });
    assert.equal(await dirty(), true, 'A download request cannot confirm a durable save');
    await page.evaluate(() => { window.__savedAnchorClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function() {}; });
    await page.locator('#alpha-download').click(); assert.equal(await dirty(), true, 'Blocked download must preserve leave-page protection');
    await page.evaluate(() => { HTMLAnchorElement.prototype.click = window.__savedAnchorClick; });
    const cancelled = page.waitForEvent('download'); await page.locator('#alpha-download').click(); await (await cancelled).cancel();
    assert.equal(await dirty(), true, 'Cancelled download must preserve leave-page protection');
    assert.equal(await download(page, 'alpha-download', `after-cancel-${lang}.json`), raw);
    assert.equal(await download(page, 'alpha-original', `original-${lang}.json`), original);
    const proposal = JSON.parse(await download(page, 'alpha-download-plan', `proposal-${lang}.json`)); assert.equal(proposal.currency.symbol, 'USDC'); assert.equal(proposal.pricing.jobBaseUnits, '100000000');
    await page.locator('#alpha-file').setInputFiles({ name: 'corrupt.json', mimeType: 'application/json', buffer: Buffer.from(raw.replace('"authority":"none"', '"authority":"approved"')) }); await page.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await download(page, 'alpha-download', `preserved-${lang}.json`), raw);
    await page.locator('#language').click(); assert.equal(await download(page, 'alpha-download', `language-${lang}.json`), raw);
    for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
    await download(page, 'alpha-download-source', `source-${lang}.zip`); assert.deepEqual(fs.readFileSync(path.join(evidence, `source-${lang}.zip`)), Buffer.from(builderArtifacts().zip));
    await page.locator('#alpha-save').click(); assert.equal(await dirty(), false, 'Confirmed successful browser save can clear leave-page protection');
    await page.screenshot({ path: path.join(evidence, `manager-${lang}.png`), fullPage: true });
    await page.reload(); await page.locator('#alpha-load').click(); await page.locator('#alpha-preview').waitFor({ state: 'visible' }); assert.equal(await page.locator('#alpha-workspace').isVisible(), false);
    await page.locator('#alpha-mapping').check(); await page.locator('#alpha-rights').check(); await page.locator('#alpha-confirm').click(); await page.locator('#alpha-workspace').waitFor({ state: 'visible' });
    assert.equal(await download(page, 'alpha-download', `restored-${lang}.json`), raw);
    await page.evaluate(() => { globalThis.DecompressionStream = undefined; }); await page.locator('#alpha-download-source').click(); await page.locator('#error').waitFor({ state: 'visible' }); assert.ok((await page.locator('#error').textContent()).includes('DecompressionStream')); assert.equal(await download(page, 'alpha-download', `source-fallback-${lang}.json`), raw);
    await page.locator('#alpha-clear').click(); assert.equal(await page.evaluate(() => localStorage.getItem('agijobmanager_alpha_project_transfer_v1')), null); assert.equal(await download(page, 'alpha-download', `after-clear-${lang}.json`), raw); assert.equal(await page.evaluate(() => window.__walletCalls), 0); assert.deepEqual(errors, []); assert.deepEqual(external, []);
    results.push({ lang, originalBytesRetained: true, explicitImport: true, actualWork: true, unfundedUSDC: true, corruptionPreservesWorkspace: true, recovery: true, noWalletOrExternalNetwork: true, widths: [320, 390, 768, 1440] }); await context.close();
  }
  fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(results, null, 2)); console.log('Alpha project browser checks PASS: EN/FR, actual native replay, USDC draft, corruption, recovery, four widths, no network/wallet.');
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
