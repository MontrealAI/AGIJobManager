import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = process.cwd();
const outPath = path.join(root, 'docs/REPO_MAP.md');
const shortSha = execSync('git rev-parse --short HEAD').toString().trim();
const generatedAt = execSync('git show -s --format=%cI HEAD').toString().trim();

const curated = [
  ['contracts/', 'Solidity contracts and interfaces', 'contracts/AGIJobManager.sol', 'Primary escrow and settlement contract'],
  ['contracts/ens/', 'ENS and NameWrapper interfaces + ENSJobPages helper', 'contracts/ens/ENSJobPages.sol', 'Best-effort metadata/hook integration'],
  ['contracts/test/', 'Mock contracts for adversarial and integration tests', 'contracts/test/MockENSJobPages.sol', 'Test-only fixtures'],
  ['test/', 'Truffle/JS test suites', 'test/jobLifecycle.core.test.js', 'Lifecycle, invariants, and hardening coverage'],
  ['migrations/', 'Truffle deployment scripts', 'migrations/2_deploy_contracts.js', 'Network-aware deploy entrypoint'],
  ['scripts/ops/', 'Operational parameter validation scripts', 'scripts/ops/validate-params.js', 'Safety checks for deploy-time config'],
  ['scripts/merkle/', 'Merkle tree proof generation and smoke tests', 'scripts/merkle/generate_merkle_proof.js', 'Allowlist operations'],
  ['scripts/ui/', 'UI smoke and ABI sync tooling', 'scripts/ui/run_ui_smoke_test.js', 'Frontend contract compatibility'],
  ['scripts/docs/', 'Deterministic docs generators and checks', 'scripts/docs/check-docs.mjs', 'Freshness and structural enforcement'],
  ['docs/', 'Repository documentation source', 'docs/README.md', 'Institutional docs and references'],
  ['.github/workflows/', 'CI workflows', '.github/workflows/ci.yml', 'Build, tests, docs, and policy checks'],
  ['ui/', 'Web user interface project', 'ui/package.json', 'Separate build and tests'],
  ['truffle-config.js', 'Compiler and network configuration', 'truffle-config.js', 'Pinned solc + network wiring'],
  ['package.json', 'Node scripts and dependencies', 'package.json', 'Canonical script entrypoints'],
];

const top = fs.readdirSync(root, { withFileTypes: true })
  .filter((d) => !d.name.startsWith('.') || d.name === '.github')
  .map((d) => d.name)
  .sort();

const content = `# Repository Map (Generated)

Verified against repository state: \`${shortSha}\`.

Generated at: \`${generatedAt}\`.

## Curated map

| Folder/File | Purpose | Key entrypoint | Notes |
| --- | --- | --- | --- |
${curated.map((r) => `| \`${r[0]}\` | ${r[1]} | \`${r[2]}\` | ${r[3]} |`).join('\n')}

## Top-level entries

${top.map((name) => `- \`${name}\``).join('\n')}
`;

fs.writeFileSync(outPath, content);
console.log(`Wrote ${path.relative(root, outPath)}`);
