import fs from 'node:fs';
import { canonical } from '../../site/assets/successor/safe.mjs';
import { createProject, publicDataOpportunity } from '../../site/assets/successor/vendor/alpha-project/examples/successor-project/engine.mjs';
import { createRecord } from '../../site/assets/successor/vendor/alpha-project/examples/successor-workbench/mission-record.mjs';
import { example } from '../../site/assets/successor/vendor/alpha-project/examples/successor-workbench/engine.mjs';
import { createBrief } from '../../site/assets/successor/vendor/alpha-project/examples/alpha-discovery/engine.mjs';
import { ALPHA_SOURCE } from '../../site/assets/successor/alpha-project.mjs';
const provenance = JSON.parse(fs.readFileSync('site/assets/successor/vendor/alpha-project/provenance.json'));
export async function fixture() {
  const sourceHash = '2052b3fa57693fd2076cd32f452a2422c445cce537fbeb8588923f099bb860b9';
  const spec = example('public-data'); spec.inputs.csv = 'group,amount\nÉnergie,2\nÉnergie,2\nWind,-1\n';
  const record = await createRecord({ missionId: 'browser-native', sourceHash, spec });
  const source = relative => ({ repository: ALPHA_SOURCE.repository, commit: ALPHA_SOURCE.commit, path: relative, sha256: provenance.files[relative] });
  return canonical(await createProject({ projectId: 'browser-project', cycleId: 'browser-cycle', sourceHash, record, discoveryBytes: canonical(await createBrief(publicDataOpportunity(), sourceHash)), choices: { family: 'public-data', selection: 'explicit-user-selection', duplicatePolicy: 'sum-all-rows-no-deduplication', unitPolicy: 'unchanged-integer-units', dataRights: 'synthetic' }, sources: { discovery: source('examples/alpha-discovery/engine.mjs'), mission: source('examples/successor-workbench/mission-record.mjs') } }));
}
