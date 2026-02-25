import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const uiRoot = process.cwd();
const repoRoot = path.resolve(uiRoot, '..');
const builtHtml = path.join(uiRoot, 'dist-ipfs', 'agijobmanager.html');
const committedHtml = path.join(repoRoot, 'agijobmanager.html');

if (!fs.existsSync(builtHtml)) {
  throw new Error(`Missing build artifact ${path.relative(repoRoot, builtHtml)}. Run \`cd ui && npm run build:ipfs\` first.`);
}

if (!fs.existsSync(committedHtml)) {
  throw new Error(`Missing committed artifact ${path.relative(repoRoot, committedHtml)}. Copy from ui/dist-ipfs/agijobmanager.html.`);
}

const built = fs.readFileSync(builtHtml);
const committed = fs.readFileSync(committedHtml);

if (Buffer.compare(built, committed) !== 0) {
  const builtHash = createHash('sha256').update(built).digest('hex');
  const committedHash = createHash('sha256').update(committed).digest('hex');
  throw new Error(
    `agijobmanager.html is stale (built sha256=${builtHash}, committed sha256=${committedHash}). Run ` +
      '`cd ui && npm run build:ipfs && cp dist-ipfs/agijobmanager.html ../agijobmanager.html` and commit.'
  );
}

console.log('Committed agijobmanager.html matches ui/dist-ipfs/agijobmanager.html.');
