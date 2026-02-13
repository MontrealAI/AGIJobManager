import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = path.resolve(process.cwd(), '..');
const pkgPath = path.join(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

let stamp = 'unknown';
try {
  stamp = execSync('git log -1 --format=%cI -- ui/package.json', { cwd: repoRoot, encoding: 'utf8' }).trim() || 'unknown';
} catch {
  // fallback to unknown in detached/no-git contexts
}

const keys = [
  'next', 'react', 'react-dom', 'tailwindcss', 'wagmi', 'viem',
  '@rainbow-me/rainbowkit', '@tanstack/react-query', 'zod',
  'vitest', 'fast-check', '@playwright/test', '@axe-core/playwright', 'typescript'
];

const versions = { ...pkg.dependencies, ...pkg.devDependencies };
const rows = keys.filter((k) => versions[k]).map((k) => `| ${k} | ${versions[k]} |`).join('\n');

const body = `# UI Versions\n\nGenerated from pinned dependencies in \`ui/package.json\`.\n\n- Node engine: \`${pkg.engines?.node ?? 'not specified'}\`\n- Snapshot timestamp (git commit time for package.json): \`${stamp}\`\n\n| Package | Version |\n|---|---|\n${rows}\n`;

if (process.argv.includes('--stdout')) {
  process.stdout.write(body);
} else {
  const out = path.join(repoRoot, 'docs/ui/VERSIONS.md');
  fs.writeFileSync(out, body);
  console.log(`Wrote ${out}`);
}
