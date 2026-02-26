import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const uiRoot = process.cwd();
const outputPath = path.join(uiRoot, 'dist-ipfs', 'agijobmanager.html');
const cleanPaths = [
  path.join(uiRoot, '.next'),
  path.join(uiRoot, 'dist-ipfs')
];

function run(cmd) {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
  for (const key of Object.keys(env)) {
    if (key.startsWith('NEXT_PUBLIC_')) {
      delete env[key];
    }
  }
  execSync(cmd, { cwd: uiRoot, stdio: 'inherit', env });
}

function cleanBuildState() {
  for (const target of cleanPaths) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function buildAndCapture(passName) {
  cleanBuildState();
  run('npm run build:ipfs');
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Missing ${passName} build artifact at ${outputPath}`);
  }
  const bytes = fs.readFileSync(outputPath);
  const hash = hashFile(outputPath);
  return { bytes, hash };
}

const first = buildAndCapture('first');
const second = buildAndCapture('second');

if (first.hash !== second.hash || Buffer.compare(first.bytes, second.bytes) !== 0) {
  throw new Error(`Deterministic build check failed: ${first.hash} != ${second.hash}`);
}

console.log(`Deterministic build passed from clean state (sha256: ${first.hash}).`);
