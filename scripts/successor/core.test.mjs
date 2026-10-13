import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { parseStrict, canonical, sha256, publicOnly, safePath } from '../../site/assets/successor/safe.mjs';
import { defaultMission, executeMission, dataRows } from '../../site/assets/successor/missions.mjs';
import { referenceAnalysis, checkArtifacts } from '../../site/assets/successor/checker.mjs';
import { createSystem, runCandidate, chooseCandidate, compareCandidates, exportCapsule, inspectCapsule, restoreCapsule, recordPlan, validateState } from '../../site/assets/successor/model.mjs';
import { prepareImprovement, validateImprovement, validateGraph } from '../../site/assets/successor/jobs.mjs';
import { compileComputerWork, importAlpha, verifyVendor, checkNewWorkBoundary } from './adapter.mjs';
import { builderArtifacts } from './build.mjs';
import { buildPack } from './vendor/agijobsv0/scripts/pages/vendor/alpha-successor/model.mjs';
const require = createRequire(import.meta.url), { validateComputerWork } = require('../economics/computer-work.cjs');
const hash = 'a'.repeat(64);
async function selected(kind = 'analyst', input) {
  const mission = defaultMission(kind); if (input) mission.input = input;
  const result = await runCandidate(await createSystem(mission), 'baseline', hash);
  return chooseCandidate(result.state, result.candidate.id, 'keep');
}
for (const kind of ['analyst', 'website']) test(kind + ': create, check, select, improve, restore, rerun, rollback', async () => {
  let state = await selected(kind); const incumbent = state.active;
  const result = await runCandidate(state, 'improved', hash); state = result.state;
  assert.equal(compareCandidates(state.candidates[0], result.candidate).outcome, 'improvement');
  assert.equal(state.active, incumbent, 'evaluation never selects itself');
  const plan = await prepareImprovement(state, { budget: '100.000001', repairReserve: '10' }); await validateImprovement(plan);
  state = await recordPlan(state, plan); assert.equal(plan.pricing.totalPlanBaseUnits, '110000001'); assert.equal(plan.authorization, 'none');
  state = await chooseCandidate(state, result.candidate.id, 'replace');
  const inspected = await inspectCapsule(await exportCapsule(state));
  await assert.rejects(restoreCapsule(inspected, false), { code: 'RESTORE_CONFIRMATION' });
  state = await restoreCapsule(inspected, true); const fresh = await runCandidate(state, 'improved', hash);
  assert.equal(fresh.candidate.id, result.candidate.id, 'deterministic artifact replay');
  assert.equal(fresh.state.authority, 'none'); state = await chooseCandidate(fresh.state, incumbent, 'rollback');
  assert.equal(state.active, incumbent); await validateState(state);
});
test('exact decimal reference agrees across signed, large, quoted and Unicode inputs', () => {
  for (let seed = 1; seed < 41; seed++) {
    const rows = Array.from({ length: 60 }, (_, i) => ({ id: 'row-' + i, category: ['Énergie', 'Wind, north', '__proto__'][i % 3], value: (i % 4 === 0 ? '-' : '') + String(seed * i) + '.' + String((seed * 7919 + i) % 1000000).padStart(6, '0') }));
    rows.push(rows[0]); const mission = defaultMission(); mission.input = JSON.stringify(rows);
    for (const variant of ['baseline', 'improved']) { const run = executeMission(mission, variant); assert.equal(checkArtifacts(mission, variant, run.files).passed, true); assert.deepEqual(JSON.parse(run.files[1].content), referenceAnalysis(mission.input, variant === 'improved')); }
  }
  const mission = defaultMission(); mission.input = 'id,category,value\r\n"a","Wind, north",0.1\r\nb,"Solar",0.2\r\n';
  const run = executeMission(mission); assert.equal(checkArtifacts(mission, 'baseline', run.files).passed, true);
});
test('malformed, ambiguous, private, conflicting and oversized inputs fail', () => {
  for (const raw of ['{"a":1,"a":2}', '{"__proto__":{}}', '{"x":{"constructor":1}}', '{"x":1e999}', '[1,]', '{"a":"\\ud800"}', '{"a":"\\u202e"}', '['.repeat(26) + '0' + ']'.repeat(26)]) assert.throws(() => parseStrict(raw));
  for (const raw of ['id,category,value\na,A,0.0000001', 'id,category,value\na,A,NaN', 'id,category,value\na,A,1e3', 'id,category,value\n"a,b,c', 'id,category,value\na,A,1,extra', '[{"id":"a","category":"A","value":1}]']) assert.throws(() => dataRows(raw));
  for (const raw of ['api_key=abcdefghijklmno', '-----BEGIN PRIVATE KEY-----', 'contact person@example.com', 'https://host.com/data?token=abc']) assert.throws(() => publicOnly(raw));
  for (const p of ['../secret', '/absolute', 'a//b', 'a/../b', 'a/.env', 'a\\b']) assert.throws(() => safePath(p));
  const mission = defaultMission(); mission.input = 'id,category,value\na,A,1\na,A,2'; assert.throws(() => executeMission(mission, 'improved'), { code: 'DUPLICATE_CONFLICT' });
});
test('bad candidate bytes are rejected by the separate checker; ties retain incumbent', async () => {
  const state = await selected('analyst', 'id,category,value\na,A,0.1\nb,A,0.2'), baseline = state.candidates[0];
  const result = await runCandidate(state, 'improved', hash); assert.equal(compareCandidates(baseline, result.candidate).outcome, 'tie');
  await assert.rejects(chooseCandidate(result.state, result.candidate.id, 'replace'), { code: 'RETAIN_INCUMBENT' });
  const files = structuredClone(result.candidate.files); files.find(f => f.name === 'result.json').content = files.find(f => f.name === 'result.json').content.replace('0.3', '0.30000000001');
  const checked = checkArtifacts(state.mission, 'improved', files); assert.equal(checked.passed, false);
  assert.equal(compareCandidates(baseline, { ...result.candidate, checker: checked }).outcome, 'regression');
});
test('XSS is escaped; generated preview files cannot request network or execute script', () => {
  const mission = defaultMission('website'); const content = JSON.parse(mission.input); content.title = '<script>alert(1)</script>'; content.sections[0].body = '<img src="https://attacker.test" onerror="alert(1)">'; mission.input = JSON.stringify(content);
  const run = executeMission(mission, 'improved'); assert.ok(run.files[0].content.includes('&lt;script&gt;')); assert.ok(!run.files[0].content.includes('<script>')); assert.equal(checkArtifacts(mission, 'improved', run.files).passed, true);
});
test('capsule mutations, forged authority and rewritten evidence fail even with recomputed outer checksum', async () => {
  const state = await selected(), original = JSON.parse(await exportCapsule(state));
  for (const mutate of [s => s.authority = 'owner', s => s.qualification = 'qualified', s => s.payment = 'settled', s => s.candidates[0].checker.independentController = true, s => s.candidates[0].files[0].content += '<script>bad()</script>', s => s.chronicle[0].subject = hash, s => s.candidates[0].manifest.permissions.push('pay')]) {
    const capsule = structuredClone(original); mutate(capsule.payload.state); capsule.sha256 = await sha256(capsule.payload); await assert.rejects(inspectCapsule(JSON.stringify(capsule)));
  }
  const raw = JSON.stringify(original).replace('"authority":"none"', '"authority":"none","authority":"none"'); await assert.rejects(inspectCapsule(raw), { code: 'DUPLICATE_KEY' });
});
test('custom missions remain draftable and cannot be executed or self-admitted', async () => {
  const state = await createSystem(defaultMission('custom')); await assert.rejects(runCandidate(state, 'baseline', hash), { code: 'RUNTIME_UNAVAILABLE' });
  const plan = await prepareImprovement(state, { budget: '1500' }); assert.equal(plan.mode, 'draft-only'); assert.equal(plan.metadata.properties.draftOnly, true); assert.equal(plan.consoleDraft.jobSpecURI, '');
  assert.throws(() => checkNewWorkBoundary({ authority: 'owner', paid: true }));
});
test('exact USDC pricing and token separation; costs remain unknown and unfunded', async () => {
  const state = await selected();
  for (const price of ['0', '1.0000001', '-1', '1e2', '1,000', 'NaN', undefined]) await assert.rejects(prepareImprovement(state, { budget: price }));
  for (const price of ['0.000001', '100', '999999999999999999.999999']) {
    const plan = await prepareImprovement(state, { budget: price }); await validateImprovement(plan);
    const p = plan.successfulIllustration; assert.equal(BigInt(p.agent) + BigInt(p.sharedReviewers) + BigInt(p.wallet30) + BigInt(p.wallet10), BigInt(plan.pricing.jobBaseUnits));
    assert.equal(plan.currency.decimals, 6); assert.equal(plan.pricing.reservedFunds, false); assert.ok(plan.pricing.unknownCosts.includes('gas'));
  }
});
test('actual computer-work validator accepts exact runtime/input-bound compilation, admission remains absent', async () => {
  const plan = await prepareImprovement(await selected(), { budget: '100' });
  const runtime = { schemaVersion: 1, model: 'fixture-no-model', openclawVersion: 'fixture-not-installed', policySha256: hash, imageSha256: hash, capabilities: ['files', 'code', 'independent-review'], scope: 'isolated-public', resources: ['job-workspace'], maxTaskSeconds: 600 };
  const context = { schema: 'successor-runtime-context/v1', runtimes: { agent: runtime, reviewer: runtime }, inputs: plan.immutableInputs.map(f => ({ name: f.name, uri: 'https://github.com/MontrealAI/AGIJobManager/blob/3958cbc3b01aa459de16cf39e1ab0985b5fa56c3/examples/computer-work-v2.json', sha256: f.sha256, maxBytes: Buffer.byteLength(f.content) })), deadline: 2000000000, settlement: { chainId: 31337, manager: '0x1111111111111111111111111111111111111111', recovery: 'Local rehearsal only; preserve pending claims and original contract liabilities.' }, budget: { maxAgentSeconds: 60, maxReviewSeconds: 60, maxAgentCostUSDC: '5', maxReviewCostUSDC: '3' }, publicConsent: true };
  const result = await compileComputerWork(plan, context, 1900000000); validateComputerWork(result.spec); assert.equal(result.authority, 'none'); assert.equal(result.independentControl, 'UNVERIFIED');
  const bad = structuredClone(context); bad.inputs[0].sha256 = 'b'.repeat(64); await assert.rejects(compileComputerWork(plan, bad, 1900000000));
  bad.inputs = context.inputs; bad.deadline = 1900000001; await assert.rejects(compileComputerWork(plan, bad, 1900000000), { code: 'EXECUTION_WINDOW' });
});
test('acyclic plans require accepted downstream hashes and reserve all costs before receipts', () => {
  const a = { id: 'a', dependencies: [], costBaseUnits: '100', acceptedInputs: [] }, b = { id: 'b', dependencies: ['a'], costBaseUnits: '80', acceptedInputs: [{ stage: 'a', artifactSha256: hash, independentlyAccepted: true }] };
  assert.equal(validateGraph([a, b], '180').atomicSettlement, false); assert.throws(() => validateGraph([a, b], '179'), { code: 'PLAN_CAPITAL' });
  assert.throws(() => validateGraph([a, { ...b, acceptedInputs: [] }], '180'), { code: 'DEPENDENCY_EVIDENCE' });
  assert.throws(() => validateGraph([{ ...a, dependencies: ['b'] }, b], '180'), { code: 'GRAPH_CYCLE' });
});
test('pinned Alpha import replays real upstream verifier, preserves bytes and requires fresh USDC', async () => {
  await verifyVendor(); const engineHash = JSON.parse(fs.readFileSync(new URL('./vendor/agijobsv0/scripts/pages/vendor/alpha-successor/provenance.json', import.meta.url))).sha256;
  const now = Date.now(), pack = await buildPack({ name: 'Atlas Ω', budget: '2100', events: 64, engineSourceHash: engineHash, now: new Date(now).toISOString() }), raw = JSON.stringify(pack);
  const imported = await importAlpha(raw, { budget: '100', now }); assert.equal(imported.original.raw, raw); assert.equal(imported.original.token.decimals, 18); assert.equal(imported.plan.currency.decimals, 6); assert.equal(imported.plan.pricing.jobBaseUnits, '100000000'); assert.equal(imported.original.verification.recompilation, 'MATCH');
  await assert.rejects(importAlpha(raw, { now }), { code: 'USDC_PRICE_REQUIRED' }); await assert.rejects(importAlpha(raw, { budget: '100', now: now + 8 * 86400000 }), { code: 'SOURCE_RIGHTS_EXPIRED' });
  pack.admission.authority = ['owner']; await assert.rejects(importAlpha(JSON.stringify(pack), { budget: '100', now }));
});
test('editable source ZIP rebuilds both complete offline editions in a fresh directory without npm', async () => {
  const artifacts = builderArtifacts(), directory = fs.mkdtempSync(path.join(os.tmpdir(), 'successor-rebuild-')); const zip = path.join(directory, 'source.zip');
  try {
    fs.writeFileSync(zip, artifacts.zip); execFileSync('python3', ['-m', 'zipfile', '-e', zip, path.join(directory, 'clean')]);
    execFileSync(process.execPath, ['scripts/successor/build.mjs', '--out', 'rebuilt'], { cwd: path.join(directory, 'clean') });
    for (const lang of ['en', 'fr']) assert.equal(fs.readFileSync(path.join(directory, 'clean/rebuilt', `My-SUCCESSOR-Omega-${lang}.html`), 'utf8'), artifacts.pages[lang]);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('failed improvement leaves an inspectable negative Chronicle record', async () => {
 const state = await selected('analyst', 'id,category,value\na,A,1\na,A,2');
 try { await runCandidate(state, 'improved', hash); assert.fail('conflicting duplicates accepted'); } catch (error) { assert.equal(error.code, 'DUPLICATE_CONFLICT'); assert.equal(error.failureState.active, state.active); assert.equal(error.failureState.chronicle.at(-1).action, 'run-failed'); await inspectCapsule(await exportCapsule(error.failureState)); }
});
