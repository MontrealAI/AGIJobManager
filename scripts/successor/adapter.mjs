import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fail, keys, canonical, parseStrict, sha256, publicOnly, isHash } from '../../site/assets/successor/safe.mjs';
import { defaultMission } from '../../site/assets/successor/missions.mjs';
import { createSystem } from '../../site/assets/successor/model.mjs';
import { prepareImprovement, validateImprovement } from '../../site/assets/successor/jobs.mjs';
import { publicInputURLs } from '../../site/assets/employer-model.mjs';
import { verifyBuildPack } from './vendor/agijobsv0/scripts/pages/verify-successor-build.mjs';

const require = createRequire(import.meta.url);
const { validateComputerWork, checkRuntime, digest } = require('../economics/computer-work.cjs');
export async function verifyVendor() {
  const directory = new URL('./vendor/agijobsv0/', import.meta.url), provenance = JSON.parse(fs.readFileSync(new URL('provenance.json', directory), 'utf8'));
  for (const item of provenance.files) fail(await sha256(fs.readFileSync(new URL(item.path, directory), 'utf8')) === item.sha256, 'UPSTREAM_CHANGED');
  return provenance;
}
export async function importAlpha(raw, { budget, repairReserve = '0', now = Date.now() }) {
  const pack = parseStrict(raw, 2_000_000); publicOnly(raw); const provenance = await verifyVendor();
  const verification = await verifyBuildPack(pack);
  fail(Date.parse(pack.compilation.constitution.expiresAt) > now && pack.compilation.constitution.rights.every(r => Date.parse(r.expiresAt) > now), 'SOURCE_RIGHTS_EXPIRED');
  fail(typeof budget === 'string' && budget.length > 0, 'USDC_PRICE_REQUIRED');
  const mission = defaultMission('custom', pack.request.language);
  mission.name = pack.title; mission.purpose = pack.compilation.constitution.objective;
  mission.rights = 'Synthetic nonpersonal inputs. Alpha engine Apache-2.0; AGI Jobs compiler MIT. Source rights require current review.';
  mission.input = 'Pinned Alpha streaming-metrics-builder-v1 workshop; original bytes accompany this import. No native USDC runtime has been commissioned.';
  mission.outputs = 'A separately implemented, checked adaptation of the exact original mission; source, tests and evidence.';
  mission.success = 'Preserve exact aggregation, reject malformed inputs, compare with competent baselines; obtain fresh independent qualification before operation.';
  const state = await createSystem(mission), plan = await prepareImprovement(state, { budget, repairReserve, requested: mission.purpose });
  return { schema: 'agijobmanager/alpha-import/v1', original: { raw, sha256: await sha256(raw), token: pack.token, allowanceBaseUnits: pack.compilation.constitution.budget.limitBaseUnits, evidenceClass: 'historical-local-rehearsal', verifier: { repository: provenance.repository, revision: provenance.revision }, verification }, state, plan, conversion: 'NEW_EXPLICIT_USDC_PRICE_NO_TOKEN_CONVERSION', authority: 'none', qualification: 'not-evaluated', settlement: 'not-connected' };
}

export async function compileComputerWork(plan, context, now = Math.floor(Date.now() / 1000)) {
  await validateImprovement(plan);
  keys(context, ['schema', 'runtimes', 'inputs', 'deadline', 'settlement', 'budget', 'publicConsent'], 'CONTEXT_FIELDS');
  fail(context.schema === 'successor-runtime-context/v1' && context.publicConsent === true, 'PUBLIC_CONSENT');
  keys(context.runtimes, ['agent', 'reviewer'], 'RUNTIMES');
  fail(context.deadline > now + Math.max(context.budget.maxAgentSeconds, context.budget.maxReviewSeconds) + 60, 'EXECUTION_WINDOW');
  fail(Array.isArray(context.inputs) && context.inputs.length === plan.immutableInputs.length, 'INPUT_BINDINGS');
  const inputs = context.inputs.map((input, i) => {
    keys(input, ['name', 'uri', 'sha256', 'maxBytes'], 'INPUT_BINDINGS');
    const expected = plan.immutableInputs[i]; fail(input.name === expected.name && input.sha256 === expected.sha256 && input.maxBytes === Buffer.byteLength(expected.content), 'INPUT_BINDINGS'); publicInputURLs(input.uri);
    return { ...input, mediaType: 'application/json' };
  });
  const mission = parseStrict(plan.immutableInputs[0].content);
  fail(['analyst', 'website'].includes(mission.kind), 'RUNTIME_UNAVAILABLE');
  const delivered = mission.kind === 'website' ? [['index.html', 'text/html'], ['method.json', 'application/json']] : [['report.html', 'text/html'], ['result.json', 'application/json'], ['method.json', 'application/json']];
  const spec = {
    schema: 'agi-node-job/v1', profile: 'computer-work/v2', title: plan.draft.fields.title.slice(0, 160), prompt: plan.goal,
    dataPolicy: 'public', inputs,
    outputs: [...delivered.map(([name, mediaType]) => ({ name, mediaType, maxBytes: plan.outputByteLimit, requirement: 'Actual editable artifact; preserve the immutable mission content and document reproduction.' })), { name: 'checker-results.json', mediaType: 'application/json', maxBytes: 100000, requirement: 'A separate implementation checks actual delivered bytes, retaining failures and uncertainty.' }],
    criteria: [{ id: 'exact-result', requirement: plan.draft.fields.acceptance, verification: 'Reopen original immutable inputs in a separately controlled environment; recompute exact results and inspect actual delivered artifacts.', evidence: [...delivered.map(([name]) => name), 'checker-results.json'] }],
    environment: { runtimeSha256: { agent: digest(context.runtimes.agent), reviewer: digest(context.runtimes.reviewer) }, capabilities: { agent: ['files', 'code'], reviewer: ['files', 'code', 'independent-review'] } },
    authority: { agent: { scope: 'isolated-public', resources: ['job-workspace'] }, reviewer: { scope: 'isolated-public', resources: ['job-workspace'] } },
    budget: context.budget, deadline: context.deadline, settlement: context.settlement,
    coordination: { parentSpecSha256: plan.commitment, dependencies: [], delegation: 'none' },
  };
  validateComputerWork(spec); checkRuntime(spec, context.runtimes.agent, 'agent', now); checkRuntime(spec, context.runtimes.reviewer, 'reviewer', now);
  fail(isHash(spec.environment.runtimeSha256.agent), 'RUNTIME_HASH');
  return { spec, specSha256: digest(spec), sourcePlanCommitment: plan.commitment, formatValidation: 'passed', runtimeBinding: 'passed', authority: 'none', admission: 'REQUIRES_CURRENT_CHECK_NEW_WORK', independentControl: 'UNVERIFIED', hostedInputBytes: 'UNVERIFIED_OPERATOR_FETCH_REQUIRED', published: false };
}

// Admission remains the existing action-bound operator-budget policy, never a UI flag.
export function checkNewWorkBoundary(...args) {
  const { checkNewWork } = require('../economics/admission.cjs');
  return checkNewWork(...args);
}
