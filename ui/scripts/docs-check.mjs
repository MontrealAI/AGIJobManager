import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(process.cwd(), '..');
const docsRoot = path.join(root, 'docs/ui');
const requiredDocs = [
  'README.md','OVERVIEW.md','ARCHITECTURE.md','JOB_LIFECYCLE.md','OPS_RUNBOOK.md',
  'SECURITY_MODEL.md','DESIGN_SYSTEM.md','DEMO.md','TESTING.md','VERSIONS.md'
];
for (const file of requiredDocs) {
  if (!fs.existsSync(path.join(docsRoot, file))) throw new Error(`Missing docs/ui/${file}`);
}

const arch = fs.readFileSync(path.join(docsRoot, 'ARCHITECTURE.md'), 'utf8');
if (!/```mermaid[\s\S]*flowchart/.test(arch) || !/sequenceDiagram/.test(arch)) throw new Error('ARCHITECTURE.md must include flowchart + sequenceDiagram mermaid blocks');

const lifecycle = fs.readFileSync(path.join(docsRoot, 'JOB_LIFECYCLE.md'), 'utf8');
if (!/stateDiagram-v2/.test(lifecycle)) throw new Error('JOB_LIFECYCLE.md must include stateDiagram-v2');

const runbook = fs.readFileSync(path.join(docsRoot, 'OPS_RUNBOOK.md'), 'utf8');
if ((runbook.match(/```mermaid/g) || []).length < 2) throw new Error('OPS_RUNBOOK.md must include at least two Mermaid diagrams');

const assets = ['palette.svg', 'ui-wireframe.svg'];
for (const asset of assets) {
  const p = path.join(docsRoot, 'assets', asset);
  if (!fs.existsSync(p)) throw new Error(`Missing docs/ui/assets/${asset}`);
  const xml = fs.readFileSync(p, 'utf8').trim();
  if (!xml.startsWith('<svg')) throw new Error(`Invalid SVG XML in ${asset}`);
}

const current = fs.readFileSync(path.join(docsRoot, 'VERSIONS.md'), 'utf8');
const regenerated = execSync('node scripts/generate-versions.mjs --stdout', { cwd: process.cwd(), encoding: 'utf8' });
if (current !== regenerated) throw new Error('docs/ui/VERSIONS.md is stale. Run npm run docs:versions.');

console.log('docs-check passed');
