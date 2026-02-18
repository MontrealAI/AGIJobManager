import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const forbiddenExt = /\.(png|jpg|jpeg|gif|webp|pdf|ico|woff|woff2|ttf|otf|zip|tar|gz|7z|mp4|mov|webm|avi|mkv|trace)$/i;
const forbiddenPaths = [
  /^node_modules\//,
  /^ui\/node_modules\//,
  /^\.next\//,
  /^ui\/\.next\//,
  /^(dist|build)\//i,
  /^ui\/(dist|build)\//i
];
const repoRoot = path.resolve(process.cwd(), '..');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

function isProbablyBinary(buffer) {
  const size = Math.min(buffer.length, 8192);
  if (!size) return false;
  let suspicious = 0;
  for (let i = 0; i < size; i += 1) {
    const byte = buffer[i];
    if (byte === 0) return true;
    const isControl = byte < 7 || (byte > 14 && byte < 32);
    if (isControl) suspicious += 1;
  }
  return suspicious / size > 0.3;
}

function getDiffTarget() {
  const fromEnv = process.env.GITHUB_BASE_REF;
  if (fromEnv) {
    const remoteBase = `origin/${fromEnv}`;
    run(`git fetch --depth=1 origin ${fromEnv}`);
    const mergeBase = run(`git merge-base HEAD ${remoteBase}`);
    if (mergeBase) return mergeBase;
  }

  const defaultRemote = run('git symbolic-ref refs/remotes/origin/HEAD').replace('refs/remotes/', '');
  if (defaultRemote) {
    const mergeBase = run(`git merge-base HEAD ${defaultRemote}`);
    if (mergeBase) return mergeBase;
  }

  return run('git merge-base HEAD origin/main') || run('git rev-parse HEAD~1') || 'HEAD';
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
  if (forbiddenExt.test(file) || forbiddenPaths.some((re) => re.test(file))) {
    offenders.push(`${file} (forbidden path or extension)`);
    continue;
  }

  const absolute = path.join(repoRoot, file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
  const blob = fs.readFileSync(absolute);
  if (isProbablyBinary(blob)) {
    offenders.push(`${file} (binary-like content)`);
  }
}

if (offenders.length) {
  throw new Error(`Forbidden binary files detected in added files:\n${offenders.map((f) => `- ${f}`).join('\n')}`);
}

console.log(`No forbidden binaries detected in ${added.length} added file(s) from ${base}...HEAD.`);
