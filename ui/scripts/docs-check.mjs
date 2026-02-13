import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = path.resolve(process.cwd(), '..');
const docsRoot = path.join(repoRoot, 'docs', 'ui');

const requiredDocs = [
  'README.md',
  'OVERVIEW.md',
  'ARCHITECTURE.md',
  'JOB_LIFECYCLE.md',
  'OPS_RUNBOOK.md',
  'SECURITY_MODEL.md',
  'DESIGN_SYSTEM.md',
  'DEMO.md',
  'TESTING.md',
  'VERSIONS.md',
  'CONTRACT_INTERFACE.md'
];
for (const file of requiredDocs) {
  if (!fs.existsSync(path.join(docsRoot, file))) throw new Error(`Missing docs/ui/${file}`);
}

const mustContain = [
  ['ARCHITECTURE.md', '```mermaid'],
  ['ARCHITECTURE.md', 'sequenceDiagram'],
  ['JOB_LIFECYCLE.md', 'stateDiagram-v2'],
  ['OPS_RUNBOOK.md', 'flowchart'],
  ['SECURITY_MODEL.md', 'simulation-first'],
  ['DESIGN_SYSTEM.md', '| Token |'],
  ['TESTING.md', '| Layer |'],
  ['DEMO.md', 'fixture'],
  ['CONTRACT_INTERFACE.md', 'UI compatibility contract']
];
for (const [file, needle] of mustContain) {
  const content = fs.readFileSync(path.join(docsRoot, file), 'utf8');
  if (!content.toLowerCase().includes(needle.toLowerCase())) throw new Error(`${file} missing required section: ${needle}`);
}

for (const asset of ['palette.svg', 'ui-wireframe.svg']) {
  const content = fs.readFileSync(path.join(docsRoot, 'assets', asset), 'utf8');
  if (!content.includes('<svg')) throw new Error(`${asset} invalid SVG`);
}

const normalize = (text) => text.replace(/^- Generated at: .*$/m, '- Generated at: <normalized>');

function assertGenerated(file, cmd) {
  const filePath = path.join(docsRoot, file);
  const before = fs.readFileSync(filePath, 'utf8');
  execSync(cmd, { cwd: process.cwd(), stdio: 'pipe' });
  const after = fs.readFileSync(filePath, 'utf8');
  if (normalize(before) !== normalize(after)) {
    throw new Error(`docs/ui/${file} is stale. Run ${cmd.replace('node ', 'npm run ').replace('scripts/generate-', 'docs:').replace('.mjs', '')} and commit.`);
  }
  return after;
}

const versionsDoc = assertGenerated('VERSIONS.md', 'node scripts/generate-versions.mjs');
assertGenerated('CONTRACT_INTERFACE.md', 'node scripts/generate-contract-interface.mjs');

for (const pkg of ['next', 'wagmi', 'viem', 'vitest', '@playwright/test']) {
  if (!versionsDoc.includes(`| ${pkg} |`)) throw new Error(`VERSIONS.md missing ${pkg}`);
}

console.log('docs-check passed');
