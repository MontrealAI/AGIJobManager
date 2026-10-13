import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeConsole } from './preservation-normalize.mjs';
const digest = data => createHash('sha256').update(data).digest('hex');
const baseline = JSON.parse(fs.readFileSync(new URL('../../docs/successor/PRESERVATION_BASELINE.json', import.meta.url)));
test('original contracts, consoles, economics, historical evidence and flowcharts are preserved', () => {
  for (const [file, expected] of Object.entries(baseline.protectedFiles)) {
    const normalized = baseline.normalizedConsoleFiles[file];
    assert.equal(digest(normalized ? normalizeConsole(fs.readFileSync(file, 'utf8')) : fs.readFileSync(file)), normalized || expected, file + ' must preserve original executable content');
  }
  for (const [file, blocks] of Object.entries(baseline.mermaidBlocks)) {
    const actual = [...fs.readFileSync(file, 'utf8').matchAll(/```mermaid[^\n]*\n[\s\S]*?```/g)].map(m => digest(m[0]));
    for (const expected of blocks) assert.ok(actual.includes(expected), file + ' must retain its original diagram');
  }
  const mainnet = JSON.parse(fs.readFileSync('config/mainnet/agi-jobs-usdc.json'));
  assert.equal(mainnet.activation.intakeActivationAuthorized, false); assert.equal(mainnet.activation.gates.length, 5);
});
test('all existing hosted routes survive, and Builder editions have exact source inventories', () => {
  for (const route of [...baseline.routes, 'successor/index.html', 'fr/successor/index.html']) assert.ok(fs.existsSync('build/pages/' + route), route);
  const info = JSON.parse(fs.readFileSync('build/pages/build-info.json'));
  for (const [file, record] of Object.entries(info.files)) { const bytes = fs.readFileSync('build/pages/' + file); assert.equal(bytes.length, record.bytes); assert.equal(digest(bytes), record.sha256); }
  for (const lang of ['', 'fr/']) {
    const home = fs.readFileSync(`build/pages/${lang}index.html`, 'utf8'); assert.ok(home.includes('data-successor-entry="home" href="./successor/"'));
    const page = fs.readFileSync(`build/pages/${lang}successor/index.html`, 'utf8'); assert.ok(page.includes("connect-src 'none'")); assert.ok(page.includes('sandbox=""')); assert.ok(Buffer.byteLength(page) < 750000, 'Initial uncompressed Builder must remain below 750 KB');
  }
});
