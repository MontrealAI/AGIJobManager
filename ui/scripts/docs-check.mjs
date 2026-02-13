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
  if (!content.toLowerCase().includes(needle.toLowerCase())) {
    throw new Error(`${file} missing required section: ${needle}`);
  }
}

for (const asset of ['palette.svg', 'ui-wireframe.svg']) {
  const content = fs.readFileSync(path.join(docsRoot, 'assets', asset), 'utf8').trim();
  if (!content.startsWith('<svg') && !content.startsWith('<?xml')) throw new Error(`${asset} is not valid XML/SVG`);
  if (!content.includes('<svg')) throw new Error(`${asset} missing <svg element>`);
}

const normalize = (text) => text.replace(/^- Generated at: .*$/m, '- Generated at: <normalized>');

const versionsPath = path.join(docsRoot, 'VERSIONS.md');
const beforeVersions = fs.readFileSync(versionsPath, 'utf8');
execSync('node scripts/generate-versions.mjs', { cwd: process.cwd(), stdio: 'pipe' });
const afterVersions = fs.readFileSync(versionsPath, 'utf8');
if (normalize(beforeVersions) !== normalize(afterVersions)) {
  throw new Error('docs/ui/VERSIONS.md is stale compared with ui/package.json. Run npm run docs:versions and commit the result.');
}

const contractPath = path.join(docsRoot, 'CONTRACT_INTERFACE.md');
const beforeContract = fs.readFileSync(contractPath, 'utf8');
execSync('node scripts/generate-contract-interface.mjs', { cwd: process.cwd(), stdio: 'pipe' });
const afterContract = fs.readFileSync(contractPath, 'utf8');
if (normalize(beforeContract) !== normalize(afterContract)) {
  throw new Error('docs/ui/CONTRACT_INTERFACE.md is stale compared with ui/src/abis/agiJobManager.ts. Run npm run docs:contract and commit the result.');
}

console.log('docs-check passed');
