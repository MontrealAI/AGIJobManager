import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const uiRoot = process.cwd();
const repoRoot = path.resolve(uiRoot, '..');
const builtHtml = path.join(uiRoot, 'dist-ipfs', 'agijobmanager.html');
const committedHtml = path.join(repoRoot, 'agijobmanager.html');

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

function runCanonicalBuild() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('NEXT_PUBLIC_')) delete env[key];
  }
  execSync('npm run build:ipfs', { cwd: uiRoot, stdio: 'inherit', env });
}

if (!fs.existsSync(builtHtml)) {
  runCanonicalBuild();
}

if (!fs.existsSync(builtHtml)) {
  throw new Error(`Missing build artifact ${path.relative(repoRoot, builtHtml)}`);
}

if (!fs.existsSync(committedHtml)) {
  throw new Error(`Missing committed artifact ${path.relative(repoRoot, committedHtml)}. Copy from ui/dist-ipfs/agijobmanager.html.`);
}

let built = fs.readFileSync(builtHtml);
const committed = fs.readFileSync(committedHtml);

if (Buffer.compare(built, committed) !== 0) {
  // Rebuild once in a canonical environment to avoid false negatives from workflow-level NEXT_PUBLIC_* env overrides.
  runCanonicalBuild();
  built = fs.readFileSync(builtHtml);
}

if (Buffer.compare(built, committed) !== 0) {
  const builtHash = hash(built);
  const committedHash = hash(committed);
  throw new Error(
    `agijobmanager.html is stale (built sha256=${builtHash}, committed sha256=${committedHash}). Run ` +
    '`cd ui && npm run build:ipfs && cp dist-ipfs/agijobmanager.html ../agijobmanager.html` and commit.'
  );
}

console.log('Committed agijobmanager.html matches ui/dist-ipfs/agijobmanager.html.');
