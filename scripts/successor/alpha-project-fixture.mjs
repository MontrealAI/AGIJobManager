import fs from 'node:fs';
import { canonical, sha256 } from '../../site/assets/successor/safe.mjs';
import { runCandidate, exportCapsule } from '../../site/assets/successor/model.mjs';
import { createProject, publicDataOpportunity } from '../../site/assets/successor/vendor/alpha-project/examples/successor-project/engine.mjs';
import { createRecord } from '../../site/assets/successor/vendor/alpha-project/examples/successor-workbench/mission-record.mjs';
import { example } from '../../site/assets/successor/vendor/alpha-project/examples/successor-workbench/engine.mjs';
import { createBrief } from '../../site/assets/successor/vendor/alpha-project/examples/alpha-discovery/engine.mjs';
import { ALPHA_SOURCE, importAlphaProject, advanceAlphaProject, inspectAlphaProject } from '../../site/assets/successor/alpha-project.mjs';
const provenance = JSON.parse(fs.readFileSync('site/assets/successor/vendor/alpha-project/provenance.json'));
export async function fixture() {
  const sourceHash = '2052b3fa57693fd2076cd32f452a2422c445cce537fbeb8588923f099bb860b9';
  const spec = example('public-data'); spec.inputs.csv = 'group,amount\nÉnergie,2\nÉnergie,2\nWind,-1\n';
  const record = await createRecord({ missionId: 'browser-native', sourceHash, spec });
  const source = relative => ({ repository: ALPHA_SOURCE.repository, commit: ALPHA_SOURCE.commit, path: relative, sha256: provenance.files[relative] });
  return canonical(await createProject({ projectId: 'browser-project', cycleId: 'browser-cycle', sourceHash, record, discoveryBytes: canonical(await createBrief(publicDataOpportunity(), sourceHash)), choices: { family: 'public-data', selection: 'explicit-user-selection', duplicatePolicy: 'sum-all-rows-no-deduplication', unitPolicy: 'unchanged-integer-units', dataRights: 'synthetic' }, sources: { discovery: source('examples/alpha-discovery/engine.mjs'), mission: source('examples/successor-workbench/mission-record.mjs') } }));
}

// The eighth run represents a valid history written before draft-slot reservation.
// Construct its real model transition explicitly; the current writer must refuse it.
export async function capacityFixtures(context) {
  const histories = [await importAlphaProject(await fixture(), { language: 'en', mappingAcknowledgement: 'alpha-public-data-to-manager-rows/v1' }, context)];
  while (histories.length < 7) histories.push(await advanceAlphaProject(histories.at(-1), { action: 'run' }, context));
  const { transfer, state } = await inspectAlphaProject(histories.at(-1), context);
  const next = (await runCandidate(state, 'baseline', context.sourceManifest.engineSha256)).state;
  const capsule = await exportCapsule(next, context.sourceManifest);
  transfer.history.push({ kind: 'local-run', capsule, sha256: await sha256(capsule) }); delete transfer.sha256;
  histories.push(canonical({ ...transfer, sha256: await sha256(transfer) }));
  await inspectAlphaProject(histories.at(-1), context); return histories;
}
