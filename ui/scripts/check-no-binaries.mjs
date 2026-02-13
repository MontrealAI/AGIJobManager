import { execSync } from 'node:child_process';
import path from 'node:path';

const forbidden = /\.(png|jpg|jpeg|gif|webp|pdf|woff|woff2|ttf|otf|zip|tar|gz)$/i;
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

  return run('git rev-parse HEAD~1') || 'HEAD';
}

const base = getDiffTarget();
const output = run(`git diff --name-status --diff-filter=A ${base}...HEAD`);

const added = output
  .split('\n')
  .map((line) => line.trim().split(/\s+/))
  .filter((parts) => parts.length >= 2)
  .map((parts) => parts[1]);

const offenders = added.filter((file) => forbidden.test(file));
if (offenders.length) {
  throw new Error(`Forbidden binary extensions detected in added files:\n${offenders.map((f) => `- ${f}`).join('\n')}`);
}

console.log(`No forbidden binary extensions detected in added files (checked ${added.length} additions from ${base}...HEAD).`);
