import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
execFileSync('node', [path.join(root, 'ui/scripts/sync-deployments.mjs')], { cwd: path.join(root, 'ui'), stdio: 'inherit' });
const scripts = [
  'scripts/docs/current-release.mjs',
  'scripts/docs/release-alignment.mjs',
  'scripts/docs/generate-versions.mjs',
  'scripts/docs/generate-contract-interface.mjs',
  'scripts/docs/generate-repo-map.mjs',
  'scripts/docs/generate-events-errors.mjs',
  'scripts/docs/generate-ens-reference.mjs'
];

for (const script of scripts) {
  execFileSync('node', [script, ...((script.endsWith('release-alignment.mjs') || script.endsWith('current-release.mjs')) ? ['--write'] : [])], { cwd: root, stdio: 'inherit' });
}
