import crypto from 'node:crypto';
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

const runtimePayloadMatch = html.match(/window\.__AGI_RUNTIME_BUNDLE__=(\{[\s\S]*?\});window\.__AGI_CONTRACT_ABI_REGISTRY__/);
if (!runtimePayloadMatch) {
  throw new Error('Runtime payload blob is missing from single-file artifact.');
}

let runtimeBundle;
try {
  runtimeBundle = JSON.parse(runtimePayloadMatch[1]);
} catch (error) {
  throw new Error(`Runtime payload JSON is malformed: ${error instanceof Error ? error.message : 'unknown parse error'}`);
}

if (runtimeBundle?.bootstrapMarker !== 'AGI_SINGLE_FILE_RUNTIME_BOOTSTRAP_V1') {
  throw new Error('Runtime payload bootstrap marker mismatch.');
}

if (!runtimeBundle?.sources || typeof runtimeBundle.sources !== 'object') {
  throw new Error('Runtime payload is missing embedded source registry.');
}

const sourceKeys = Object.keys(runtimeBundle.sources);
if (sourceKeys.length < 20) {
  throw new Error(`Runtime payload appears incomplete (source registry too small: ${sourceKeys.length}).`);
}

const mustIncludeSources = [
  'src/lib/eip1193.ts',
  'src/lib/web3/queries.ts',
  'src/components/header.tsx',
  'config/usdc-deployment.json',
  'src/lib/usdc.ts',
  'src/abis/agiJobManager.ts'
];

for (const key of mustIncludeSources) {
  if (!sourceKeys.includes(key)) {
    throw new Error(`Runtime payload missing required embedded source: ${key}`);
  }
}

const htmlBytes = Buffer.byteLength(html, 'utf8');
if (runtimeBundle.sourcesSha256 !== crypto.createHash('sha256').update(JSON.stringify(runtimeBundle.sources)).digest('hex')) {
  throw new Error('Embedded source registry checksum mismatch.');
}
if (sourceKeys.some((key) => key.startsWith('hardhat/deployments/'))) {
  throw new Error('Historical non-USDC deployment leaked into the active runtime bundle.');
}

console.log(`Runtime bundle markers verified (bytes=${htmlBytes}, embeddedSources=${sourceKeys.length}).`);
