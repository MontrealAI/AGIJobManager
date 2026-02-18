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

  const tags = [...content.matchAll(/<\/?([a-zA-Z][\w:-]*)(\s[^>]*)?>/g)].map((m) => m[0]);
  const stack = [];
  for (const tag of tags) {
    if (tag.startsWith('<?') || tag.startsWith('<!')) continue;
    if (tag.endsWith('/>')) continue;
    if (tag.startsWith('</')) {
      const name = tag.slice(2, -1).trim();
      const last = stack.pop();
      if (last !== name) {
        throw new Error(`${asset} has malformed XML structure around </${name}>`);
      }
      continue;
    }
    const openName = tag.slice(1, tag.indexOf(' ') > -1 ? tag.indexOf(' ') : -1).replace('>', '');
    stack.push(openName);
  }
  if (stack.length) {
    throw new Error(`${asset} has unclosed XML tags: ${stack.join(', ')}`);
  }
}

const normalize = (text) => text.replace(/^\- Generated at: .*$/m, '- Generated at: <normalized>');

const versionsPath = path.join(docsRoot, 'VERSIONS.md');
const versionsBefore = fs.readFileSync(versionsPath, 'utf8');
execSync('node scripts/generate-versions.mjs', { cwd: process.cwd(), stdio: 'pipe' });
const versionsAfter = fs.readFileSync(versionsPath, 'utf8');
if (normalize(versionsBefore) !== normalize(versionsAfter)) {
  throw new Error('docs/ui/VERSIONS.md is stale compared with ui/package.json. Run npm run docs:versions and commit the result.');
}

for (const pkg of ['next', 'wagmi', 'viem', 'vitest', '@playwright/test']) {
  if (!versionsAfter.includes(`| ${pkg} |`)) {
    throw new Error(`VERSIONS.md missing ${pkg}`);
  }
}

const contractPath = path.join(docsRoot, 'CONTRACT_INTERFACE.md');
const contractBefore = fs.readFileSync(contractPath, 'utf8');
execSync('node scripts/generate-contract-interface.mjs', { cwd: process.cwd(), stdio: 'pipe' });
const contractAfter = fs.readFileSync(contractPath, 'utf8');
if (normalize(contractBefore) !== normalize(contractAfter)) {
  throw new Error('docs/ui/CONTRACT_INTERFACE.md is stale compared with ui/src/abis/agiJobManager.ts. Run npm run docs:contract and commit the result.');
}

for (const section of ['## Functions used by UI', '## Events used by UI', '## Custom errors decoded by UI']) {
  if (!contractAfter.includes(section)) {
    throw new Error(`CONTRACT_INTERFACE.md missing section: ${section}`);
  }
}

console.log('docs-check passed');
