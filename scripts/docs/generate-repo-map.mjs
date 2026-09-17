import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const outRootArg = process.argv.find((arg) => arg.startsWith('--out-dir='));
const outRoot = outRootArg ? path.resolve(repoRoot, outRootArg.split('=')[1]) : repoRoot;
const outFile = path.join(outRoot, 'docs/REPO_MAP.md');

const curated = [
  ['contracts/AGIJobManager.sol', 'Primary escrow/settlement contract with role gating and disputes', 'On-chain source of truth'],
  ['contracts/ens/', 'ENS and NameWrapper integration interfaces/helpers', 'Best-effort identity checks'],
  ['contracts/utils/', 'Math, transfer, URI, and ENS ownership helpers', 'Used by core contract'],
  ['hardhat/scripts/deploy.js', 'Official public-network deployment and verification', 'Starts with intake paused; preserves transaction journals'],
  ['hardhat/scripts/check-readiness.js', 'Read-only instance qualification before activation', 'No transactions; inspect report and owner acceptance'],
  ['migrations/1_deploy_contracts.js', 'Disposable local Truffle fixture', 'Never use for public-network signing'],
  ['migrations/deploy-config.js', 'Legacy local fixture configuration', 'Use hardhat/deploy.config.example.js for public networks'],
  ['test/', 'Truffle and node-based security/regression suites', 'Primary CI safety net'],
  ['forge-test/', 'Foundry fuzz/invariant suites', 'Mandatory security qualification gate'],
  ['scripts/ops/validate-params.js', 'Legacy local parameter sanity checker', 'Not a production readiness check'],
  ['scripts/postdeploy-config.js', 'Legacy local owner configuration routine', 'Use verified owner controls for live instances'],
  ['scripts/check-no-binaries.mjs', 'Repository policy guard against binary additions', 'Docs governance + supply chain hygiene'],
  ['ui/', 'Next.js operator/demo frontend', 'Contains own docs and checks'],
  ['.github/workflows/ci.yml', 'Main build/lint/test workflow', 'PR and main branch gate'],
  ['.github/workflows/docs.yml', 'Docs and no-binaries policy workflow', 'Documentation freshness gate'],
  ['docs/', 'Institutional documentation and generated references', 'Read docs/README.md first']
];

const trackedRoots = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' })
  .split('\0').filter(Boolean).map((name) => name.split('/')[0]));
const topLevel = fs.readdirSync(repoRoot, { withFileTypes: true })
  .filter((d) => trackedRoots.has(d.name) && !d.name.startsWith('.git'))
  .map((d) => ({ name: d.name, type: d.isDirectory() ? 'dir' : 'file' }))
  .sort((a, b) => a.name.localeCompare(b.name));

const sourceFingerprint = crypto
  .createHash('sha256')
  .update(JSON.stringify(topLevel) + JSON.stringify(curated))
  .digest('hex')
  .slice(0, 12);
const generatedAt = sourceFingerprint;

const topLevelDirs = topLevel.filter((e) => e.type === 'dir');

const keyEntrypoints = [
  'README.md',
  'docs/README.md',
  'contracts/AGIJobManager.sol',
  'test/AGIJobManager.test.js',
  'hardhat/README.md',
  'hardhat/scripts/deploy.js',
  'hardhat/scripts/check-readiness.js',
  'docs/START_HERE.md',
  'docs/DEPLOYMENT_OPERATIONS.md',
  'docs/SCRIPTS_REFERENCE.md',
  '.github/workflows/ci.yml',
  '.github/workflows/docs.yml'
];

const content = `# Repository Map (Generated)\n\n- Generated at (deterministic source fingerprint): \`${generatedAt}\`.\n- Source snapshot fingerprint: \`${sourceFingerprint}\`.\n\n## Curated high-signal map\n\n| Path | Purpose | Notes |\n| --- | --- | --- |\n${curated.map((r) => `| \`${r[0]}\` | ${r[1]} | ${r[2]} |`).join('\n')}\n\n## Top-level directories\n\n| Directory | Purpose signal |\n| --- | --- |\n${topLevelDirs.map((e) => `| \`${e.name}/\` | Project-scoped directory discovered at repository root |`).join('\n')}\n\n## Key entrypoints\n\n${keyEntrypoints.map((entry) => `- [\`${entry}\`](../${entry})`).join('\n')}\n\n## Source files used\n\n- repository root directory listing\n- curated mapping declared in \`scripts/docs/generate-repo-map.mjs\`\n`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, content);
console.log(`Generated ${path.relative(repoRoot, outFile)}`);
