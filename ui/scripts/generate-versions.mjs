import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const keys = ['next', 'wagmi', 'viem', '@rainbow-me/rainbowkit', '@tanstack/react-query', 'tailwindcss', '@playwright/test', 'vitest'];
const lines = [
  '# UI Versions',
  '',
  `- Node engine: ${pkg.engines?.node ?? 'n/a'}`,
  `- Last generated: ${new Date().toISOString()}`,
  '',
  '| Package | Version |',
  '|---|---|',
  ...keys.map((k) => `| ${k} | ${deps[k] ?? 'missing'} |`)
];
fs.writeFileSync(new URL('../../docs/ui/VERSIONS.md', import.meta.url), `${lines.join('\n')}\n`);
