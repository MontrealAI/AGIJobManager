import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const out = path.join(repoRoot, 'docs/ui/VERSIONS.md');
const rows = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).sort(([a], [b]) => a.localeCompare(b));
const body = `# UI Versions\n\nGenerated automatically.\n\n| Package | Version |\n|---|---|\n${rows.map(([n, v]) => `| ${n} | ${v} |`).join('\n')}\n`;
fs.writeFileSync(out, body);
console.log(`Wrote ${out}`);
