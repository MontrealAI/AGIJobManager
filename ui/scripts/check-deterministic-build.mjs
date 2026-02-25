import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const uiRoot = process.cwd();
const outputPath = path.join(uiRoot, 'dist-ipfs', 'agijobmanager.html');
const coldBuildPaths = [path.join(uiRoot, '.next'), path.join(uiRoot, 'dist-ipfs')];

function run(cmd) {
  execSync(cmd, { cwd: uiRoot, stdio: 'inherit' });
}

function cleanBuildState() {
  for (const target of coldBuildPaths) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

cleanBuildState();
run('npm run build:ipfs');
if (!fs.existsSync(outputPath)) {
  throw new Error(`Missing first build artifact at ${outputPath}`);
}
const first = fs.readFileSync(outputPath);
const firstHash = hashFile(outputPath);

cleanBuildState();
run('npm run build:ipfs');
if (!fs.existsSync(outputPath)) {
  throw new Error(`Missing second build artifact at ${outputPath}`);
}
const second = fs.readFileSync(outputPath);
const secondHash = hashFile(outputPath);

if (firstHash !== secondHash || Buffer.compare(first, second) !== 0) {
  throw new Error(`Deterministic build check failed: ${firstHash} != ${secondHash}`);
}

console.log(`Deterministic cold-build check passed (sha256: ${firstHash}).`);
