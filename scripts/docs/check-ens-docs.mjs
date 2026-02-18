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
  if (!fs.existsSync(path.join(root, rel))) fail(`Missing required ENS docs file: ${rel}`);
}

const checkSections = (rel, sections) => {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const section of sections) {
    if (!text.includes(section)) fail(`${rel} missing required section/snippet: ${section}`);
  }
};

checkSections('docs/INTEGRATIONS/ENS.md', [
  '## Purpose and scope',
  '## Components and trust boundaries',
  '## Configuration model',
  '## Runtime authorization model',
  '### Contract-enforced algorithm',
  '### What is enforced vs operational vs best-effort'
]);

checkSections('docs/INTEGRATIONS/ENS_ROBUSTNESS.md', [
  '## Failure modes and remediations',
  '## Security posture',
  '## Monitoring and observability',
  '## Runbooks',
  '### Safe configuration change checklist',
  '### Incident response: ENS compromised root/namespace',
  '### If configuration is locked'
]);

checkSections('docs/INTEGRATIONS/ENS_USE_CASE.md', [
  '## A) Local deterministic walkthrough (no external RPC)',
  '## B) Testnet/mainnet operator checklist (no secrets)',
  '| Step | Actor | Action (function/script) | Preconditions | Expected outcome | Events/reads to verify |',
  '### Happy path sequence diagram',
  '### Configuration and verification flow',
  '### Expected state checkpoints'
]);

const checkMermaid = (rel, snippets, minBlocks) => {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  const blocks = [...text.matchAll(/```mermaid[\s\S]*?```/g)];
  if (blocks.length < minBlocks) fail(`${rel} has ${blocks.length} Mermaid block(s); expected at least ${minBlocks}`);
  for (const snippet of snippets) {
    if (!text.includes(snippet)) fail(`${rel} missing Mermaid/content snippet: ${snippet}`);
  }
};

checkMermaid('docs/INTEGRATIONS/ENS.md', ['flowchart TD', 'sequenceDiagram', '%%{init:'], 2);
checkMermaid('docs/INTEGRATIONS/ENS_ROBUSTNESS.md', ['flowchart TD', '%%{init:'], 2);
checkMermaid('docs/INTEGRATIONS/ENS_USE_CASE.md', ['flowchart TD', 'sequenceDiagram', '%%{init:'], 2);

for (const rel of ['docs/assets/ens-palette.svg', 'docs/assets/ens-integration-wireframe.svg']) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  const trimmed = text.trim();
  if (text.includes('\u0000')) fail(`${rel} contains NUL bytes`);
  if (!trimmed.startsWith('<svg') || !trimmed.includes('</svg>')) fail(`${rel} is not a valid SVG envelope`);
  if (!trimmed.includes('xmlns="http://www.w3.org/2000/svg"')) fail(`${rel} missing SVG namespace`);
  const hasExternalRef = /(<script\b|(?:xlink:href|href)\s*=\s*(?:['\"]?\s*(?:https?:|\/\/)))/i.test(trimmed);
  if (hasExternalRef) fail(`${rel} must not embed scripts or external references`);
}

const mdFiles = [];
const walk = (dir) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.git' || ent.name === 'node_modules') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    if (ent.isFile() && ent.name.endsWith('.md')) mdFiles.push(full);
  }
};
walk(path.join(root, 'docs'));

const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
for (const mdPath of mdFiles) {
  const text = fs.readFileSync(mdPath, 'utf8');
  for (const match of text.matchAll(linkRegex)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('mailto:') || raw.startsWith('#')) continue;
    const clean = raw.split('#')[0].split('?')[0];
    const target = path.resolve(path.dirname(mdPath), clean);
    if (!fs.existsSync(target)) {
      fail(`Broken relative link in ${path.relative(root, mdPath)} -> ${raw}`);
    }
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ens-docs-'));
try {
  execFileSync('node', ['scripts/docs/generate-ens-reference.mjs', `--out-dir=${tmp}`], { cwd: root, stdio: 'ignore' });
  const expected = fs.readFileSync(path.join(tmp, 'docs/REFERENCE/ENS_REFERENCE.md'), 'utf8');
  const current = fs.readFileSync(path.join(root, 'docs/REFERENCE/ENS_REFERENCE.md'), 'utf8');
  if (expected !== current) fail('docs/REFERENCE/ENS_REFERENCE.md is stale. Run npm run docs:ens:gen');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const reference = fs.readFileSync(path.join(root, 'docs/REFERENCE/ENS_REFERENCE.md'), 'utf8');
for (const snippet of [
  '# ENS Reference (Generated)',
  'Generated at (UTC):',
  'Source fingerprint:',
  'Source files used:',
  '## ENS surface area',
  '## Config and locks',
  '## Events and errors',
  '## Notes / caveats from code comments'
]) {
  if (!reference.includes(snippet)) fail(`ENS reference missing required metadata/section: ${snippet}`);
}

if (failed) process.exit(1);
ok('ENS documentation checks passed');
