import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const uiRoot = process.cwd();
const repoRoot = path.resolve(uiRoot, '..');
const builtHtml = path.join(uiRoot, 'dist-ipfs', 'agijobmanager.html');
const committedHtml = path.join(repoRoot, 'agijobmanager.html');

const skipBuild = process.argv.includes('--skip-build');

if (!skipBuild) {
  execSync('npm run build:ipfs', { cwd: uiRoot, stdio: 'inherit' });
}

if (!fs.existsSync(builtHtml)) {
  throw new Error(`Missing build artifact ${path.relative(repoRoot, builtHtml)}`);
}

if (!fs.existsSync(committedHtml)) {
  throw new Error(`Missing committed artifact ${path.relative(repoRoot, committedHtml)}. Copy from ui/dist-ipfs/agijobmanager.html.`);
}

const built = fs.readFileSync(builtHtml);
const committed = fs.readFileSync(committedHtml);

if (Buffer.compare(built, committed) !== 0) {
  throw new Error('agijobmanager.html is stale. Run `cd ui && npm run build:ipfs && cp dist-ipfs/agijobmanager.html ../agijobmanager.html` and commit.');
}

console.log(`Committed agijobmanager.html matches ui/dist-ipfs/agijobmanager.html${skipBuild ? ' (checked without rebuilding)' : ''}.`);
