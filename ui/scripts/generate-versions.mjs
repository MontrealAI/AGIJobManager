import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const keys = ['next', 'wagmi', 'viem', '@rainbow-me/rainbowkit', '@tanstack/react-query', 'tailwindcss', '@playwright/test', 'vitest'];
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const lines = [
  '# UI Versions',
  '',
  `- Node engine: ${pkg.engines?.node || 'n/a'}`,
  '',
  '| Package | Version |',
  '| --- | --- |',
  ...keys.map((k) => `| ${k} | ${deps[k] || 'n/a'} |`),
  '',
  `Last generated: ${new Date().toISOString()}`
];
fs.writeFileSync(new URL('../../docs/ui/VERSIONS.md', import.meta.url), `${lines.join('\n')}\n`);
