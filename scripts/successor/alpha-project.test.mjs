import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { importAlphaProject, inspectAlphaProject, advanceAlphaProject, ALPHA_SOURCE } from './alpha-project.mjs';
import { canonical, sha256 } from '../../site/assets/successor/safe.mjs';
const root = process.env.SUCCESSOR_ALPHA_SOURCE;
if (!root) throw Error('SUCCESSOR_ALPHA_SOURCE must identify the pinned, clean Alpha checkout; these integration tests never skip');
const alpha = name => import(pathToFileURL(path.join(root, name)));
const project = await alpha('examples/successor-project/engine.mjs');
const native = await alpha('examples/successor-workbench/mission-record.mjs');
const work = await alpha('examples/successor-workbench/engine.mjs');
const discovery = await alpha('examples/alpha-discovery/engine.mjs');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/successor/mission/sources.json')));
const source = relative => ({ repository: ALPHA_SOURCE.repository, commit: ALPHA_SOURCE.commit, path: relative, sha256: manifest.sources[relative] });
const sources = { discovery: source('examples/alpha-discovery/engine.mjs'), mission: source('examples/successor-workbench/mission-record.mjs') };
async function fixture(csv = 'group,amount\nÉnergie,2\nÉnergie,2\nWind,-1\n') {
  const spec = work.example('public-data'); spec.inputs.csv = csv;
  const record = await native.createRecord({ missionId: 'native-1', sourceHash: manifest.sourceHash, spec });
  return canonical(await project.createProject({ projectId: 'project-kept', cycleId: 'cycle-kept', sourceHash: manifest.sourceHash, record, discoveryBytes: canonical(await discovery.createBrief(project.publicDataOpportunity(), manifest.sourceHash)), choices: { family: 'public-data', selection: 'explicit-user-selection', duplicatePolicy: 'sum-all-rows-no-deduplication', unitPolicy: 'unchanged-integer-units', dataRights: 'synthetic' }, sources }));
}
const options = language => ({ alphaCheckout: root, language, mappingAcknowledgement: 'alpha-public-data-to-manager-rows/v1' });
for (const lang of ['en', 'fr']) test(lang + ': native Alpha receiver validation, actual Manager work, USDC draft and complete retained history', async () => {
  const original = await fixture();
  const imported = await importAlphaProject(original, options(lang));
  let read = await inspectAlphaProject(imported, { alphaCheckout: root });
  assert.equal(read.transfer.original.raw, original); assert.equal(read.transfer.project.projectId, 'project-kept');
  assert.equal(read.state.candidates.length, 0); assert.equal(read.state.active, null);
  const executed = await advanceAlphaProject(imported, { alphaCheckout: root, action: 'run' });
  read = await inspectAlphaProject(executed, { alphaCheckout: root });
  assert.equal(read.state.active, null); assert.equal(read.state.candidates[0].checker.passed, true);
  const result = JSON.parse(read.state.candidates[0].files.find(f => f.name === 'result.json').content);
  assert.equal(result.groups.find(g => g.category === 'Énergie').total, '4'); assert.equal(result.includedRows, 3);
  const planned = await advanceAlphaProject(executed, { alphaCheckout: root, action: 'select-and-draft', budget: '100' });
  read = await inspectAlphaProject(planned, { alphaCheckout: root });
  assert.equal(read.transfer.original.raw, original); assert.equal(read.transfer.project.cycleId, 'cycle-kept');
  assert.equal(read.transfer.history.length, 3); assert.equal(read.state.plans[0].currency.symbol, 'USDC');
  assert.equal(read.state.plans[0].pricing.jobBaseUnits, '100000000'); assert.equal(read.transfer.authority, 'none');
  assert.equal(read.transfer.qualification, 'not-evaluated'); assert.equal(read.transfer.settlement, 'not-connected');
});
test('explicit mapping, native corruption, source pins and prices fail closed', async () => {
  const raw = await fixture();
  await assert.rejects(importAlphaProject(raw, { ...options('en'), mappingAcknowledgement: undefined }), { code: 'EXPLICIT_MAPPING_REQUIRED' });
  const broken = JSON.parse(raw); broken.cycles[0].records[0].bytes += ' ';
  await assert.rejects(importAlphaProject(canonical(broken), options('en')), { code: 'ALPHA_NATIVE_INVALID' });
  await assert.rejects(importAlphaProject(raw, { ...options('en'), alphaCheckout: path.resolve('.') }), { code: 'ALPHA_SOURCE_PIN' });
  const imported = await importAlphaProject(raw, options('en'));
  await assert.rejects(advanceAlphaProject(imported, { alphaCheckout: root, action: 'select-and-draft', budget: '100' }), { code: 'RUN_REQUIRED' });
});
test('recomputed outer checksums cannot change source history, mapping, mission or authority', async () => {
  const imported = await importAlphaProject(await fixture(), options('en'));
  for (const change of [v => v.authority = 'approved', v => v.mapping.duplicates = 'deduplicated', v => v.project.projectId = 'swapped', v => v.original.raw += ' ', v => v.history[0].kind = 'local-run']) {
    const v = JSON.parse(imported); change(v); delete v.sha256; v.sha256 = await sha256(v);
    await assert.rejects(inspectAlphaProject(canonical(v), { alphaCheckout: root }));
  }
});

test('chunked Unicode transport and narrower Manager bounds preserve exact rows or reject', async () => {
  const csv = 'group,amount\n' + Array.from({ length: 1000 }, () => 'É'.repeat(30) + ',1').join('\n');
  const original = await fixture(csv), imported = await importAlphaProject(original, options('fr'));
  const read = await inspectAlphaProject(imported, { alphaCheckout: root });
  assert.equal(read.transfer.original.raw, original); assert.equal(JSON.parse(read.state.mission.input).length, 1000);
  await assert.rejects(importAlphaProject(await fixture(csv + '\nG,1'), options('en')), { code: 'DATA_LIMIT' });
});
test('new history cannot relabel a local preference as an execution, and invalid USDC prices stay rejected', async () => {
  const imported = await importAlphaProject(await fixture(), options('en'));
  const executed = await advanceAlphaProject(imported, { alphaCheckout: root, action: 'run' });
  await assert.rejects(advanceAlphaProject(executed, { alphaCheckout: root, action: 'select-and-draft', budget: '1.0000001' }));
  const planned = await advanceAlphaProject(executed, { alphaCheckout: root, action: 'select-and-draft', budget: '100' });
  const altered = JSON.parse(planned); altered.history.at(-1).kind = 'local-run'; delete altered.sha256; altered.sha256 = await sha256(altered);
  await assert.rejects(inspectAlphaProject(canonical(altered), { alphaCheckout: root }), { code: 'TRANSITION_CHANGED' });
});
