import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const outRootArg = process.argv.find((arg) => arg.startsWith('--out-dir='));
const outRoot = outRootArg ? path.resolve(repoRoot, outRootArg.split('=')[1]) : repoRoot;
const outFile = path.join(outRoot, 'docs/REPO_MAP.md');
const shortSha = execSync('git rev-parse --short HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();

const curated = [
  ['contracts/AGIJobManager.sol', 'Primary escrow/settlement contract with role gating and disputes', 'On-chain source of truth'],
  ['contracts/ens/', 'ENS and NameWrapper integration interfaces/helpers', 'Best-effort identity checks'],
  ['contracts/utils/', 'Math, transfer, URI, and ENS ownership helpers', 'Used by core contract'],
  ['migrations/2_deploy_contracts.js', 'Truffle deployment entrypoint', 'Reads deployment config'],
  ['migrations/deploy-config.js', 'Network-dependent deployment parameters', 'Operator-reviewed before deploy'],
  ['test/', 'Truffle and node-based security/regression suites', 'Primary CI safety net'],
  ['forge-test/', 'Foundry fuzz/invariant suites', 'Optional hardening lane'],
  ['scripts/ops/validate-params.js', 'Parameter sanity checker for operations', 'Run before live changes'],
  ['scripts/postdeploy-config.js', 'Post-deploy owner configuration routine', 'Operational setup automation'],
  ['ui/', 'Next.js operator/demo frontend', 'Contains own docs and checks'],
  ['.github/workflows/ci.yml', 'Main build/lint/test workflow', 'PR and main branch gate'],
  ['.github/workflows/docs.yml', 'Docs and no-binaries policy workflow', 'Documentation freshness gate'],
  ['docs/', 'Institutional documentation and generated references', 'Read docs/README.md first']
];

const topLevel = fs.readdirSync(repoRoot, { withFileTypes: true })
  .filter((d) => !d.name.startsWith('.git'))
  .map((d) => ({ name: d.name, type: d.isDirectory() ? 'dir' : 'file' }))
  .sort((a, b) => a.name.localeCompare(b.name));

const content = `# Repository Map (Generated)\n\n- Verified against repository state: \`${shortSha}\`.\n\n## Curated high-signal map\n\n| Path | Purpose | Notes |\n| --- | --- | --- |\n${curated.map((r) => `| \`${r[0]}\` | ${r[1]} | ${r[2]} |`).join('\n')}\n\n## Top-level inventory\n\n| Entry | Kind |\n| --- | --- |\n${topLevel.map((e) => `| \`${e.name}\` | ${e.type} |`).join('\n')}\n`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, content);
console.log(`Generated ${path.relative(repoRoot, outFile)}`);
