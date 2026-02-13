import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
const keys = ['next', 'wagmi', 'viem', '@rainbow-me/rainbowkit', '@tanstack/react-query', 'tailwindcss', '@playwright/test', 'vitest'];
const rows = keys.map((k) => `| ${k} | ${(pkg.dependencies?.[k] ?? pkg.devDependencies?.[k] ?? 'n/a')} |`).join('\n');
const out = `# UI Versions\n\n- Node engine: ${pkg.engines?.node ?? 'n/a'}\n- Last generated: ${new Date().toISOString()}\n\n| Dependency | Version |\n| --- | --- |\n${rows}\n`;
fs.writeFileSync(path.resolve('../docs/ui/VERSIONS.md'), out);
console.log('Generated docs/ui/VERSIONS.md');
