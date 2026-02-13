import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('..');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const out = `# UI Versions\n\n| Package | Version |\n| --- | --- |\n${Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).sort().map(([k,v])=>`| ${k} | ${v} |`).join('\n')}\n`;
fs.mkdirSync(path.join(root, 'docs/ui'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/ui/VERSIONS.md'), out);
