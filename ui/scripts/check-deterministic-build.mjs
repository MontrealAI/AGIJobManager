import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const uiRoot = process.cwd();
const outputPath = path.join(uiRoot, 'dist-ipfs', 'agijobmanager.html');
const buildArtifactsToClean = [path.join(uiRoot, '.next'), path.join(uiRoot, 'dist-ipfs')];

function run(cmd) {
  execSync(cmd, { cwd: uiRoot, stdio: 'inherit' });
}

function cleanBuildState() {
  for (const target of buildArtifactsToClean) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function buildFromCleanState(passLabel) {
  cleanBuildState();
  run('npm run build:ipfs');
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Missing ${passLabel} build artifact at ${outputPath}`);
  }

  return {
    bytes: fs.readFileSync(outputPath),
    hash: hashFile(outputPath)
  };
}

const first = buildFromCleanState('first');
const second = buildFromCleanState('second');

if (first.hash !== second.hash || Buffer.compare(first.bytes, second.bytes) !== 0) {
  throw new Error(`Deterministic build check failed: ${first.hash} != ${second.hash}`);
}

console.log(`Deterministic build passed from clean state (sha256: ${first.hash}).`);
