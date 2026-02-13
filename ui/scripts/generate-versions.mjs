import fs from 'node:fs';
import path from 'node:path';
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
const lines = ['# UI Versions','','| Package | Version |','|---|---|',`| next | ${pkg.dependencies.next} |`,`| wagmi | ${pkg.dependencies.wagmi} |`,`| viem | ${pkg.dependencies.viem} |`,`| playwright | ${pkg.devDependencies['@playwright/test']} |`,''];
const out = path.resolve(process.cwd(), '../docs/ui/VERSIONS.md');
fs.writeFileSync(out, lines.join('\n'));
console.log('wrote', out);
