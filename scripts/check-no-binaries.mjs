import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const forbiddenExt = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.ico',
  '.woff', '.woff2', '.ttf', '.otf',
  '.zip', '.tar', '.gz', '.7z'
]);

const run = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

function detectBase() {
  const ghBase = process.env.GITHUB_BASE_REF;
  const candidates = [
    ghBase ? `git merge-base HEAD origin/${ghBase}` : null,
    'git merge-base HEAD origin/main',
    'git rev-parse HEAD~1',
    'git rev-list --max-parents=0 HEAD'
  ].filter(Boolean);

  for (const cmd of candidates) {
    try {
      const out = run(cmd);
      if (out) return out;
    } catch {
      // continue
    }
  }
  throw new Error('Unable to determine git base commit for binary checks.');
}

const base = detectBase();
const files = run(`git diff --name-only --diff-filter=A ${base}...HEAD`)
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

const violations = [];
for (const rel of files) {
  const full = path.join(root, rel);
  const ext = path.extname(rel).toLowerCase();
  if (forbiddenExt.has(ext)) {
    violations.push(`${rel}: forbidden extension ${ext}`);
    continue;
  }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
  const data = fs.readFileSync(full);
  if (data.includes(0)) violations.push(`${rel}: appears binary (NUL byte detected)`);
}

if (violations.length) {
  console.error('Forbidden binary additions detected:');
  console.error(`Base commit: ${base}`);
  for (const v of violations) console.error(` - ${v}`);
  console.error('Remediation: remove these files or replace with text-only Markdown/Mermaid/SVG assets.');
  process.exit(1);
}

console.log(`No forbidden binary additions detected (base ${base}, checked ${files.length} added file(s)).`);
