import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { canonical, sha256 } from '../../site/assets/successor/safe.mjs';
import { importAlphaProject, inspectAlphaProject, advanceAlphaProject, validateBrowserAlpha } from '../../site/assets/successor/alpha-project.mjs';
import { builderArtifacts } from './build.mjs';
import { fixture } from './alpha-project-fixture.mjs';
const vendor = 'site/assets/successor/vendor/alpha-project/';
const provenance = JSON.parse(fs.readFileSync(vendor + 'provenance.json'));

const artifacts = builderArtifacts(), context = { sourceManifest: artifacts.sourceManifest, managerSource: artifacts.managerSource, validateNative: validateBrowserAlpha };
test('vendored native browser validator retains every pinned upstream file byte and both licenses', () => {
  assert.equal(Object.keys(provenance.files).length, 10);
  for (const [file, expected] of Object.entries(provenance.files)) assert.equal(createHash('sha256').update(fs.readFileSync(vendor + file)).digest('hex'), expected, file);
  assert.ok(fs.readFileSync(vendor + 'LICENSE', 'utf8').includes('Apache License'));
  assert.ok(fs.readFileSync(vendor + 'examples/build-successor/vendor/agijobs/LICENSE', 'utf8').includes('MIT License'));
});
test('browser adapter preserves native bytes, runs real local work, requires new USDC price, and recovers exact history', async () => {
  const original = await fixture(), imported = await importAlphaProject(original, { language: 'fr', mappingAcknowledgement: 'alpha-public-data-to-manager-rows/v1' }, context);
  assert.equal((await inspectAlphaProject(imported, context)).state.candidates.length, 0);
  const run = await advanceAlphaProject(imported, { action: 'run' }, context);
  await assert.rejects(advanceAlphaProject(run, { action: 'select-and-draft', budget: '1.0000001' }, context));
  const draft = await advanceAlphaProject(run, { action: 'select-and-draft', budget: '100' }, context), read = await inspectAlphaProject(draft, context);
  assert.equal(read.transfer.original.raw, original); assert.equal(read.transfer.history.length, 3); assert.equal(read.state.plans[0].currency.symbol, 'USDC');
  assert.equal(JSON.parse(read.state.candidates[0].files.find(f => f.name === 'result.json').content).groups.find(g => g.category === 'Énergie').total, '4');
  assert.equal(read.state.plans[0].pricing.jobBaseUnits, '100000000'); assert.equal(read.transfer.authority, 'none');
  await assert.rejects(advanceAlphaProject(draft, { action: 'run' }, context), { code: 'EXPLICIT_NEW_CYCLE_REQUIRED' });
  const forged = JSON.parse(draft); forged.authority = 'approved'; delete forged.sha256; forged.sha256 = await sha256(forged);
  await assert.rejects(inspectAlphaProject(canonical(forged), context), { code: 'TRANSFER_AUTHORITY' });
  await assert.rejects(inspectAlphaProject(draft, { ...context, managerSource: { ...context.managerSource, adapterSha256: '0'.repeat(64) } }), { code: 'MANAGER_SOURCE_DRIFT' });
});
test('browser import rejects malformed native history, secrets and missing explicit mapping', async () => {
  const raw = await fixture();
  await assert.rejects(importAlphaProject(raw, { language: 'en' }, context), { code: 'EXPLICIT_MAPPING_REQUIRED' });
  const bad = JSON.parse(raw); bad.cycles[0].records[0].bytes += ' ';
  await assert.rejects(validateBrowserAlpha(canonical(bad)), { code: 'ALPHA_NATIVE_INVALID' });
  await assert.rejects(validateBrowserAlpha(raw.replace('browser-project', 'api_key=abcdefghijklmnop')), { code: 'PRIVATE_INPUT' });
});

test('packed trusted editable inventory preserves exact bytes, closed sources and existing initial-size gate', () => {
  for (const html of Object.values(artifacts.pages)) {
    assert.ok(Buffer.byteLength(html) < 750_000);
    const packed = JSON.parse(html.match(/<script id="successor-sources" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    const decoded = gunzipSync(Buffer.from(packed.data, 'base64'));
    assert.equal(decoded.length, packed.bytes); assert.equal(createHash('sha256').update(decoded).digest('hex'), packed.sha256);
    assert.deepEqual(JSON.parse(decoded), artifacts.sources);
  }
});
