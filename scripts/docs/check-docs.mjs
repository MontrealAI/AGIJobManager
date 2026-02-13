import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

const root = process.cwd();
const requiredFiles = [
  'docs/README.md','docs/OVERVIEW.md','docs/REPO_MAP.md','docs/QUICKSTART.md','docs/QUINTESSENTIAL_USE_CASE.md','docs/ARCHITECTURE.md',
  'docs/CONTRACTS/AGIJobManager.md','docs/CONTRACTS/INTEGRATIONS.md',
  'docs/OPERATIONS/RUNBOOK.md','docs/OPERATIONS/INCIDENT_RESPONSE.md','docs/OPERATIONS/MONITORING.md',
  'docs/SECURITY_MODEL.md','docs/TESTING.md','docs/TROUBLESHOOTING.md','docs/GLOSSARY.md',
  'docs/REFERENCE/VERSIONS.md','docs/REFERENCE/CONTRACT_INTERFACE.md','docs/assets/palette.svg','docs/assets/architecture-wireframe.svg'
];

for (const f of requiredFiles) {
  if (!fs.existsSync(path.join(root, f))) throw new Error(`Missing required doc file: ${f}`);
}

const mermaidChecks = [
  ['docs/ARCHITECTURE.md', /```mermaid[\s\S]*flowchart/i],
  ['docs/CONTRACTS/AGIJobManager.md', /```mermaid[\s\S]*stateDiagram-v2/i],
  ['docs/CONTRACTS/AGIJobManager.md', /```mermaid[\s\S]*sequenceDiagram/i],
  ['docs/OPERATIONS/INCIDENT_RESPONSE.md', /```mermaid[\s\S]*flowchart/i],
  ['docs/QUINTESSENTIAL_USE_CASE.md', /```mermaid[\s\S]*sequenceDiagram/i],
  ['docs/QUINTESSENTIAL_USE_CASE.md', /```mermaid[\s\S]*stateDiagram-v2/i],
];
for (const [file, regex] of mermaidChecks) {
  const c = fs.readFileSync(path.join(root, file), 'utf8');
  if (!regex.test(c)) throw new Error(`Missing required Mermaid block in ${file}`);
}

for (const svg of ['docs/assets/palette.svg', 'docs/assets/architecture-wireframe.svg']) {
  const c = fs.readFileSync(path.join(root, svg), 'utf8');
  if (!c.trim().startsWith('<svg') && !c.includes('<svg')) throw new Error(`${svg} is not valid SVG/XML`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-check-'));
const generated = ['docs/REFERENCE/VERSIONS.md','docs/REFERENCE/CONTRACT_INTERFACE.md','docs/REPO_MAP.md'];
const backups = new Map();
for (const f of generated) {
  const abs = path.join(root, f);
  const bak = path.join(tmp, path.basename(f));
  backups.set(f, bak);
  fs.copyFileSync(abs, bak);
}
execSync('node scripts/docs/gen-docs.mjs', { stdio: 'inherit' });
for (const f of generated) {
  const abs = path.join(root, f);
  const old = fs.readFileSync(backups.get(f), 'utf8');
  const now = fs.readFileSync(abs, 'utf8');
  if (old !== now) throw new Error(`Generated docs stale: ${f}. Run npm run docs:gen and commit changes.`);
}

const mdFiles = execSync("rg --files docs -g '*.md'").toString().trim().split('\n').filter(Boolean);
for (const file of mdFiles) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const links = Array.from(text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)).map((m) => m[1]);
  for (const link of links) {
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    const normalized = link.split('#')[0];
    if (!normalized) continue;
    const target = path.resolve(path.dirname(path.join(root, file)), normalized);
    if (!fs.existsSync(target)) throw new Error(`Broken relative link in ${file}: ${link}`);
  }
}

console.log('docs:check passed');
