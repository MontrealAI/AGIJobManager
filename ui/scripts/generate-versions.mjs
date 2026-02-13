import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const pick = (k) => deps[k] || 'n/a';
const content = `# UI Versions\n\nLast generated: ${new Date().toISOString()}\n\n| Component | Version |\n|---|---|\n| Node engine | ${pkg.engines?.node || 'n/a'} |\n| next | ${pick('next')} |\n| wagmi | ${pick('wagmi')} |\n| viem | ${pick('viem')} |\n| rainbowkit | ${pick('@rainbow-me/rainbowkit')} |\n| react-query | ${pick('@tanstack/react-query')} |\n| tailwindcss | ${pick('tailwindcss')} |\n| playwright | ${pick('@playwright/test')} |\n| vitest | ${pick('vitest')} |\n`;
fs.writeFileSync(new URL('../../docs/ui/VERSIONS.md', import.meta.url), content);
console.log('generated docs/ui/VERSIONS.md');
