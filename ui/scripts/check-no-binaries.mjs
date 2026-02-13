import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const forbiddenExt = /\.(png|jpg|jpeg|gif|webp|pdf|ico|woff|woff2|ttf|otf|zip|tar|gz|7z)$/i;
const forbiddenPaths = [/^ui\/node_modules\//, /^ui\/\.next\//, /^ui\/dist\//, /^ui\/build\//];

function run(cmd) {
  return execSync(cmd, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function getBaseRef() {
  const envBase = process.env.GITHUB_BASE_REF;
  if (envBase) {
    try {
      run(`git fetch --depth=1 origin ${envBase}`);
      return run(`git merge-base HEAD origin/${envBase}`);
    } catch {
      // ignore fallback
    }
  }

  try {
    const defaultRemote = run('git symbolic-ref refs/remotes/origin/HEAD').replace('refs/remotes/', '');
    return run(`git merge-base HEAD ${defaultRemote}`);
  } catch {
    return run('git rev-parse HEAD~1');
  }
}

function isLikelyBinary(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length === 0) return false;
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  let suspicious = 0;
  for (const b of sample) {
    if (b === 0) return true;
    const printable = b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126);
    if (!printable) suspicious += 1;
  }
  return suspicious / sample.length > 0.3;
}

const base = getBaseRef();
const diff = run(`git diff --name-status --diff-filter=A ${base}...HEAD`);
const added = diff
  .split('\n')
  .filter(Boolean)
  .map((line) => line.trim().split(/\s+/))
  .filter((parts) => parts.length >= 2)
  .map((parts) => parts[1]);

const offenders = [];
for (const relPath of added) {
  if (forbiddenExt.test(relPath) || forbiddenPaths.some((rx) => rx.test(relPath))) {
    offenders.push(`${relPath} (forbidden path or extension)`);
    continue;
  }

  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) continue;
  const allowTextByExt = /\.(md|txt|json|yml|yaml|ts|tsx|js|mjs|cjs|css|svg|html|lock|toml|sol|sh|gitignore)$/i.test(relPath);
  if (!allowTextByExt && isLikelyBinary(absPath)) offenders.push(`${relPath} (binary content heuristic)`);
}

if (offenders.length) {
  throw new Error(`Forbidden binary files detected in added files:\n${offenders.map((v) => `- ${v}`).join('\n')}`);
}

console.log(`No forbidden binaries detected in added files (${added.length} additions checked from ${base}...HEAD).`);
