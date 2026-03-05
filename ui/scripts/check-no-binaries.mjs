import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const forbiddenExt = /\.(png|jpg|jpeg|gif|webp|pdf|ico|woff|woff2|ttf|otf|zip|tar|gz|7z|mp4|mov|webm|avi|mkv|trace)$/i;
const sourceTextExt = /\.(html?|css|mjs|cjs|js|jsx|ts|tsx)$/i;
const forbiddenDataUri = /data:(?:image|font)\/[a-z0-9.+-]+(?:;[a-z0-9.+-]+(?:=(?:"[^"]*"|'[^']*'|[^;,)'"\s>]+))?)*,/i;
const forbiddenPaths = [
  /^\.git\//,
  /^node_modules\//,
  /^ui\/node_modules\//,
  /^\.next\//,
  /^ui\/\.next\//,
  /^(dist|build)\//i,
  /^ui\/(dist|build)\//i
];


const dataUriScanExclusions = [
  /^scripts\/check-no-binaries\.mjs$/,
  /^ui\/scripts\/build-ipfs\.mjs$/,
  /^ui\/scripts\/check-no-binaries\.mjs$/,
  /^docs\/ui\/agijobmanager\.html$/
];

const criticalTextSources = [
  'agijobmanager.html',
  'ui/dist-ipfs/agijobmanager.html'
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
const trackedTextSources = run('git ls-files')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line)
  .filter((line) => sourceTextExt.test(line))
  .filter((line) => !forbiddenPaths.some((re) => re.test(line)))
  .filter((line) => !dataUriScanExclusions.some((re) => re.test(line)));

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
    continue;
  }

  if (sourceTextExt.test(file)) {
    const text = blob.toString('utf8');
    if (forbiddenDataUri.test(text)) {
      offenders.push(`${file} (forbidden data:image/* or data:font/* URI)`);
    }
  }
}

for (const file of trackedTextSources) {
  const absolute = path.join(repoRoot, file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
  const blob = fs.readFileSync(absolute);
  if (blob.includes(0)) {
    offenders.push(`${file} (NUL byte detected in tracked text source)`);
    continue;
  }
  const text = blob.toString('utf8');
  if (forbiddenDataUri.test(text)) {
    offenders.push(`${file} (forbidden data:image/* or data:font/* URI in tracked source)`);
  }
}

for (const file of criticalTextSources) {
  const absolute = path.join(repoRoot, file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
  const blob = fs.readFileSync(absolute);
  if (blob.includes(0)) {
    offenders.push(`${file} (NUL byte detected in required single-file artifact)`);
    continue;
  }
  const text = blob.toString('utf8');
  if (forbiddenDataUri.test(text)) {
    offenders.push(`${file} (forbidden data:image/* or data:font/* URI in required single-file artifact)`);
  }
}

if (offenders.length) {
  throw new Error(`Forbidden binary/data URI policy violations:\n${offenders.map((f) => `- ${f}`).join('\n')}`);
}

console.log(`No forbidden binaries detected in ${added.length} added file(s) from ${base}...HEAD.`);
