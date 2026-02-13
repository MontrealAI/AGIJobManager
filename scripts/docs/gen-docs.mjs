import { execSync } from 'child_process';

const commands = [
  'node scripts/docs/generate-versions.mjs',
  'node scripts/docs/generate-contract-interface.mjs',
  'node scripts/docs/generate-repo-map.mjs',
];

for (const cmd of commands) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}
