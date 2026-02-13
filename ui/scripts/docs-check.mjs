import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = path.resolve(process.cwd(), '..');
const docsRoot = path.join(repoRoot, 'docs', 'ui');

const requiredDocs = ['README.md', 'OVERVIEW.md', 'ARCHITECTURE.md', 'JOB_LIFECYCLE.md', 'OPS_RUNBOOK.md', 'SECURITY_MODEL.md', 'DESIGN_SYSTEM.md', 'DEMO.md', 'TESTING.md', 'VERSIONS.md'];
for (const file of requiredDocs) {
  if (!fs.existsSync(path.join(docsRoot, file))) {
    throw new Error(`Missing docs/ui/${file}`);
  }
}

const mustContain = [
  ['ARCHITECTURE.md', '```mermaid'],
  ['ARCHITECTURE.md', 'sequenceDiagram'],
  ['JOB_LIFECYCLE.md', 'stateDiagram-v2'],
  ['OPS_RUNBOOK.md', 'flowchart'],
  ['SECURITY_MODEL.md', 'simulation-first'],
  ['DESIGN_SYSTEM.md', '| Token |'],
  ['TESTING.md', '| Layer |'],
  ['DEMO.md', 'fixture']
];
for (const [file, needle] of mustContain) {
  const content = fs.readFileSync(path.join(docsRoot, file), 'utf8');
  if (!content.toLowerCase().includes(needle.toLowerCase())) {
    throw new Error(`${file} missing required section: ${needle}`);
  }
}

for (const asset of ['palette.svg', 'ui-wireframe.svg']) {
  const content = fs.readFileSync(path.join(docsRoot, 'assets', asset), 'utf8');
  if (!content.includes('<svg')) {
    throw new Error(`${asset} invalid SVG`);
  }
}

const versionsPath = path.join(docsRoot, 'VERSIONS.md');
const before = fs.readFileSync(versionsPath, 'utf8');
execSync('node scripts/generate-versions.mjs', { cwd: process.cwd(), stdio: 'pipe' });
const after = fs.readFileSync(versionsPath, 'utf8');

const normalize = (text) => text.replace(/^\- Generated at: .*$/m, '- Generated at: <normalized>');
if (normalize(before) !== normalize(after)) {
  throw new Error('docs/ui/VERSIONS.md is stale compared with ui/package.json. Run npm run docs:versions and commit the result.');
}

for (const pkg of ['next', 'wagmi', 'viem', 'vitest', '@playwright/test']) {
  if (!after.includes(`| ${pkg} |`)) {
    throw new Error(`VERSIONS.md missing ${pkg}`);
  }
}

console.log('docs-check passed');
