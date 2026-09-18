// Exercise the exact downloadable console. All wallet/RPC behavior is supplied
// by the browser spec; this server exposes no transaction endpoint or repo files.
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');

async function run() {
  const html = await fs.readFile(path.join(repoRoot, 'ui/agijobmanager-usdc.html'));
  const script = html.toString().match(/<script src="(https:\/\/cdn\.jsdelivr\.net\/npm\/web3@[^\"]+)" integrity="sha384-([^\"]+)"/);
  if (!script) throw new Error('Missing pinned Web3 dependency in release console.');
  let temporaryDirectory;
  let server;
  try {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'usdc-browser-'));
    let web3Path = process.env.AGIJOBMANAGER_WEB3_PATH;
    if (!web3Path) {
      const response = await fetch(script[1], { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Web3 download failed: HTTP ${response.status}`);
      web3Path = path.join(temporaryDirectory, 'web3.min.js');
      await fs.writeFile(web3Path, Buffer.from(await response.arrayBuffer()));
    }
    const digest = createHash('sha384').update(await fs.readFile(web3Path)).digest('base64');
    if (digest !== script[2]) throw new Error('Web3 bytes do not match the release console integrity hash.');
    server = http.createServer((request, response) => {
      if (request.method !== 'GET' || request.url !== '/agijobmanager-usdc.html') {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(html);
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}/agijobmanager-usdc.html`;
    const reportPath = path.join(temporaryDirectory, 'browser-results.json');
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test',
        'ui-tests/usdc-console.spec.js', '--reporter=line,json', '--workers=1', '--forbid-only', '--retries=0'], {
        cwd: repoRoot,
        stdio: 'inherit',
        env: { ...process.env, AGIJOBMANAGER_USDC_UI_URL: baseUrl, AGIJOBMANAGER_WEB3_PATH: path.resolve(web3Path), PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath },
      });
      child.once('error', reject);
      child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`USDC browser checks failed (${signal || code}).`)));
    });
    const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    const collect = suites => suites.flatMap(suite => [
      ...(suite.specs || []).flatMap(spec => spec.tests || []), ...collect(suite.suites || []),
    ]);
    const tests = collect(report.suites || []);
    if (!tests.length || report.errors?.length || tests.some(test => test.expectedStatus !== 'passed'
      || test.results.length !== 1 || test.results[0].status !== 'passed')) {
      throw new Error('Every collected USDC browser check must execute and pass; skipped or expected-failure cases are not qualification.');
    }
    console.log(JSON.stringify({ usdcBrowserCollected: tests.length, usdcBrowserExecuted: tests.length, usdcBrowserPassed: tests.length }));
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
