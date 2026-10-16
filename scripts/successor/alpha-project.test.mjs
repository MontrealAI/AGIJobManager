import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { importAlphaProject, inspectAlphaProject, advanceAlphaProject, ALPHA_SOURCE } from './alpha-project.mjs';
import { canonical, sha256 } from '../../site/assets/successor/safe.mjs';
import { builderArtifacts } from './build.mjs';
import { importAlphaProject as browserImport, inspectAlphaProject as browserInspect, validateBrowserAlpha } from '../../site/assets/successor/alpha-project.mjs';
import { appendEvent, continueHistory, exportCapsule, inspectCapsule } from '../../site/assets/successor/model.mjs';
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
test('invalid checkout errors never disclose local paths through the API or CLI', async () => {
  const original = await fixture(), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'private-alpha-checkout-'));
  try {
    const input = path.join(temporary, 'project.json'), output = path.join(temporary, 'transfer.json');
    fs.writeFileSync(input, original);
    for (const checkout of [path.join(temporary, 'missing-private-directory'), temporary]) {
      await assert.rejects(importAlphaProject(original, { ...options('en'), alphaCheckout: checkout }), error => {
        assert.equal(error.code, 'ALPHA_CHECKOUT'); assert.equal(error.message, 'ALPHA_CHECKOUT');
        assert.equal(String(error).includes(temporary), false); return true;
      });
      const result = spawnSync(process.execPath, ['scripts/successor/cli.mjs', 'import-alpha-project', input, checkout, 'en', '--map-public-data', output], { encoding: 'utf8', timeout: 30000 });
      assert.equal(result.status, 1); assert.equal(result.stdout, '');
      assert.deepEqual(JSON.parse(result.stderr), { code: 'ALPHA_CHECKOUT', message: 'ALPHA_CHECKOUT', authority: 'none' });
      assert.equal(result.stderr.includes(temporary), false); assert.equal(fs.existsSync(output), false);
    }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
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

test('a selected transfer cannot rerun while retaining old selection and USDC plans', async () => {
  const imported = await importAlphaProject(await fixture(), options('en'));
  const executed = await advanceAlphaProject(imported, { alphaCheckout: root, action: 'run' });
  const planned = await advanceAlphaProject(executed, { alphaCheckout: root, action: 'select-and-draft', budget: '100' });
  await assert.rejects(advanceAlphaProject(planned, { alphaCheckout: root, action: 'run' }), { code: 'EXPLICIT_NEW_CYCLE_REQUIRED' });
  const read = await inspectAlphaProject(planned, { alphaCheckout: root });
  assert.equal(read.transfer.history.length, 3); assert.equal(read.state.plans.length, 1);
  assert.notEqual(read.state.active, null);
});

test('fully resealed capsules cannot fabricate the complete Manager source manifest', async () => {
  const imported = await importAlphaProject(await fixture(), options('en'));
  for (const change of [manifest => manifest.commit = '0'.repeat(40), manifest => manifest.files[0].sha256 = '0'.repeat(64), manifest => manifest.files.reverse()]) {
    const transfer = JSON.parse(imported), capsule = JSON.parse(transfer.history[0].capsule);
    change(capsule.payload.sourceManifest); capsule.sha256 = await sha256(capsule.payload);
    transfer.history[0].capsule = canonical(capsule); transfer.history[0].sha256 = await sha256(transfer.history[0].capsule);
    delete transfer.sha256; transfer.sha256 = await sha256(transfer);
    await assert.rejects(inspectAlphaProject(canonical(transfer), { alphaCheckout: root }), { code: 'MANAGER_SOURCE_DRIFT' });
  }
});

test('a valid resealed first capsule cannot substitute a legacy engine or invented archived history', async () => {
  const imported = await importAlphaProject(await fixture(), options('en'));
  const first = JSON.parse(JSON.parse(imported).history[0].capsule);
  const legacy = structuredClone(first.payload.state); legacy.engine = 'successor-local/1';
  const fabricated = structuredClone(first.payload.state);
  await appendEvent(fabricated, 'run-failed', 'FABRICATED_FAILURE');
  const archived = (await continueHistory(fabricated, true, first.payload.sourceManifest)).state;
  for (const state of [legacy, archived]) {
    const transfer = JSON.parse(imported), capsule = await exportCapsule(state, first.payload.sourceManifest);
    await inspectCapsule(capsule); // Valid native capsules still must match this import's exact initial state.
    transfer.history[0].capsule = capsule; transfer.history[0].sha256 = await sha256(capsule);
    delete transfer.sha256; transfer.sha256 = await sha256(transfer);
    await assert.rejects(inspectAlphaProject(canonical(transfer), { alphaCheckout: root }), { code: 'IMPORT_EXECUTION_CLAIM' });
    await assert.rejects(advanceAlphaProject(canonical(transfer), { alphaCheckout: root, action: 'run' }), { code: 'IMPORT_EXECUTION_CLAIM' });
  }
});

test('hidden tracked edits are rejected before loading the pinned native validator', { timeout: 120000 }, async () => {
  const original = await fixture(), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-validator-bytes-'));
  const git = args => execFileSync('git', ['-C', temporary, ...args], { encoding: 'utf8', timeout: 30000 });
  try {
    execFileSync('git', ['-C', root, 'worktree', 'add', '--detach', temporary, ALPHA_SOURCE.commit], { timeout: 60000, stdio: 'pipe' });
    for (const relative of ['examples/successor-project/engine.mjs', 'docs/successor/mission/sources.json']) {
      const file = path.join(temporary, relative), before = fs.readFileSync(file);
      for (const flag of ['skip-worktree', 'assume-unchanged']) {
        git(['update-index', '--' + flag, '--', relative]);
        try {
          fs.writeFileSync(file, Buffer.concat([before, Buffer.from('\n/* hidden tracked edit */\n')]));
          assert.equal(git(['status', '--porcelain', '--untracked-files=no']).trim(), '');
          await assert.rejects(importAlphaProject(original, { ...options('en'), alphaCheckout: temporary }), { code: 'ALPHA_SOURCE_BYTES' });
        } finally { fs.writeFileSync(file, before); git(['update-index', '--no-' + flag, '--', relative]); }
      }
      git(['update-index', '--skip-worktree', '--', relative]);
      try {
        fs.unlinkSync(file);
        await assert.rejects(importAlphaProject(original, { ...options('en'), alphaCheckout: temporary }), { code: 'ALPHA_SOURCE_BYTES' });
        fs.symlinkSync(path.join(root, relative), file);
        await assert.rejects(importAlphaProject(original, { ...options('en'), alphaCheckout: temporary }), { code: 'ALPHA_SOURCE_BYTES' });
      } finally {
        if (fs.existsSync(file)) fs.unlinkSync(file);
        fs.writeFileSync(file, before); git(['update-index', '--no-skip-worktree', '--', relative]);
      }
    }
  } finally {
    execFileSync('git', ['-C', root, 'worktree', 'remove', '--force', temporary], { timeout: 30000, stdio: 'pipe' });
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('Node and browser native receivers produce byte-identical transfers and inspect each other with trusted context', async () => {
  const raw = await fixture(), artifacts = builderArtifacts();
  const context = { sourceManifest: artifacts.sourceManifest, managerSource: artifacts.managerSource, validateNative: validateBrowserAlpha };
  const fromNode = await importAlphaProject(raw, options('fr'));
  const fromBrowser = await browserImport(raw, { language: 'fr', mappingAcknowledgement: 'alpha-public-data-to-manager-rows/v1' }, context);
  assert.equal(fromBrowser, fromNode);
  assert.equal(canonical(await browserInspect(fromNode, context)), canonical(await inspectAlphaProject(fromBrowser, { alphaCheckout: root })));
});

test('tree replacement refs cannot substitute the pinned Alpha validator inventory', { timeout: 120000 }, async () => {
  const original = await fixture(), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-tree-replacement-'));
  const git = args => execFileSync('git', ['-C', temporary, ...args], { encoding: 'utf8', timeout: 60000, stdio: 'pipe' }).trim();
  try {
    execFileSync('git', ['clone', '--shared', '--no-checkout', root, temporary], { timeout: 60000, stdio: 'pipe' });
    git(['checkout', '--detach', ALPHA_SOURCE.commit]);
    const relative = 'examples/successor-project/engine.mjs', manifestPath = 'docs/successor/mission/sources.json';
    fs.appendFileSync(path.join(temporary, relative), '\n/* supplied replacement tree */\n');
    const altered = JSON.parse(fs.readFileSync(path.join(temporary, manifestPath)));
    altered.sources[relative] = createHash('sha256').update(fs.readFileSync(path.join(temporary, relative))).digest('hex');
    fs.writeFileSync(path.join(temporary, manifestPath), JSON.stringify(altered, null, 2) + '\n');
    git(['add', relative, manifestPath]); const replacementTree = git(['write-tree']);
    git(['update-index', '--skip-worktree', '--', relative, manifestPath]); git(['replace', ALPHA_SOURCE.tree, replacementTree]);
    assert.equal(git(['rev-parse', 'HEAD^{tree}']), ALPHA_SOURCE.tree); assert.equal(git(['status', '--porcelain', '--untracked-files=no']), '');
    assert.equal(git(['show', `${ALPHA_SOURCE.commit}:${manifestPath}`]), fs.readFileSync(path.join(temporary, manifestPath), 'utf8').trim(), 'Ordinary Git reads honor the hostile tree replacement');
    await assert.rejects(importAlphaProject(original, { ...options('en'), alphaCheckout: temporary }), { code: 'ALPHA_SOURCE_DIRTY' });
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
