import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const uiRoot = process.cwd();
const repoRoot = path.resolve(uiRoot, '..');
const builtHtml = path.join(uiRoot, 'dist-ipfs', 'agijobmanager.html');
const committedHtml = path.join(repoRoot, 'agijobmanager.html');

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function readOrThrow(targetPath, message) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(message);
  }
  return fs.readFileSync(targetPath);
}

function compareBuiltToCommitted() {
  const built = readOrThrow(
    builtHtml,
    `Missing build artifact ${path.relative(repoRoot, builtHtml)}. Run \`cd ui && npm run build:ipfs\` first.`
  );
  const committed = readOrThrow(
    committedHtml,
    `Missing committed artifact ${path.relative(repoRoot, committedHtml)}. Copy from ui/dist-ipfs/agijobmanager.html.`
  );

  return {
    built,
    committed,
    builtHash: sha256(built),
    committedHash: sha256(committed),
    match: Buffer.compare(built, committed) === 0
  };
}

function cleanRebuildWithoutPublicEnv() {
  fs.rmSync(path.join(uiRoot, '.next'), { recursive: true, force: true });
  fs.rmSync(path.join(uiRoot, 'dist-ipfs'), { recursive: true, force: true });

  const env = { ...process.env };
  delete env.NEXT_PUBLIC_DEMO_MODE;
  delete env.NEXT_PUBLIC_DEMO_ACTOR;
  delete env.NEXT_PUBLIC_CHAIN_ID;
  delete env.NEXT_PUBLIC_AGI_JOB_MANAGER_ADDRESS;
  delete env.NEXT_PUBLIC_AGI_TOKEN_ADDRESS;

  execSync('npm run build:ipfs', { cwd: uiRoot, stdio: 'inherit', env });
}

const first = compareBuiltToCommitted();
if (first.match) {
  console.log(
    `Committed agijobmanager.html matches ui/dist-ipfs/agijobmanager.html (sha256=${first.builtHash}, bytes=${first.built.length}).`
  );
  process.exit(0);
}

cleanRebuildWithoutPublicEnv();

const second = compareBuiltToCommitted();
if (second.match) {
  console.warn(
    `Initial dist mismatch resolved after clean rebuild (initial=${first.builtHash}, rebuilt=${second.builtHash}, committed=${second.committedHash}).`
  );
  process.exit(0);
}

throw new Error(
  `agijobmanager.html is stale after clean rebuild (initial=${first.builtHash}, rebuilt=${second.builtHash}, committed=${second.committedHash}). Run ` +
    '`cd ui && npm run build:ipfs && cp dist-ipfs/agijobmanager.html ../agijobmanager.html` and commit.'
);
