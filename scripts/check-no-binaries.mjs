import fs from 'fs';
import { execSync } from 'child_process';

const forbiddenExt = new Set(['.png','.jpg','.jpeg','.gif','.webp','.pdf','.ico','.woff','.woff2','.ttf','.otf','.zip','.tar','.gz','.7z']);

const base = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'HEAD~1';
let files = [];
try {
  files = execSync(`git diff --name-only --diff-filter=A ${base}...HEAD`).toString().trim().split('\n').filter(Boolean);
} catch {
  files = execSync('git diff --name-only --diff-filter=A HEAD').toString().trim().split('\n').filter(Boolean);
}

const violations = [];
for (const file of files) {
  const lower = file.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf('.'));
  if (forbiddenExt.has(ext)) {
    violations.push(`${file}: forbidden extension ${ext}`);
    continue;
  }
  if (!fs.existsSync(file)) continue;
  const buf = fs.readFileSync(file);
  if (buf.includes(0)) violations.push(`${file}: appears binary (contains NUL byte)`);
}

if (violations.length) {
  console.error('Binary policy violation(s) detected:');
  for (const v of violations) console.error(` - ${v}`);
  console.error('Remove the file(s) or convert assets to Markdown/Mermaid/SVG text formats.');
  process.exit(1);
}

console.log('No forbidden/binary files detected in newly added files.');
