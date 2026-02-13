import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const forbiddenExt = new Set(['.png','.jpg','.jpeg','.gif','.webp','.pdf','.ico','.woff','.woff2','.ttf','.otf','.zip','.tar','.gz','.7z']);

const q = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

function detectBase() {
  const ghBase = process.env.GITHUB_BASE_REF;
  try {
    if (ghBase) {
      const base = q(`git merge-base HEAD origin/${ghBase}`);
      if (base) return base;
    }
  } catch {}
  try {
    return q('git merge-base HEAD origin/main');
  } catch {}
  try {
    return q('git rev-parse HEAD~1');
  } catch {
    return q('git rev-list --max-parents=0 HEAD');
  }
}

const base = detectBase();
const files = execSync(`git diff --name-only --diff-filter=A ${base}...HEAD`, { encoding: 'utf8' })
  .split('\n').map((s) => s.trim()).filter(Boolean);

const violations = [];
for (const rel of files) {
  const full = path.join(root, rel);
  const ext = path.extname(rel).toLowerCase();
  if (forbiddenExt.has(ext)) violations.push(`${rel}: forbidden extension ${ext}`);
  if (fs.existsSync(full) && fs.statSync(full).isFile()) {
    const sample = fs.readFileSync(full);
    if (sample.includes(0)) violations.push(`${rel}: appears binary (NUL byte detected)`);
  }
}

if (violations.length) {
  console.error('Forbidden binary additions detected:');
  for (const v of violations) console.error(` - ${v}`);
  console.error('Remove these files or convert assets to Markdown/Mermaid/SVG text.');
  process.exit(1);
}

console.log(`No forbidden binary additions detected across ${files.length} newly added file(s).`);
