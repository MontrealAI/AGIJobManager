import fs from 'node:fs';
import path from 'node:path';

const uiRoot = process.cwd();
const artifactPath = path.join(uiRoot, 'dist-ipfs', 'agijobmanager.html');

if (!fs.existsSync(artifactPath)) {
  throw new Error('dist-ipfs/agijobmanager.html missing. Run npm run build:ipfs first.');
}

const html = fs.readFileSync(artifactPath, 'utf8');
const requiredRuntimeMarkers = [
  'AGI_SINGLE_FILE_RUNTIME_BOOTSTRAP_V1',
  'AGI_CONTRACT_ABI_REGISTRY_V1',
  'AGI_FULL_APP_MOUNT_V1',
  'window.__AGI_RUNTIME_BUNDLE__=',
  'window.__AGI_APP_BOOTSTRAP__=function AGIAppBootstrap()',
  'Connect Wallet'
];

for (const marker of requiredRuntimeMarkers) {
  if (!html.includes(marker)) {
    throw new Error(`Single-file artifact appears stub-only; missing runtime marker: ${marker}`);
  }
}

const htmlBytes = Buffer.byteLength(html, 'utf8');
if (htmlBytes < 1000000) {
  throw new Error(`Single-file artifact is unexpectedly small (${htmlBytes} bytes). Expected full runtime bundle >= 1000000 bytes.`);
}

console.log(`Runtime bundle markers verified (bytes=${htmlBytes}).`);
