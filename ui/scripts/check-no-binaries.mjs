import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const forbiddenExt = /\.(png|jpg|jpeg|gif|webp|pdf|ico|woff|woff2|ttf|otf|zip|tar|gz|7z|mp4|webm)$/i;
const textAllowExt = new Set([
  '.md', '.mdx', '.txt', '.json', '.jsonc', '.yaml', '.yml', '.toml', '.ini', '.env', '.example',
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.scss', '.html', '.svg', '.xml', '.sh', '.sol', '.lock'
]);
const repoRoot = path.resolve(process.cwd(), '..');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

function getDiffTarget() {
  const fromEnv = process.env.GITHUB_BASE_REF;
  if (fromEnv) {
    run(`git fetch --depth=1 origin ${fromEnv}`);
    const base = run(`git merge-base HEAD origin/${fromEnv}`);
    if (base) return base;
  }
  const defaultRemote = run('git symbolic-ref refs/remotes/origin/HEAD').replace('refs/remotes/', '');
  if (defaultRemote) {
    const base = run(`git merge-base HEAD ${defaultRemote}`);
    if (base) return base;
  }
  return run('git rev-parse HEAD~1') || 'HEAD';
}

function isProbablyBinary(buf) {
  if (!buf.length) return false;
  if (buf.includes(0)) return true;
  let suspicious = 0;
  for (const byte of buf) {
    if (byte < 7 || (byte > 14 && byte < 32) || byte === 127) suspicious += 1;
  }
  return suspicious / buf.length > 0.3;
}

const base = getDiffTarget();
const output = run(`git diff --name-status --diff-filter=A ${base}...HEAD`);
const added = output
  .split('\n')
  .map((line) => line.trim().split(/\s+/))
  .filter((parts) => parts.length >= 2)
  .map((parts) => parts[1]);

const offenders = [];
for (const file of added) {
  const abs = path.join(repoRoot, file);
  const ext = path.extname(file).toLowerCase();
  if (forbiddenExt.test(file)) {
    offenders.push(`${file} (forbidden extension)`);
    continue;
  }
  if (!fs.existsSync(abs)) continue;
  if (!textAllowExt.has(ext)) {
    const buf = fs.readFileSync(abs);
    if (isProbablyBinary(buf)) offenders.push(`${file} (binary content heuristic)`);
  }
}

if (offenders.length) {
  throw new Error(`Forbidden binary files detected among added files:\n${offenders.map((f) => `- ${f}`).join('\n')}`);
}

console.log(`No binary additions detected (${added.length} added files checked from ${base}...HEAD).`);
