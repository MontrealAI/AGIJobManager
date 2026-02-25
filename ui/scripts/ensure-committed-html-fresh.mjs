import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const uiRoot = process.cwd();
const repoRoot = path.resolve(uiRoot, '..');
const builtPath = path.join(uiRoot, 'dist-ipfs', 'agijobmanager.html');
const committedPath = path.join(repoRoot, 'agijobmanager.html');

function run(cmd) {
  execSync(cmd, { cwd: uiRoot, stdio: 'inherit' });
}

if (!fs.existsSync(builtPath)) {
  run('npm run build:ipfs');
}

if (!fs.existsSync(committedPath)) {
  throw new Error('Missing committed artifact: agijobmanager.html at repository root. Run `cp ui/dist-ipfs/agijobmanager.html ./agijobmanager.html`.');
}

const built = fs.readFileSync(builtPath, 'utf8');
const committed = fs.readFileSync(committedPath, 'utf8');

if (built !== committed) {
  throw new Error('Committed root agijobmanager.html is stale. Rebuild UI and copy ui/dist-ipfs/agijobmanager.html to repository root.');
}

console.log('Committed root agijobmanager.html matches ui/dist-ipfs/agijobmanager.html.');
