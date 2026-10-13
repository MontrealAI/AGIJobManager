#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fail, parseStrict, LIMITS } from '../../site/assets/successor/safe.mjs';
import { defaultMission } from '../../site/assets/successor/missions.mjs';
import { createSystem, runCandidate, chooseCandidate, compareCandidates, exportCapsule, inspectCapsule, restoreCapsule, readableSummary } from '../../site/assets/successor/model.mjs';
import { prepareImprovement } from '../../site/assets/successor/jobs.mjs';
import { compileComputerWork, importAlpha } from './adapter.mjs';
import { builderArtifacts, buildSuccessor } from './build.mjs';

function read(file) { const stat = fs.lstatSync(file); fail(stat.isFile() && !stat.isSymbolicLink() && stat.size <= LIMITS.capsule, 'INPUT_FILE'); return fs.readFileSync(file, 'utf8'); }
function write(file, value) { fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }
const [command, ...args] = process.argv.slice(2);
try {
  const source = () => builderArtifacts().sourceManifest;
  if (command === 'example' && args.length === 2) { fail(['analyst', 'website', 'custom'].includes(args[0]), 'MISSION_KIND'); write(args[1], defaultMission(args[0])); }
  else if (command === 'validate' && args.length === 1) { const { summary } = await inspectCapsule(read(args[0])); console.log(JSON.stringify(summary, null, 2)); }
  else if (command === 'run' && args.length === 2) { const mission = parseStrict(read(args[0])), state = await createSystem(mission), manifest = source(); const result = await runCandidate(state, 'baseline', manifest.engineSha256); write(args[1], await exportCapsule(result.state, manifest)); }
  else if (command === 'choose' && args.length === 3) { const { capsule } = await inspectCapsule(read(args[0])); let state = capsule.payload.state; const target = args[1] === 'latest' ? state.candidates.at(-1) : state.candidates.find(c => c.id === args[1]); fail(target, 'CANDIDATE_REQUIRED'); state = await chooseCandidate(state, target.id, state.active ? 'replace' : 'keep'); write(args[2], await exportCapsule(state, capsule.payload.sourceManifest)); }
  else if (command === 'rollback' && args.length === 3) { const { capsule } = await inspectCapsule(read(args[0])); write(args[2], await exportCapsule(await chooseCandidate(capsule.payload.state, args[1], 'rollback'), capsule.payload.sourceManifest)); }
  else if (command === 'improve' && args.length === 2) { const { capsule } = await inspectCapsule(read(args[0])), result = await runCandidate(capsule.payload.state, 'improved', source().engineSha256); const old = result.state.candidates.find(c => c.id === result.state.active); fail(old, 'SELECT_VERSION'); console.log(JSON.stringify(compareCandidates(old, result.candidate), null, 2)); write(args[1], await exportCapsule(result.state, source())); }
  else if (command === 'plan' && args.length === 3) { const { capsule } = await inspectCapsule(read(args[0])); write(args[2], await prepareImprovement(capsule.payload.state, { budget: args[1] })); }
  else if (command === 'compile' && args.length === 3) { write(args[2], await compileComputerWork(parseStrict(read(args[0])), parseStrict(read(args[1])))); }
  else if (command === 'import-alpha' && args.length === 3) { write(args[2], await importAlpha(read(args[0]), { budget: args[1] })); }
  else if (command === 'inspect' && args.length === 1) { const { capsule } = await inspectCapsule(read(args[0])); console.log(readableSummary(capsule.payload.state)); }
  else if (command === 'restore' && args.length === 3 && args[1] === '--confirm') { const inspected = await inspectCapsule(read(args[0])); write(args[2], await exportCapsule(await restoreCapsule(inspected, true), inspected.capsule.payload.sourceManifest)); }
  else if (command === 'export' && args.length === 2) {
    const { capsule } = await inspectCapsule(read(args[0])); fail(!fs.existsSync(args[1]), 'OUTPUT_EXISTS');
    const artifacts = buildSuccessor(args[1]); const raw = await exportCapsule(capsule.payload.state, artifacts.sourceManifest);
    write(path.join(args[1], 'capsule.json'), raw); write(path.join(args[1], 'SUMMARY.txt'), readableSummary(capsule.payload.state));
    const active = capsule.payload.state.candidates.find(c => c.id === capsule.payload.state.active);
    for (const file of active?.files || []) write(path.join(args[1], file.name), file.content);
  } else {
    console.log('SUCCESSOR Ω — offline, no wallet or provider access\n\nexample analyst|website|custom mission.json\nrun mission.json unselected.json\nchoose unselected.json latest selected.json\nimprove selected.json compared.json\nchoose compared.json latest improved.json\nrollback improved.json CANDIDATE_HASH restored.json\nplan selected.json USDC_BUDGET draft.json\ncompile draft.json runtime-context.json specification.json\nimport-alpha original-pack.json NEW_USDC_BUDGET imported.json\nvalidate|inspect capsule.json\nrestore capsule.json --confirm restored.json\nexport capsule.json NEW_OUTPUT_DIRECTORY\n\nAll outputs refuse overwrite. Run/choose are local preferences, never operational admission.');
    if (command && command !== '--help') process.exitCode = 1;
  }
} catch (error) { if (error.failureState && command === 'improve' && args.length === 2) write(args[1], await exportCapsule(error.failureState, builderArtifacts().sourceManifest));
  console.error(JSON.stringify({ code: error.code || error.message, message: error.message, authority: 'none' })); process.exitCode = 1; }
