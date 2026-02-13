import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
const lines = [
  '# UI Versions',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '| Package | Version |',
  '| --- | --- |',
  `| next | ${pkg.dependencies.next} |`,
  `| react | ${pkg.dependencies.react} |`,
  `| wagmi | ${pkg.dependencies.wagmi} |`,
  `| viem | ${pkg.dependencies.viem} |`,
  `| rainbowkit | ${pkg.dependencies['@rainbow-me/rainbowkit']} |`
];

const file = path.resolve(process.cwd(), '../docs/ui/VERSIONS.md');
fs.writeFileSync(file, `${lines.join('\n')}\n`);
console.log('wrote', file);
