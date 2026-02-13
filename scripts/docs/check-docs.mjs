import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const requiredFiles = [
  'docs/README.md','docs/OVERVIEW.md','docs/REPO_MAP.md','docs/QUICKSTART.md','docs/QUINTESSENTIAL_USE_CASE.md','docs/ARCHITECTURE.md',
  'docs/CONTRACTS/AGIJobManager.md','docs/CONTRACTS/INTEGRATIONS.md','docs/OPERATIONS/RUNBOOK.md','docs/OPERATIONS/INCIDENT_RESPONSE.md',
  'docs/OPERATIONS/MONITORING.md','docs/SECURITY_MODEL.md','docs/TESTING.md','docs/TROUBLESHOOTING.md','docs/GLOSSARY.md',
  'docs/REFERENCE/VERSIONS.md','docs/REFERENCE/CONTRACT_INTERFACE.md','docs/REFERENCE/EVENTS_AND_ERRORS.md',
  'docs/assets/palette.svg','docs/assets/architecture-wireframe.svg'
];

const fail = (msg) => { console.error(`❌ ${msg}`); process.exitCode = 1; };
const ok = (msg) => console.log(`✅ ${msg}`);

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(`Missing required file: ${file}`);
}

const mermaidChecks = [
  ['docs/ARCHITECTURE.md', ['flowchart', 'Repo architecture']],
  ['docs/CONTRACTS/AGIJobManager.md', ['stateDiagram-v2', 'sequenceDiagram']],
  ['docs/OPERATIONS/INCIDENT_RESPONSE.md', ['flowchart', 'settlementPaused']]
];
for (const [file, snippets] of mermaidChecks) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (!/```mermaid[\s\S]*?```/m.test(text)) fail(`No Mermaid block found in ${file}`);
  for (const snippet of snippets) {
    if (!text.includes(snippet)) fail(`Missing Mermaid/content snippet "${snippet}" in ${file}`);
  }
}

for (const svgFile of ['docs/assets/palette.svg', 'docs/assets/architecture-wireframe.svg']) {
  const text = fs.readFileSync(path.join(root, svgFile), 'utf8');
  if (text.includes('\u0000')) fail(`NUL byte found in ${svgFile}`);
  const trimmed = text.trim();
  if (!trimmed.startsWith('<svg') || !trimmed.includes('</svg>')) fail(`Invalid SVG XML envelope: ${svgFile}`);
}

const generators = [
  'scripts/docs/generate-versions.mjs',
  'scripts/docs/generate-contract-interface.mjs',
  'scripts/docs/generate-repo-map.mjs',
  'scripts/docs/generate-events-errors.mjs'
];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agijob-docs-'));
try {
  for (const g of generators) execFileSync('node', [g, `--out-dir=${tmp}`], { cwd: root, stdio: 'ignore' });
  for (const genFile of ['docs/REFERENCE/VERSIONS.md','docs/REFERENCE/CONTRACT_INTERFACE.md','docs/REPO_MAP.md','docs/REFERENCE/EVENTS_AND_ERRORS.md']) {
    const current = fs.readFileSync(path.join(root, genFile), 'utf8');
    const expected = fs.readFileSync(path.join(tmp, genFile), 'utf8');
    if (current !== expected) fail(`Generated doc is stale: ${genFile}. Run npm run docs:gen`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const mdFiles = [];
const collect = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(p);
    else if (entry.isFile() && entry.name.endsWith('.md')) mdFiles.push(p);
  }
};
collect(path.join(root, 'docs'));

const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
for (const md of mdFiles) {
  const text = fs.readFileSync(md, 'utf8');
  for (const match of text.matchAll(linkRegex)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('http') || raw.startsWith('mailto:') || raw.startsWith('#')) continue;
    const clean = raw.split('#')[0].split('?')[0];
    const target = path.resolve(path.dirname(md), clean);
    if (!fs.existsSync(target)) fail(`Broken relative link in ${path.relative(root, md)} -> ${raw}`);
  }

  // Enforce explicit code-fence language labels for clarity in core docs.
  if (requiredFiles.includes(path.relative(root, md))) {
    let inFence = false;
    for (const line of text.split('\n')) {
      if (!line.startsWith('```')) continue;
      if (!inFence) {
        const label = line.slice(3).trim();
        if (!label) fail(`Unlabeled code fence in ${path.relative(root, md)}. Add a language label (e.g., bash, json, solidity, mermaid).`);
      }
      inFence = !inFence;
    }
  }
}

const quintessential = fs.readFileSync(path.join(root, 'docs/QUINTESSENTIAL_USE_CASE.md'), 'utf8');
const requiredHeadings = [
  '## A) Local dev chain walkthrough',
  '## B) Testnet/mainnet operator checklist',
  '### Step table',
  '### Happy path sequence diagram',
  '### Lifecycle state diagram',
  '### Expected state checkpoints'
];
for (const heading of requiredHeadings) {
  if (!quintessential.includes(heading)) fail(`Missing required quintessential heading: ${heading}`);
}
const mustIncludeColumns = ['| Step | Actor | Function/Command | Preconditions | Expected on-chain outcome | Events emitted | What to verify next |'];
for (const row of mustIncludeColumns) {
  if (!quintessential.includes(row)) fail('Quintessential use case step table is missing required columns');
}

if (process.exitCode) process.exit(process.exitCode);
ok('Documentation checks passed');
