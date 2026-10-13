import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { fail } from '../../site/assets/successor/safe.mjs';

const fixture = '<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; form-action \'none\'"><title>Local public project fixture</title><style>body{font:20px system-ui;margin:40px}input,button{font:inherit;padding:14px}label{display:block;margin-bottom:10px}output{display:block;margin-top:30px}</style><main><h1>Public project card</h1><p>A controlled fixture. No external publication.</p><label for="title">Project title</label><input id="title" maxlength="200"><button id="build" type="button">Build card</button><output id="result" aria-live="polite"></output></main><script>document.querySelector("#build").onclick=()=>{document.querySelector("#result").textContent="Project: "+document.querySelector("#title").value};</script></html>';
export async function browserDriver(options = {}) {
  const browser = await chromium.launch({ headless: true, ...options }), context = await browser.newContext({ viewport: { width: 900, height: 650 }, acceptDownloads: false });
  await context.route('**/*', route => route.abort());
  const page = await context.newPage(); await page.setContent(fixture); let stopped = false;
  const identity = { name: 'playwright-local-fixture/1', browser: browser.version(), playwright: JSON.parse(fs.readFileSync(new URL('../../node_modules/@playwright/test/package.json', import.meta.url))).version, sourceSha256: createHash('sha256').update(fs.readFileSync(new URL('./browser-driver.mjs', import.meta.url))).digest('hex'), fixtureSha256: createHash('sha256').update(fixture).digest('hex'), provider: 'fixture-no-model', permissions: 'disposable-browser-context-only' };
  return {
    identity,
    observe: async () => { fail(!stopped, 'DRIVER_STOPPED'); const png = (await page.screenshot()).toString('base64'), state = { title: await page.locator('#title').inputValue(), result: await page.locator('#result').textContent() }; return { png, state }; },
    act: async (action, value) => { fail(!stopped, 'DRIVER_STOPPED'); if (action === 'type') { await page.locator('#title').click(); await page.locator('#title').fill(''); await page.keyboard.insertText(value); } else if (action === 'click') await page.locator('#build').click(); else fail(false, 'ACTION_DENIED'); },
    stop: async () => { if (!stopped) { stopped = true; await context.close(); await browser.close(); } },
  };
}
