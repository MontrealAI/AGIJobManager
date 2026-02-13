import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(process.cwd(), '..');
const docsRoot = path.join(root, 'docs/ui');
const required = [
  'README.md',
  'OVERVIEW.md',
  'ARCHITECTURE.md',
  'JOB_LIFECYCLE.md',
  'OPS_RUNBOOK.md',
  'SECURITY_MODEL.md',
  'DESIGN_SYSTEM.md',
  'DEMO.md',
  'TESTING.md',
  'VERSIONS.md'
];

for (const file of required) {
  if (!fs.existsSync(path.join(docsRoot, file))) {
    throw new Error(`Missing docs/ui/${file}`);
  }
}

const mustContainMermaid = ['ARCHITECTURE.md', 'JOB_LIFECYCLE.md', 'OPS_RUNBOOK.md'];
for (const file of mustContainMermaid) {
  const content = fs.readFileSync(path.join(docsRoot, file), 'utf8');
  if (!content.includes('```mermaid')) throw new Error(`${file} missing Mermaid diagram`);
}

const assets = ['palette.svg', 'ui-wireframe.svg'];
for (const file of assets) {
  const content = fs.readFileSync(path.join(docsRoot, 'assets', file), 'utf8');
  if (!content.trimStart().startsWith('<svg')) throw new Error(`docs/ui/assets/${file} is not SVG`);
}

execSync('node scripts/generate-versions.mjs', { cwd: process.cwd(), stdio: 'ignore' });
const versions = fs.readFileSync(path.join(docsRoot, 'VERSIONS.md'), 'utf8');
if (!versions.includes('| next |') || !versions.includes('| wagmi |')) {
  throw new Error('VERSIONS.md missing key dependency rows');
}

console.log('docs-check passed');
