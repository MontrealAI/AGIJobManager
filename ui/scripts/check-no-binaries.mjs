import { execSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const forbidden = /\.(png|jpg|jpeg|gif|webp|pdf|woff|woff2|ttf|otf|zip|tar|gz)$/i;

function getAddedFiles() {
  const baseRef = process.env.GITHUB_BASE_REF;
  const candidates = [];

  if (baseRef) candidates.push(`origin/${baseRef}...HEAD`);
  candidates.push('HEAD~1..HEAD');

  for (const range of candidates) {
    try {
      const out = execSync(`git diff --name-only --diff-filter=A ${range}`, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
      if (!out) continue;
      return out.split('\n').filter(Boolean);
    } catch {
      // try next candidate
    }
  }

  return execSync('git ls-files', { cwd: repoRoot }).toString().trim().split('\n').filter(Boolean);
}

const offenders = getAddedFiles().filter((file) => forbidden.test(file));
if (offenders.length > 0) {
  console.error('Forbidden binary extensions detected:');
  for (const file of offenders) console.error(` - ${file}`);
  process.exit(1);
}

console.log('No forbidden binary extensions detected.');
