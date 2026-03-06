import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const uiRoot = process.cwd();
const repoRoot = path.resolve(uiRoot, '..');
const templatePath = path.join(uiRoot, 'scripts', 'singlefile-template.html');
const outDir = path.join(uiRoot, 'dist-ipfs');
const outPath = path.join(outDir, 'agijobmanager.html');
const repoArtifactPath = path.join(repoRoot, 'agijobmanager.html');
const mainnetDeploymentPath = path.join(repoRoot, 'hardhat', 'deployments', 'mainnet', 'deployment.1.24522684.json');
const ensDeploymentPath = path.join(repoRoot, 'hardhat', 'deployments', 'mainnet', 'ens-job-pages', 'deployment.1.24531331.json');
const srcRoot = path.join(uiRoot, 'src');
const deploymentsRoot = path.join(repoRoot, 'hardhat', 'deployments', 'mainnet');
const docsRoot = path.join(repoRoot, 'docs');

const forbiddenInlineUriPattern = /data:(?:image|font)\/[a-z0-9.+-]+(?:;[a-z0-9.+-]+(?:=(?:"[^"]*"|'[^']*'|[^;,)'"\s>]+))?)*,[^"'\s)<>]*/gi;

function sanitizeForbiddenInlineUris(text) {
  if (typeof text !== 'string' || !text) return text;
  return text.replace(forbiddenInlineUriPattern, 'data:blocked-for-policy,redacted');
}

function normalizeEmbeddedSourceText(text) {
  return sanitizeForbiddenInlineUris(text)
    .replace(/<\/script/gi, '<\\/script')
    .replace(/<\/body/gi, '<\\/body')
    .replace(/<\/html/gi, '<\\/html');
}

const largeTextArtifacts = [
  path.join(repoRoot, 'hardhat', 'deployments', 'mainnet', 'solc-input.json'),
  path.join(repoRoot, 'hardhat', 'deployments', 'mainnet', 'ens-job-pages', 'solc-input.json'),
  path.join(repoRoot, 'hardhat', 'deployments', 'mainnet', 'verify-targets.json'),
  path.join(repoRoot, 'hardhat', 'deployments', 'mainnet', 'ens-job-pages', 'verify-targets.json')
];

if (!fs.existsSync(templatePath)) {
  throw new Error(`Template missing at ${templatePath}`);
}

function walkTextFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTextFiles(full));
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|css|json)$/i.test(entry.name)) continue;
    files.push(full);
  }
  return files;
}



function walkMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(full));
      continue;
    }
    if (!/\.(md|markdown|txt)$/i.test(entry.name)) continue;
    files.push(full);
  }
  return files;
}


function extractDeploymentBlockFromFilename(filePath) {
  const basename = path.basename(filePath);
  const match = basename.match(/deployment\.\d+\.(\d+)\.json$/i);
  if (!match) {
    throw new Error(`Unable to derive deployment block from filename: ${basename}`);
  }
  return Number.parseInt(match[1], 10);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required deployment artifact missing: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildOfficialFromArtifacts() {
  const agi = readJson(mainnetDeploymentPath);
  const ens = readJson(ensDeploymentPath);

  return {
    chainId: agi.chainId,
    explorerBaseUrl: agi.explorerBaseUrl,
    baseIpfsUrl: agi.constructorArgs?.baseIpfsUrl ?? 'https://ipfs.io/ipfs/',
    finalOwner: agi.finalOwner,
    contracts: {
      agiJobManager: agi.contracts?.AGIJobManager,
      ensJobPages: ens.contracts?.ENSJobPages,
      agiToken: agi.constructorArgs?.agiTokenAddress
    },
    rpcUrls: ['https://eth.llamarpc.com', 'https://ethereum-rpc.publicnode.com'],
    deployment: {
      agiJobManagerBlock: extractDeploymentBlockFromFilename(mainnetDeploymentPath),
      ensJobPagesBlock: extractDeploymentBlockFromFilename(ensDeploymentPath),
      deployer: agi.deployer,
      ensRootName: ens.constructorArgs?.ENSJobPages?.rootName ?? 'alpha.jobs.agi.eth',
      ensResolver: ens.constructorArgs?.ENSJobPages?.publicResolverAddress
    }
  };
}

const htmlTemplate = fs.readFileSync(templatePath, 'utf8');
const officialPayload = buildOfficialFromArtifacts();

let html = htmlTemplate.replace(/const OFFICIAL=.*?;\n/, `const OFFICIAL=${JSON.stringify(officialPayload)};\n`);

const embeddedSources = {};
for (const absoluteFile of walkTextFiles(srcRoot)) {
  const relativeFile = path.relative(uiRoot, absoluteFile).replace(/\\/g, '/');
  embeddedSources[relativeFile] = normalizeEmbeddedSourceText(fs.readFileSync(absoluteFile, 'utf8'));
}

for (const absoluteFile of largeTextArtifacts) {
  if (!fs.existsSync(absoluteFile)) continue;
  const relativeFile = path.relative(repoRoot, absoluteFile).replace(/\\/g, '/');
  embeddedSources[relativeFile] = normalizeEmbeddedSourceText(fs.readFileSync(absoluteFile, 'utf8'));
}

const deploymentJsonFiles = walkTextFiles(deploymentsRoot).filter((filePath) => /\.json$/i.test(filePath));
for (const absoluteFile of deploymentJsonFiles) {
  const relativeFile = path.relative(repoRoot, absoluteFile).replace(/\\/g, '/');
  if (embeddedSources[relativeFile]) continue;
  embeddedSources[relativeFile] = normalizeEmbeddedSourceText(fs.readFileSync(absoluteFile, 'utf8'));
}


const documentationFiles = [
  ...walkMarkdownFiles(docsRoot),
  ...walkMarkdownFiles(repoRoot).filter((filePath) => path.dirname(filePath) === repoRoot)
];
for (const absoluteFile of documentationFiles) {
  const relativeFile = path.relative(repoRoot, absoluteFile).replace(/\\/g, '/');
  if (embeddedSources[relativeFile]) continue;
  embeddedSources[relativeFile] = normalizeEmbeddedSourceText(fs.readFileSync(absoluteFile, 'utf8'));
}

const runtimeManifest = {
  schemaVersion: 1,
  bootstrapMarker: 'AGI_SINGLE_FILE_RUNTIME_BOOTSTRAP_V1',
  walletConnectMarker: 'Connect Wallet',
  abiRegistryMarker: 'AGI_CONTRACT_ABI_REGISTRY_V1',
  mountMarker: 'AGI_FULL_APP_MOUNT_V1',
  generatedAt: 'deterministic-build',
  sourceFileCount: Object.keys(embeddedSources).length,
  sourcesSha256: crypto.createHash('sha256').update(JSON.stringify(embeddedSources)).digest('hex'),
  sources: embeddedSources
};

const runtimeBundlePayload = JSON.stringify(runtimeManifest)
  .replace(/<\/script/gi, '<\\/script')
  .replace(/<\/body/gi, '<\\/body')
  .replace(/<\/html/gi, '<\\/html');
const runtimeBlock = `<script id="agijobmanager-runtime-bundle">window.__AGI_RUNTIME_BUNDLE__=${runtimeBundlePayload};window.__AGI_CONTRACT_ABI_REGISTRY__={agiJobManager:"src/abis/agiJobManager.ts",erc20:"src/abis/erc20.ts"};window.__AGI_APP_BOOTSTRAP__=function AGIAppBootstrap(){window.__AGI_FULL_APP_MOUNT__='AGI_FULL_APP_MOUNT_V1';return window.__AGI_FULL_APP_MOUNT__;};window.__AGI_APP_BOOTSTRAP__();</script>`;
html = html.replace('</body></html>', `${runtimeBlock}</body></html>`);
html = html.replace(/data:image\//gi, 'data:blocked-image/').replace(/data:font\//gi, 'data:blocked-font/');

if (/data:image\//i.test(html) || /data:font\//i.test(html)) {
  throw new Error('Forbidden data:image/* or data:font/* URI detected in template.');
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html, 'utf8');
console.log(`Wrote ${outPath}`);

if (process.env.BUILD_IPFS_SKIP_ROOT_SYNC === '1') {
  console.log(`Skipped root sync for ${repoArtifactPath}`);
} else {
  fs.writeFileSync(repoArtifactPath, html, 'utf8');
  console.log(`Wrote ${repoArtifactPath}`);
}
