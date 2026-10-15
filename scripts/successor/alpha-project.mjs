import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { fail, keys, canonical, parseStrict, sha256, publicOnly } from '../../site/assets/successor/safe.mjs';
import { defaultMission, csvRows, validateMission } from '../../site/assets/successor/missions.mjs';
import { createSystem, runCandidate, chooseCandidate, exportCapsule, inspectCapsule, recordPlan } from '../../site/assets/successor/model.mjs';
import { prepareImprovement } from '../../site/assets/successor/jobs.mjs';
import { builderArtifacts } from './build.mjs';

export const ALPHA_SOURCE = Object.freeze({ repository: 'MontrealAI/AGI-Alpha-Agent-v0', commit: '7c410d3d61d5d6bba5354307e1784dba2b3aa177', tree: 'e80b1dc06317d939e3dd22d2db063a7f1706ddcb' });
const MAX = 4_000_000;
const MAPPING = 'alpha-public-data-to-manager-rows/v1';
async function managerSource() { return { repository: 'MontrealAI/AGIJobManager', adapterSha256: await sha256(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')), engineSha256: builderArtifacts().sourceManifest.engineSha256 }; }
function checkedCheckout(directory) {
  fail(typeof directory === 'string' && path.isAbsolute(directory), 'ALPHA_CHECKOUT');
  const root = fs.realpathSync(directory);
  const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 10000, maxBuffer: 100000 }).trim();
  fail(git(['rev-parse', 'HEAD']) === ALPHA_SOURCE.commit && git(['rev-parse', 'HEAD^{tree}']) === ALPHA_SOURCE.tree, 'ALPHA_SOURCE_PIN');
  fail(git(['status', '--porcelain', '--untracked-files=no']) === '', 'ALPHA_SOURCE_DIRTY');
  return root;
}
async function validateNative(raw, directory) {
  parseStrict(raw, 2_000_000); publicOnly(raw);
  const root = checkedCheckout(directory);
  const program = `import {pathToFileURL} from 'node:url';
const {validateProject}=await import(pathToFileURL(process.cwd()+'/examples/successor-project/engine.mjs'));
const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);
const project=await validateProject(Buffer.concat(chunks).toString('utf8'));process.stdout.write(JSON.stringify(project));`;
  const env = { ...process.env }; delete env.NODE_OPTIONS; delete env.NODE_PATH;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', program], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let bytes = 0, failed = false;
    const timer = setTimeout(() => { failed = true; child.kill(); reject(Error('ALPHA_VALIDATION_TIMEOUT')); }, 15000);
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 2_000_000) { failed = true; child.kill(); reject(Error('ALPHA_VALIDATION_SIZE')); } else chunks.push(chunk); });
    // Never expose a supplied dossier or local checkout details in error logs.
    child.stderr.resume(); child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); reject(Error('ALPHA_VALIDATOR_UNAVAILABLE')); });
    child.on('close', code => { clearTimeout(timer); if (failed) return; try { fail(code === 0, 'ALPHA_NATIVE_INVALID'); resolve(parseStrict(Buffer.concat(chunks).toString('utf8'), 2_000_000)); } catch (error) { reject(error); } });
    child.stdin.end(raw);
  });
}
function mapMission(project, language) {
  fail(['en', 'fr'].includes(language), 'LANGUAGE');
  const cycle = project.cycles.at(-1), record = parseStrict(cycle.records.at(-1).bytes, 2_000_000);
  fail(record.spec.family === 'public-data' && cycle.mapping.choices.family === 'public-data', 'ALPHA_MAPPING_UNAVAILABLE');
  fail(cycle.mapping.choices.duplicatePolicy === 'sum-all-rows-no-deduplication' && cycle.mapping.choices.unitPolicy === 'unchanged-integer-units', 'ALPHA_MAPPING_POLICY');
  const rows = csvRows(record.spec.inputs.csv, 2); fail(canonical(rows.shift()) === canonical(['group', 'amount']), 'ALPHA_CSV_HEADER');
  // Native Alpha validates integer amounts first. Assign a distinct row identity to
  // every source row, so Manager's ID deduplication never merges equal Alpha rows.
  const input = rows.map((row, index) => { fail(row.length === 2 && /^-?(?:0|[1-9]\d*)$/.test(row[1]), 'ALPHA_INTEGER_MAPPING'); return { id: `alpha-row-${index + 1}`, category: row[0], value: row[1] }; });
  const mission = defaultMission('analyst', language), fr = language === 'fr';
  mission.name = fr ? 'Projet Alpha — vérification des totaux' : 'Alpha project — check category totals';
  mission.purpose = fr ? 'Recalculer les totaux des mêmes lignes sources, sans modifier les unités ni fusionner les doublons.' : 'Recompute totals from the same source rows, preserving units and every duplicate row.';
  mission.input = canonical(input);
  mission.rights = `${cycle.mapping.choices.dataRights}; ${record.spec.inputs.unit}. ` + (fr ? 'Déclaration fournie, non authentifiée; confirmer les droits avant publication.' : 'Supplied declaration, unauthenticated; confirm rights before publication.');
  validateMission(mission); return mission;
}
function projectIdentity(project) { const cycle = project.cycles.at(-1); return { projectId: project.projectId, cycleId: cycle.cycleId, revision: project.revision, projectDigest: project.projectDigest }; }
async function seal(body) { const raw = canonical({ ...body, sha256: await sha256(body) }); fail(Buffer.byteLength(raw) <= MAX, 'TRANSFER_SIZE'); return raw; }
export async function importAlphaProject(raw, { alphaCheckout, language, mappingAcknowledgement }) {
  fail(mappingAcknowledgement === MAPPING, 'EXPLICIT_MAPPING_REQUIRED');
  const project = await validateNative(raw, alphaCheckout), mission = mapMission(project, language);
  const capsule = await exportCapsule(await createSystem(mission), builderArtifacts().sourceManifest);
  return seal({ schema: 'agijobmanager/alpha-project-transfer/v1', source: ALPHA_SOURCE, managerSource: await managerSource(), project: projectIdentity(project), original: { raw, sha256: await sha256(raw) }, mapping: { id: MAPPING, language, rowIdentity: 'source-row-position', units: 'unchanged', duplicates: 'every-source-row' }, history: [{ kind: 'imported', capsule, sha256: await sha256(capsule) }], authority: 'none', qualification: 'not-evaluated', settlement: 'not-connected' });
}
export async function inspectAlphaProject(raw, { alphaCheckout }) {
  const transfer = parseStrict(raw, MAX);
  keys(transfer, ['schema', 'source', 'managerSource', 'project', 'original', 'mapping', 'history', 'authority', 'qualification', 'settlement', 'sha256'], 'TRANSFER_FIELDS');
  const { sha256: checksum, ...body } = transfer;
  fail(checksum === await sha256(body), 'TRANSFER_CHANGED');
  fail(transfer.schema === 'agijobmanager/alpha-project-transfer/v1' && transfer.authority === 'none' && transfer.qualification === 'not-evaluated' && transfer.settlement === 'not-connected', 'TRANSFER_AUTHORITY');
  fail(canonical(transfer.source) === canonical(ALPHA_SOURCE), 'ALPHA_SOURCE_PIN');
  fail(canonical(transfer.managerSource) === canonical(await managerSource()), 'MANAGER_SOURCE_DRIFT');
  keys(transfer.original, ['raw', 'sha256']); fail(transfer.original.sha256 === await sha256(transfer.original.raw), 'ORIGINAL_CHANGED');
  const project = await validateNative(transfer.original.raw, alphaCheckout);
  fail(canonical(transfer.project) === canonical(projectIdentity(project)), 'PROJECT_CHANGED');
  const mission = mapMission(project, transfer.mapping.language);
  fail(canonical(transfer.mapping) === canonical({ id: MAPPING, language: mission.language, rowIdentity: 'source-row-position', units: 'unchanged', duplicates: 'every-source-row' }), 'MAPPING_CHANGED');
  fail(Array.isArray(transfer.history) && transfer.history.length > 0 && transfer.history.length <= 8, 'TRANSFER_HISTORY');
  let prior;
  for (const [index, entry] of transfer.history.entries()) {
    keys(entry, ['kind', 'capsule', 'sha256']); fail(entry.sha256 === await sha256(entry.capsule), 'CAPSULE_CHANGED');
    fail(index === 0 ? entry.kind === 'imported' : ['local-run', 'selected-for-usdc-draft'].includes(entry.kind), 'TRANSFER_HISTORY');
    const inspected = await inspectCapsule(entry.capsule), state = inspected.capsule.payload.state;
    fail(inspected.capsule.payload.sourceManifest?.engineSha256 === builderArtifacts().sourceManifest.engineSha256, 'MANAGER_SOURCE_DRIFT');
    fail(canonical(state.mission) === canonical(mission), 'MISSION_CHANGED');
    if (prior) {
      fail(state.chronicle.length > prior.chronicle.length && canonical(state.chronicle.slice(0, prior.chronicle.length)) === canonical(prior.chronicle), 'HISTORY_REWRITTEN');
      const plan = state.plans.find(p => p.commitment === state.chronicle.at(-1).subject);
      const expected = await nextState(prior, entry.kind, plan?.draft.fields.budget);
      fail(canonical(state) === canonical(expected), 'TRANSITION_CHANGED');
    }
    else fail(state.candidates.length === 0 && state.plans.length === 0 && state.active === null && state.chronicle.length === 1, 'IMPORT_EXECUTION_CLAIM');
    prior = state;
  }
  return { transfer, state: prior, originalProject: project };
}
export async function advanceAlphaProject(raw, { alphaCheckout, action, budget }) {
  const { transfer, state } = await inspectAlphaProject(raw, { alphaCheckout });
  fail(transfer.history.length < 8, 'TRANSFER_HISTORY'); const manifest = builderArtifacts().sourceManifest;
  fail(['run', 'select-and-draft'].includes(action), 'TRANSFER_ACTION');
  const kind = action === 'run' ? 'local-run' : 'selected-for-usdc-draft';
  const next = await nextState(state, kind, budget);
  const capsule = await exportCapsule(next, manifest);
  transfer.history.push({ kind, capsule, sha256: await sha256(capsule) }); delete transfer.sha256;
  const result = await seal(transfer); await inspectAlphaProject(result, { alphaCheckout }); return result;
}

async function nextState(state, kind, budget) {
  if (kind === 'local-run') return (await runCandidate(state, 'baseline', builderArtifacts().sourceManifest.engineSha256)).state;
  fail(kind === 'selected-for-usdc-draft' && state.candidates.length > 0, 'RUN_REQUIRED');
  const next = await chooseCandidate(state, state.candidates.at(-1).id, 'keep');
  return recordPlan(next, await prepareImprovement(next, { budget, requested: next.mission.purpose }));
}
