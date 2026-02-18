import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const outRootArg = process.argv.find((arg) => arg.startsWith('--out-dir='));
const outRoot = outRootArg ? path.resolve(repoRoot, outRootArg.split('=')[1]) : repoRoot;
const outFile = path.join(outRoot, 'docs/REPO_MAP.md');

const curated = [
  ['contracts/AGIJobManager.sol', 'Primary escrow/settlement contract with role gating and disputes', 'On-chain source of truth'],
  ['contracts/ens/', 'ENS and NameWrapper integration interfaces/helpers', 'Best-effort identity checks'],
  ['contracts/utils/', 'Math, transfer, URI, and ENS ownership helpers', 'Used by core contract'],
  ['migrations/1_deploy_contracts.js', 'Truffle deployment entrypoint', 'Reads deployment config'],
  ['migrations/deploy-config.js', 'Network-dependent deployment parameters', 'Operator-reviewed before deploy'],
  ['test/', 'Truffle and node-based security/regression suites', 'Primary CI safety net'],
  ['forge-test/', 'Foundry fuzz/invariant suites', 'Optional hardening lane'],
  ['scripts/ops/validate-params.js', 'Parameter sanity checker for operations', 'Run before live changes'],
  ['scripts/postdeploy-config.js', 'Post-deploy owner configuration routine', 'Operational setup automation'],
  ['scripts/docs/', 'Deterministic documentation generators and integrity gates', 'Maintains docs freshness in CI'],
  ['scripts/check-no-binaries.mjs', 'PR-time binary policy enforcement', 'Blocks forbidden binary additions'],
  ['ui/', 'Next.js operator/demo frontend', 'Contains own docs and checks'],
  ['.github/workflows/ci.yml', 'Main build/lint/test workflow', 'PR and main branch gate'],
  ['.github/workflows/docs.yml', 'Docs and no-binaries policy workflow', 'Documentation freshness gate'],
  ['docs/', 'Institutional documentation and generated references', 'Read docs/README.md first'],
  ['docs/DEPLOYMENT.md', 'Deployment/configuration and operator acceptance checks', 'Use before testnet/mainnet rollout']
];

const topLevel = fs.readdirSync(repoRoot, { withFileTypes: true })
  .filter((d) => !d.name.startsWith('.git') && d.name !== 'node_modules' && d.name !== 'build')
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
  'docs/DEPLOYMENT.md',
  'contracts/AGIJobManager.sol',
  'test/AGIJobManager.test.js',
  'migrations/1_deploy_contracts.js',
  'scripts/postdeploy-config.js',
  '.github/workflows/ci.yml',
  '.github/workflows/docs.yml'
];

const content = `# Repository Map (Generated)\n\n- Generated at (deterministic source fingerprint): \`${generatedAt}\`.\n- Source snapshot fingerprint: \`${sourceFingerprint}\`.\n\n## Curated high-signal map\n\n| Path | Purpose | Notes |\n| --- | --- | --- |\n${curated.map((r) => `| \`${r[0]}\` | ${r[1]} | ${r[2]} |`).join('\n')}\n\n## Top-level directories\n\n| Directory | Purpose signal |\n| --- | --- |\n${topLevelDirs.map((e) => `| \`${e.name}/\` | Project-scoped directory discovered at repository root |`).join('\n')}\n\n## Key entrypoints\n\n${keyEntrypoints.map((entry) => `- [\`${entry}\`](../${entry})`).join('\n')}\n\n## Source files used\n\n- repository root directory listing\n- curated mapping declared in \`scripts/docs/generate-repo-map.mjs\`\n`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, content);
console.log(`Generated ${path.relative(repoRoot, outFile)}`);
