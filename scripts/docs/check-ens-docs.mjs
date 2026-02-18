import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

const requiredFiles = [
  'docs/INTEGRATIONS/ENS.md',
  'docs/INTEGRATIONS/ENS_ROBUSTNESS.md',
  'docs/INTEGRATIONS/ENS_USE_CASE.md',
  'docs/assets/ens-palette.svg',
  'docs/assets/ens-integration-wireframe.svg',
  'docs/REFERENCE/ENS_REFERENCE.md'
];

let failed = false;
const fail = (msg) => { failed = true; console.error(`❌ ${msg}`); };
const ok = (msg) => console.log(`✅ ${msg}`);

for (const rel of requiredFiles) {
  if (!fs.existsSync(path.join(root, rel))) fail(`Missing required ENS doc file: ${rel}`);
}

const checkMermaid = (rel, requiredSnippets) => {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  const blocks = [...text.matchAll(/```mermaid[\s\S]*?```/g)];
  if (!blocks.length) fail(`No Mermaid blocks found in ${rel}`);
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) fail(`Missing Mermaid/content snippet "${snippet}" in ${rel}`);
  }
};

checkMermaid('docs/INTEGRATIONS/ENS.md', ['flowchart TD', 'sequenceDiagram']);
checkMermaid('docs/INTEGRATIONS/ENS_ROBUSTNESS.md', ['flowchart TD']);
checkMermaid('docs/INTEGRATIONS/ENS_USE_CASE.md', ['flowchart TD', 'sequenceDiagram']);

const ensDoc = fs.readFileSync(path.join(root, 'docs/INTEGRATIONS/ENS.md'), 'utf8');
for (const snippet of [
  '## Purpose and scope',
  '## Components and trust boundaries',
  '## Configuration model',
  '## Runtime authorization model',
  '## What is best-effort vs enforced'
]) {
  if (!ensDoc.includes(snippet)) fail(`ENS integration doc missing required section: ${snippet}`);
}
if (!ensDoc.includes('| Config item | Where stored | Who can change | How to verify | Locking behavior | Safety notes |')) {
  fail('ENS integration doc missing required configuration model table header');
}

const robustnessDoc = fs.readFileSync(path.join(root, 'docs/INTEGRATIONS/ENS_ROBUSTNESS.md'), 'utf8');
for (const snippet of [
  '## Failure modes and safe handling',
  '## Security posture',
  '## Monitoring and observability',
  '## Runbooks',
  '### Safe configuration change checklist',
  '### Incident response: compromised ENS root or namespace',
  '### If configuration is locked'
]) {
  if (!robustnessDoc.includes(snippet)) fail(`ENS robustness doc missing required section: ${snippet}`);
}
if (!robustnessDoc.includes('| Failure mode | Symptoms | On-chain behavior | UI/operator impact | Safe remediation | Prevention |')) {
  fail('ENS robustness doc missing required failure mode table header');
}
if (!robustnessDoc.includes('| Threat vector | Impact | Mitigation | Residual risk | Operator responsibilities |')) {
  fail('ENS robustness doc missing required threat model table header');
}

for (const rel of ['docs/assets/ens-palette.svg', 'docs/assets/ens-integration-wireframe.svg']) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  const t = text.trim();
  if (text.includes('\u0000')) fail(`NUL byte found in ${rel}`);
  if (!t.startsWith('<svg') || !t.includes('</svg>')) fail(`Invalid SVG envelope in ${rel}`);
}

const mdFiles = [];
const walk = (dir) => {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.name === 'node_modules' || d.name === '.git') continue;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p);
    else if (d.isFile() && d.name.endsWith('.md')) mdFiles.push(p);
  }
};
walk(path.join(root, 'docs'));

const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
for (const md of mdFiles) {
  const text = fs.readFileSync(md, 'utf8');
  for (const m of text.matchAll(linkRegex)) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith('http') || raw.startsWith('mailto:') || raw.startsWith('#')) continue;
    const clean = raw.split('#')[0].split('?')[0];
    const target = path.resolve(path.dirname(md), clean);
    if (!fs.existsSync(target)) fail(`Broken relative link in ${path.relative(root, md)} -> ${raw}`);
  }
}

const useCase = fs.readFileSync(path.join(root, 'docs/INTEGRATIONS/ENS_USE_CASE.md'), 'utf8');
for (const snippet of [
  '## A) Local deterministic walkthrough',
  '## B) Testnet/mainnet operator checklist',
  '| Step | Actor | Action (function/script) | Preconditions | Expected outcome | Events/reads to verify |',
  '### Happy path sequence diagram',
  '### Configuration and verification flow',
  '### Expected state checkpoints'
]) {
  if (!useCase.includes(snippet)) fail(`ENS use case missing required section: ${snippet}`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ens-docs-'));
try {
  execFileSync('node', ['scripts/docs/generate-ens-reference.mjs', `--out-dir=${tmp}`], { cwd: root, stdio: 'ignore' });
  const expected = fs.readFileSync(path.join(tmp, 'docs/REFERENCE/ENS_REFERENCE.md'), 'utf8');
  const current = fs.readFileSync(path.join(root, 'docs/REFERENCE/ENS_REFERENCE.md'), 'utf8');
  if (!current.includes('Generated at (UTC):')) fail('docs/REFERENCE/ENS_REFERENCE.md must include a Generated at (UTC) header');
  if (expected !== current) fail('docs/REFERENCE/ENS_REFERENCE.md is stale. Run npm run docs:ens:gen');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failed) process.exit(1);
ok('ENS docs integrity checks passed');
