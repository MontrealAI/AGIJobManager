import { execSync } from 'node:child_process';

const forbidden = /\.(png|jpg|jpeg|gif|webp|pdf|woff|woff2|ttf|otf|zip|tar|gz)$/i;

const output = execSync('git diff --name-status --diff-filter=A --cached -- .', { encoding: 'utf8' }).trim();
if (!output) {
  console.log('No added files staged; no-binaries check passed.');
  process.exit(0);
}

const offenders = output
  .split('\n')
  .map((line) => line.trim().split(/\s+/, 2))
  .filter(([, file]) => file && forbidden.test(file))
  .map(([, file]) => file);

if (offenders.length) {
  console.error('Forbidden binary-like extensions detected in added files:');
  for (const file of offenders) console.error(` - ${file}`);
  process.exit(1);
}

console.log('No forbidden binary extensions in added files.');
