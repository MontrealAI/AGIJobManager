import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = process.cwd();
const outFile = path.join(root, 'docs/REFERENCE/VERSIONS.md');
const pkgPath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');
const trufflePath = path.join(root, 'truffle-config.js');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const shortSha = execSync('git rev-parse --short HEAD').toString().trim();
const generatedAt = execSync('git show -s --format=%cI HEAD').toString().trim();
const nodeVersion = process.version.replace(/^v/, '');
const npmVersion = execSync('npm --version').toString().trim();
const truffleVersion = (pkg.devDependencies?.truffle || pkg.dependencies?.truffle || 'n/a');
const ozVersion = (pkg.dependencies?.['@openzeppelin/contracts'] || pkg.devDependencies?.['@openzeppelin/contracts'] || 'n/a');
const lockVersion = lock.lockfileVersion ?? 'n/a';

const truffleConfig = fs.readFileSync(trufflePath, 'utf8');
const solcVersionMatch = truffleConfig.match(/const\s+solcVersion\s*=\s*'([^']+)'/);
const solcRunsMatch = truffleConfig.match(/const\s+solcRuns\s*=\s*(\d+)/);
const solcViaIRMatch = truffleConfig.match(/const\s+solcViaIR\s*=\s*(true|false)/);

const depRows = [
  ['node', nodeVersion, 'runtime'],
  ['npm', npmVersion, 'package manager'],
  ['truffle', truffleVersion, 'framework'],
  ['solc', solcVersionMatch?.[1] || 'n/a', 'compiler'],
  ['solc optimizer runs', solcRunsMatch?.[1] || 'n/a', 'compiler setting'],
  ['solc viaIR', solcViaIRMatch?.[1] || 'n/a', 'compiler setting'],
  ['@openzeppelin/contracts', ozVersion, 'contracts library'],
  ['package-lock lockfileVersion', String(lockVersion), 'dependency determinism'],
];

const additionalDeps = ['ganache', '@truffle/hdwallet-provider', 'solhint', '@playwright/test'];
const depTable = additionalDeps
  .map((name) => {
    const v = pkg.dependencies?.[name] || pkg.devDependencies?.[name] || 'n/a';
    return `| ${name} | ${v} |`;
  })
  .join('\n');

const content = `# Versions & Toolchain Snapshot

Verified against repository state: \`${shortSha}\`.

Generated at: \`${generatedAt}\`.

## Toolchain snapshot

| Component | Version | Source |
| --- | --- | --- |
${depRows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`).join('\n')}

## Key dependencies

| Package | Version |
| --- | --- |
${depTable}

## Source files used

- \`package.json\`
- \`package-lock.json\`
- \`truffle-config.js\`
`;

fs.writeFileSync(outFile, content);
console.log(`Wrote ${path.relative(root, outFile)}`);
