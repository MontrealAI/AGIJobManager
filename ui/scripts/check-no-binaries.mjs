import { execSync } from 'node:child_process';
import path from 'node:path';

const forbidden = /\.(png|jpg|jpeg|gif|webp|pdf|woff|woff2|ttf|otf|zip|tar|gz)$/i;

const output = execSync('git diff --name-status --diff-filter=A HEAD', { cwd: path.resolve(process.cwd(), '..') }).toString().trim();
const added = output
  .split('\n')
  .map((line) => line.trim().split(/\s+/))
  .filter((parts) => parts.length >= 2)
  .map((parts) => parts[1]);

const offenders = added.filter((file) => forbidden.test(file));
if (offenders.length) {
  throw new Error(`Forbidden binary extensions detected in added files:\n${offenders.map((f) => `- ${f}`).join('\n')}`);
}

console.log('No forbidden binary extensions detected in added files.');
