import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const scripts = [
  'scripts/docs/generate-versions.mjs',
  'scripts/docs/generate-contract-interface.mjs',
  'scripts/docs/generate-repo-map.mjs',
  'scripts/docs/generate-events-errors.mjs',
  'scripts/docs/generate-ens-reference.mjs'
];

for (const script of scripts) {
  execFileSync('node', [script], { cwd: root, stdio: 'inherit' });
}
