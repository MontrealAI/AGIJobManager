import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { builderArtifacts } from './build.mjs';
import { fixture, capacityFixtures } from './alpha-project-fixture.mjs';
import { validateBrowserAlpha } from '../../site/assets/successor/alpha-project.mjs';
import { canonical, sha256 } from '../../site/assets/successor/safe.mjs';
import { defaultMission } from '../../site/assets/successor/missions.mjs';
import { createSystem, runCandidate, chooseCandidate, recordPlan, exportCapsule, inspectCapsule } from '../../site/assets/successor/model.mjs';
import { prepareImprovement } from '../../site/assets/successor/jobs.mjs';
const args = process.argv.slice(2);
assert.ok(args.length === 0 || args.length === 2 && args[0] === '--bootstrap-source', 'Only explicit developer --bootstrap-source COMMIT is supported');
const artifacts = builderArtifacts(args.length ? { bootstrap: { commit: args[1] } } : {});
const { chromium } = await import(process.env.SUCCESSOR_PLAYWRIGHT || '@playwright/test');
const base = path.resolve('build/pages'), evidence = path.resolve('build/successor-alpha-browser'); fs.mkdirSync(evidence, { recursive: true });
const server = createServer((req, res) => { const route = new URL(req.url, 'http://localhost').pathname.replace(/^\/AGIJobManager\//, ''), file = path.resolve(base, route.endsWith('/') ? route + 'index.html' : route); if (!file.startsWith(base + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; } res.setHeader('Content-Type', 'text/html'); res.end(fs.readFileSync(file)); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.SUCCESSOR_CHROMIUM ? { executablePath: process.env.SUCCESSOR_CHROMIUM } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const original = await fixture(), results = [];
const histories = await capacityFixtures({ sourceManifest: artifacts.sourceManifest, managerSource: artifacts.managerSource, validateNative: validateBrowserAlpha });
async function download(page, id, name) { const pending = page.waitForEvent('download'); await page.locator('#' + id).click(); const item = await pending, target = path.join(evidence, name); await item.saveAs(target); return fs.readFileSync(target, 'utf8'); }
async function assertNativeLeaveWarning(page) {
  const currentURL = page.url(), pending = page.waitForEvent('dialog');
  const navigation = page.goto('about:blank').then(() => null, error => error);
  const dialog = await pending; assert.equal(dialog.type(), 'beforeunload'); await dialog.dismiss();
  assert.ok(await navigation, 'Dismissing the warning must cancel navigation'); assert.equal(page.url(), currentURL);
}
async function inspectFile(page, raw, name = 'history.json') {
  await page.locator('#alpha-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(raw) });
  await page.locator('#alpha-preview').waitFor({ state: 'visible' });
}
async function confirmPreview(page) {
  await page.locator('#alpha-mapping').check(); await page.locator('#alpha-rights').check(); await page.locator('#alpha-confirm').click();
  await page.locator('#alpha-preview').waitFor({ state: 'hidden' }); await page.locator('#alpha-workspace').waitFor({ state: 'visible' });
}
async function checkPendingLanguage(page, raw, name) {
  await page.locator('#alpha-mapping').check(); await page.locator('#alpha-rights').check();
  const before = await page.locator('html').getAttribute('lang'); await page.locator('#language').click();
  assert.notEqual(await page.locator('html').getAttribute('lang'), before);
  assert.equal(await page.locator('#alpha-preview').isVisible(), true);
  assert.equal(await page.locator('#alpha-mapping').isChecked(), false); assert.equal(await page.locator('#alpha-rights').isChecked(), false);
  assert.equal(await download(page, 'alpha-preview-download', name), raw);
  await page.locator('#language').click(); assert.equal(await page.locator('html').getAttribute('lang'), before);
}
async function decodedInputBrowserCheck(page, lang) {
  for (const kind of ['analyst', 'website']) {
    const mission = defaultMission(kind, lang);
    mission.input = kind === 'analyst'
      ? String.raw`[{"id":"a","category":"\u00c9nergie","value":"1"}]`
      : String.raw`{"title":"Public","intro":"\u00c9nergie","sections":[{"heading":"A","body":"Public"}]}`;
    const run = await runCandidate(await createSystem(mission), 'baseline', artifacts.sourceManifest.engineSha256);
    const chosen = await chooseCandidate(run.state, run.candidate.id, 'keep');
    const plan = await prepareImprovement(chosen, { budget: '100' });
    const originalCapsule = JSON.parse(await exportCapsule(await recordPlan(chosen, plan), artifacts.sourceManifest));
    await page.locator('#import-file').locator('..').evaluate(element => element.open = true);
    await page.locator('#import-file').setInputFiles({ name: `${kind}-public-unicode.json`, mimeType: 'application/json', buffer: Buffer.from(canonical(originalCapsule)) });
    await page.locator('#restore-preview').waitFor({ state: 'visible' });
    await page.locator('#restore-consent').check(); await page.locator('#restore').click();
    await page.locator('#restore-preview').waitFor({ state: 'hidden' });
    await page.locator('#save').evaluate(element => element.closest('details').open = true); await page.locator('#save').click();
    const before = await download(page, 'download-capsule', `before-decoded-rejection-${kind}-${lang}.json`);
    const storedBefore = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    for (const encoded of [String.raw`person\u0040example.com`, String.raw`api\u005fkey=synthetic-secret`]) {
      const capsule = structuredClone(originalCapsule), importedPlan = capsule.payload.state.plans[0];
      const importedMission = JSON.parse(importedPlan.immutableInputs[0].content);
      importedMission.input = kind === 'analyst'
        ? `[{"id":"a","category":"${encoded}","value":"1"}]`
        : `{"title":"Public","intro":"${encoded}","sections":[{"heading":"A","body":"Public"}]}`;
      importedPlan.immutableInputs[0].content = canonical(importedMission);
      importedPlan.missionSha256 = importedPlan.immutableInputs[0].sha256 = await sha256(importedPlan.immutableInputs[0].content);
      const { commitment, ...payload } = importedPlan; importedPlan.commitment = await sha256(payload);
      for (const event of capsule.payload.state.chronicle) {
        if (event.action === 'plan-prepared') event.subject = importedPlan.commitment;
        event.previous = event.sequence ? capsule.payload.state.chronicle[event.sequence - 1].sha256 : null;
        const { sha256: oldHash, ...record } = event; event.sha256 = await sha256(record);
      }
      capsule.sha256 = await sha256(capsule.payload);
      await assert.rejects(inspectCapsule(canonical(capsule)), { code: 'PRIVATE_INPUT' });
      await page.locator('#import-file').setInputFiles({ name: `${kind}-escaped.json`, mimeType: 'application/json', buffer: Buffer.from(canonical(capsule)) });
      await page.locator('#error').waitFor({ state: 'visible' });
      assert.ok((await page.locator('#error').textContent()).includes('[PRIVATE_INPUT]'), `${kind}: decoded private text must be the rejection reason`);
      assert.equal(await page.locator('#restore-preview').isVisible(), false);
      assert.equal(await page.locator('#restore-consent').isChecked(), false);
      assert.equal(await download(page, 'download-capsule', `after-decoded-rejection-${kind}-${lang}-${encoded.includes('person') ? 'email' : 'credential'}.json`), before, 'Rejected file must not replace the downloadable public workspace');
      assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))), storedBefore, 'Rejected file must not change any saved browser history');
    }
    await page.locator('#improve-local').click();
    await page.waitForFunction(() => document.querySelector('#comparison').textContent.length > 0);
    const retained = JSON.parse(await download(page, 'download-capsule', `public-unicode-${kind}-${lang}.json`));
    assert.equal(retained.payload.state.mission.input, mission.input, 'Browser replay must preserve original escaped public bytes');
    assert.equal(retained.payload.state.authority, 'none');
    await page.locator('#save').click();
  }
}
try {
  for (const lang of ['en', 'fr']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 } }), page = await context.newPage(), errors = [], external = [];
    page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await context.addInitScript(() => { window.__walletCalls = 0; window.ethereum = { request() { window.__walletCalls++; throw Error('Unexpected wallet call'); } }; });
    await context.route('**/*', route => { const url = route.request().url(); if (/^https?:/.test(url) && new URL(url).origin !== origin) { external.push(url); return route.abort(); } return route.continue(); });
    const url = `${origin}/AGIJobManager/${lang === 'fr' ? 'fr/' : ''}successor/#alpha-project`;
    await page.goto(url);
    await decodedInputBrowserCheck(page, lang);
    await page.reload();
    const dirty = () => page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });
    await page.locator('#alpha-clear').click(); assert.equal(await dirty(), false, 'Clearing an empty workspace must not create unsaved work');
    for (const [name, buffer, code] of [['bom.json', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(original)]), 'INPUT_BOM'], ['invalid-utf8.json', Buffer.from([0xff, 0xfe, 0x7b]), 'INPUT_UTF8']]) {
      await page.locator('#alpha-file').setInputFiles({ name, mimeType: 'application/json', buffer }); await page.locator('#error').waitFor({ state: 'visible' });
      assert.ok((await page.locator('#error').textContent()).includes(code)); assert.equal(await page.locator('#alpha-preview').isVisible(), false); assert.equal(await page.locator('#alpha-workspace').isVisible(), false);
    }
    await page.locator('#alpha-file').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(original) });
    await page.locator('#alpha-preview').waitFor({ state: 'visible' }); assert.equal(await page.locator('#alpha-workspace').isVisible(), false);
    await checkPendingLanguage(page, original, `pending-native-${lang}.json`);
    await page.locator('#alpha-mapping').check(); await page.locator('#alpha-rights').check();
    await page.locator('#alpha-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"invalid":true}') }); await page.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#alpha-preview').isVisible(), true); assert.equal(await page.locator('#alpha-mapping').isChecked(), false); assert.equal(await page.locator('#alpha-rights').isChecked(), false);
    assert.equal(await download(page, 'alpha-preview-download', `after-invalid-pending-${lang}.json`), original);
    await page.locator('#alpha-file').setInputFiles([]); assert.equal(await download(page, 'alpha-preview-download', `after-cancelled-picker-${lang}.json`), original);
    await page.locator('#alpha-cancel').click(); assert.equal(await page.locator('#alpha-preview').isVisible(), false); assert.equal(await page.locator('#alpha-clear').isDisabled(), false);
    await inspectFile(page, original, 'project.json');
    await page.locator('#alpha-confirm').click(); await page.locator('#error').waitFor({ state: 'visible' }); assert.equal(await page.locator('#alpha-workspace').isVisible(), false);
    await page.locator('#alpha-mapping').check(); await page.locator('#alpha-rights').check(); await page.locator('#alpha-confirm').click();
    await page.locator('#alpha-workspace').waitFor({ state: 'visible' }); assert.equal(await page.locator('#alpha-price').isVisible(), false);
    const imported = JSON.parse(await download(page, 'alpha-download', `imported-${lang}.json`)); assert.equal(imported.history.length, 1); assert.equal(imported.original.raw, original);
    await page.locator('#alpha-run').click(); await page.locator('#alpha-price').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#alpha-result').textContent()).includes('Énergie')); assert.ok((await page.locator('#alpha-result').textContent()).includes('"total": "4"'));
    await page.locator('#alpha-budget').fill('1.0000001'); await page.locator('#alpha-select').check(); await page.locator('#alpha-draft').click(); await page.locator('#error').waitFor({ state: 'visible' }); assert.equal(await page.locator('#alpha-plan').isVisible(), false);
    await page.locator('#alpha-budget').fill('100'); await page.locator('#alpha-draft').click(); await page.locator('#alpha-plan').waitFor({ state: 'visible' });
    const raw = await download(page, 'alpha-download', `planned-${lang}.json`), planned = JSON.parse(raw); assert.equal(planned.history.length, 3); assert.equal(planned.authority, 'none'); assert.equal(planned.settlement, 'not-connected'); assert.equal(await page.locator('#alpha-run').isDisabled(), true);
    assert.equal(await dirty(), true, 'A download request cannot confirm a durable save');
    await page.evaluate(() => { window.__savedAnchorClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function() {}; });
    await page.locator('#alpha-download').click(); assert.equal(await dirty(), true, 'Blocked download must preserve leave-page protection');
    await page.evaluate(() => { HTMLAnchorElement.prototype.click = window.__savedAnchorClick; });
    const cancelled = page.waitForEvent('download'); await page.locator('#alpha-download').click(); await (await cancelled).cancel();
    assert.equal(await dirty(), true, 'Cancelled download must preserve leave-page protection'); await assertNativeLeaveWarning(page);
    assert.equal(await download(page, 'alpha-download', `after-cancel-${lang}.json`), raw);
    assert.equal(await download(page, 'alpha-original', `original-${lang}.json`), original);
    const proposal = JSON.parse(await download(page, 'alpha-download-plan', `proposal-${lang}.json`)); assert.equal(proposal.currency.symbol, 'USDC'); assert.equal(proposal.pricing.jobBaseUnits, '100000000');
    await page.locator('#alpha-file').setInputFiles({ name: 'corrupt.json', mimeType: 'application/json', buffer: Buffer.from(raw.replace('"authority":"none"', '"authority":"approved"')) }); await page.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await download(page, 'alpha-download', `preserved-${lang}.json`), raw);
    await page.locator('#language').click(); assert.equal(await download(page, 'alpha-download', `language-${lang}.json`), raw);
    for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
    await download(page, 'alpha-download-source', `source-${lang}.zip`); assert.deepEqual(fs.readFileSync(path.join(evidence, `source-${lang}.zip`)), Buffer.from(artifacts.zip));
    const previousSaved = await page.evaluate(() => localStorage.getItem('agijobmanager_alpha_project_transfer_v1'));
    await page.evaluate(() => { window.__storageSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
    await page.locator('#alpha-save').click(); await page.locator('#error').waitFor({ state: 'visible' }); assert.equal(await dirty(), true, 'Failed storage save must preserve the warning');
    assert.equal(await page.evaluate(() => localStorage.getItem('agijobmanager_alpha_project_transfer_v1')), previousSaved);
    await page.evaluate(() => { Storage.prototype.setItem = window.__storageSetItem; });
    await page.locator('#alpha-save').click(); assert.equal(await dirty(), false, 'Confirmed successful browser save can clear leave-page protection');
    const previousEdition = JSON.parse(raw); previousEdition.managerSource.engineSha256 = '0'.repeat(64); delete previousEdition.sha256; previousEdition.sha256 = await sha256(previousEdition);
    const previousRaw = canonical(previousEdition);
    await page.locator('#alpha-file').setInputFiles({ name: 'previous-edition.json', mimeType: 'application/json', buffer: Buffer.from(previousRaw) });
    await page.locator('#alpha-recovery').waitFor({ state: 'visible' });
    assert.equal(await download(page, 'alpha-recovery-download', `previous-edition-${lang}.json`), previousRaw);
    assert.equal(await download(page, 'alpha-download', `after-source-mismatch-${lang}.json`), raw);
    assert.equal(await page.evaluate(() => localStorage.getItem('agijobmanager_alpha_project_transfer_v1')), raw);
    assert.equal(await page.locator('#alpha-clear').isDisabled(), true);
    assert.equal(await page.locator('#alpha-recovery a').getAttribute('href'), 'https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.19.3');
    await page.locator('#language').click();
    assert.equal(await download(page, 'alpha-recovery-download', `previous-edition-language-${lang}.json`), previousRaw);
    await page.locator('#language').click();
    await page.locator('#alpha-recovery-dismiss').click(); await page.locator('#alpha-recovery').waitFor({ state: 'hidden' });
    await page.screenshot({ path: path.join(evidence, `manager-${lang}.png`), fullPage: true });
    await page.reload(); await page.locator('#alpha-load').click(); await page.locator('#alpha-preview').waitFor({ state: 'visible' }); assert.equal(await page.locator('#alpha-workspace').isVisible(), false);
    assert.equal(await page.locator('#alpha-clear').isDisabled(), true, 'The sole saved copy cannot be removed while its preview is pending');
    await page.locator('#alpha-clear').dispatchEvent('click'); await page.locator('#error').waitFor({ state: 'visible' }); assert.ok((await page.locator('#error').textContent()).includes('ALPHA_PENDING'));
    assert.equal(await page.evaluate(() => localStorage.getItem('agijobmanager_alpha_project_transfer_v1')), raw);
    await checkPendingLanguage(page, raw, `pending-saved-${lang}.json`); assert.equal(await dirty(), false, 'Protected stored pending bytes remain durable');
    await page.locator('#alpha-cancel').click(); assert.equal(await page.locator('#alpha-clear').isDisabled(), false); assert.equal(await page.evaluate(() => localStorage.getItem('agijobmanager_alpha_project_transfer_v1')), raw);
    await page.locator('#alpha-load').click(); await page.locator('#alpha-preview').waitFor({ state: 'visible' });
    await page.locator('#alpha-mapping').check(); await page.locator('#alpha-rights').check(); await page.locator('#alpha-confirm').click(); await page.locator('#alpha-workspace').waitFor({ state: 'visible' });
    assert.equal(await download(page, 'alpha-download', `restored-${lang}.json`), raw);
    await page.evaluate(() => { globalThis.DecompressionStream = undefined; }); await page.locator('#alpha-download-source').click(); await page.locator('#error').waitFor({ state: 'visible' }); assert.ok((await page.locator('#error').textContent()).includes('DecompressionStream')); assert.equal(await download(page, 'alpha-download', `source-fallback-${lang}.json`), raw);
    assert.equal(await dirty(), false, 'Restored saved history starts clean');
    await page.locator('#alpha-save').click(); assert.equal(await dirty(), false);
    await page.locator('#alpha-clear').click(); assert.equal(await page.evaluate(() => localStorage.getItem('agijobmanager_alpha_project_transfer_v1')), null);
    assert.equal(await dirty(), true, 'Clearing the saved copy must protect remaining in-memory history');
    assert.equal(await download(page, 'alpha-download', `after-clear-${lang}.json`), raw); assert.equal(await dirty(), true); await assertNativeLeaveWarning(page);
    await page.locator('#alpha-save').click(); assert.equal(await dirty(), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('agijobmanager_alpha_project_transfer_v1')), raw);
    await page.reload(); await page.locator('#alpha-load').click(); await page.locator('#alpha-preview').waitFor({ state: 'visible' }); assert.equal(await page.locator('#alpha-workspace').isVisible(), false);
    await page.locator('#alpha-mapping').check(); await page.locator('#alpha-rights').check(); await page.locator('#alpha-confirm').click(); await page.locator('#alpha-workspace').waitFor({ state: 'visible' });
    assert.equal(await download(page, 'alpha-download', `resaved-after-clear-${lang}.json`), raw); assert.equal(await dirty(), false);
    const otherTab = await context.newPage(); await otherTab.goto(url);
    await otherTab.evaluate(() => localStorage.removeItem('agijobmanager_alpha_project_transfer_v1'));
    await page.waitForFunction(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });
    assert.equal(await download(page, 'alpha-download', `other-tab-cleared-${lang}.json`), raw); await assertNativeLeaveWarning(page);
    await page.locator('#alpha-save').click(); assert.equal(await dirty(), false);
    await otherTab.evaluate(value => localStorage.setItem('agijobmanager_alpha_project_transfer_v1', value), histories[1]);
    await page.waitForFunction(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });
    assert.equal(await download(page, 'alpha-download', `other-tab-overwrote-${lang}.json`), raw); await page.locator('#alpha-save').click(); assert.equal(await dirty(), false);
    await page.reload(); await page.locator('#alpha-load').click(); await page.locator('#alpha-preview').waitFor({ state: 'visible' });
    await otherTab.evaluate(() => localStorage.removeItem('agijobmanager_alpha_project_transfer_v1'));
    await page.locator('#alpha-pending-storage').waitFor({ state: 'visible' }); assert.equal(await dirty(), true);
    assert.equal(await download(page, 'alpha-preview-download', `other-tab-pending-${lang}.json`), raw); await assertNativeLeaveWarning(page);
    await page.locator('#alpha-cancel').click(); await page.locator('#error').waitFor({ state: 'visible' }); assert.ok((await page.locator('#error').textContent()).includes('ALPHA_PENDING_STORAGE_CHANGED'));
    await inspectFile(page, histories[1]); await page.locator('#error').waitFor({ state: 'visible' }); assert.ok((await page.locator('#error').textContent()).includes('ALPHA_PENDING_STORAGE_CHANGED'));
    assert.equal(await download(page, 'alpha-preview-download', `pending-replacement-blocked-${lang}.json`), raw);
    await confirmPreview(page); assert.equal(await dirty(), true, 'Accepting a pending copy rechecks actual stored bytes');
    await page.locator('#alpha-save').click(); assert.equal(await dirty(), false); await otherTab.close();
    // Saved B and active A must stay separately recoverable during inspection.
    await inspectFile(page, histories[1]); await confirmPreview(page); await page.locator('#alpha-save').click();
    await inspectFile(page, raw); await confirmPreview(page); await page.locator('#alpha-load').click(); await page.locator('#alpha-preview').waitFor({ state: 'visible' });
    assert.equal(await download(page, 'alpha-download', `active-A-${lang}.json`), raw);
    assert.equal(await download(page, 'alpha-preview-download', `pending-B-${lang}.json`), histories[1]);
    for (const id of ['alpha-clear', 'alpha-save', 'alpha-run', 'alpha-draft']) assert.equal(await page.locator('#' + id).isDisabled(), true);
    await page.locator('#alpha-save').dispatchEvent('click'); await page.locator('#error').waitFor({ state: 'visible' }); assert.ok((await page.locator('#error').textContent()).includes('ALPHA_PENDING'));
    assert.equal(await page.evaluate(() => localStorage.getItem('agijobmanager_alpha_project_transfer_v1')), histories[1]);
    await checkPendingLanguage(page, histories[1], `pending-B-language-${lang}.json`);
    await page.locator('#alpha-file').setInputFiles({ name: 'corrupt.json', mimeType: 'application/json', buffer: Buffer.from('{}') }); await page.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await download(page, 'alpha-preview-download', `pending-B-after-invalid-${lang}.json`), histories[1]); assert.equal(await download(page, 'alpha-download', `active-A-after-invalid-${lang}.json`), raw);
    await page.locator('#alpha-cancel').click(); assert.equal(await page.locator('#alpha-save').isDisabled(), false); assert.equal(await page.evaluate(() => localStorage.getItem('agijobmanager_alpha_project_transfer_v1')), histories[1]);
    // Exercise every valid history length, including legacy full histories.
    for (const [index, history] of histories.entries()) {
      await inspectFile(page, history); await confirmPreview(page);
      assert.equal(await page.locator('#alpha-run').isDisabled(), index >= 6);
      assert.equal(await page.locator('#alpha-price').isVisible(), index > 0 && index < 7);
      assert.equal(await page.locator('#alpha-capacity').isVisible(), index >= 6);
      assert.equal(await download(page, 'alpha-download', `capacity-${index + 1}-${lang}.json`), history);
      if (index === 6) {
        await page.locator('#alpha-budget').fill('12.50'); await page.locator('#alpha-select').check(); await page.locator('#alpha-draft').click(); await page.locator('#alpha-plan').waitFor({ state: 'visible' });
        const finalDraft = JSON.parse(await download(page, 'alpha-download', `final-draft-${lang}.json`)); assert.equal(finalDraft.history.length, 8);
        assert.equal(await page.locator('#alpha-price').isVisible(), false); assert.equal(await page.locator('#alpha-run').isDisabled(), true);
      }
    }
    assert.equal(await page.evaluate(() => window.__walletCalls), 0); assert.deepEqual(errors, []); assert.deepEqual(external, []);
    results.push({ lang, originalBytesRetained: true, decodedPrivateInputRejected: true, escapedPublicBytesRetained: true, explicitImport: true, actualWork: true, unfundedUSDC: true, corruptionPreservesWorkspace: true, recovery: true, clearingSavedHistoryRearmsLeaveProtection: true, cancelledDownloadKeepsWarning: true, nativeLeaveWarning: true, failedSaveKeepsWarning: true, clearSavedCopyKeepsWarning: true, clearEmptyWorkspaceStaysClean: true, resaveAfterClearRecovers: true, pendingLanguageAndCancellation: true, pendingStoredCopyProtected: true, activeAndPendingRemainDistinct: true, otherTabStorageLossProtected: true, pendingAcceptanceRechecksStorage: true, allEightCapacityStates: true, finalCheckpointReservedForDraft: true, noWalletOrExternalNetwork: true, widths: [320, 390, 768, 1440] }); await context.close();
  }
  fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(results, null, 2)); console.log('Alpha project browser checks PASS: EN/FR, decoded private-input rejection, escaped public bytes, actual native replay, USDC draft, corruption, recovery, four widths, no network/wallet.');
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
