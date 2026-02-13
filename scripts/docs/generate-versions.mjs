import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const outRootArg = process.argv.find((arg) => arg.startsWith('--out-dir='));
const outRoot = outRootArg ? path.resolve(repoRoot, outRootArg.split('=')[1]) : repoRoot;
const outFile = path.join(outRoot, 'docs/REFERENCE/VERSIONS.md');

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(repoRoot, p), 'utf8'));
const rootPkg = readJson('package.json');
const uiPkg = readJson('ui/package.json');
const lock = readJson('package-lock.json');

const truffleFromLock = lock.packages?.['node_modules/truffle']?.version ?? rootPkg.devDependencies?.truffle ?? 'n/a';
const ozVersion = rootPkg.dependencies?.['@openzeppelin/contracts'] ?? 'n/a';
const nodeVersion = process.version.replace('v', '');
const npmVersion = execSync('npm --version', { cwd: repoRoot, encoding: 'utf8' }).trim();
const shortSha = execSync('git rev-parse --short HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();

const deps = [
  ['@openzeppelin/contracts', ozVersion, 'package.json'],
  ['truffle', truffleFromLock, 'package-lock.json'],
  ['ganache', rootPkg.devDependencies?.ganache ?? 'n/a', 'package.json'],
  ['solhint', rootPkg.devDependencies?.solhint ?? 'n/a', 'package.json'],
  ['next (ui)', uiPkg.dependencies?.next ?? uiPkg.devDependencies?.next ?? 'n/a', 'ui/package.json'],
  ['wagmi (ui)', uiPkg.dependencies?.wagmi ?? 'n/a', 'ui/package.json'],
  ['viem (ui)', uiPkg.dependencies?.viem ?? 'n/a', 'ui/package.json']
].sort((a, b) => a[0].localeCompare(b[0]));

const generatedAt = execSync('git show -s --format=%cI HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();

const content = `# Versions Reference (Generated)\n\n- Verified against repository state: \`${shortSha}\`.\n- Generated at (commit timestamp): \`${generatedAt}\`.\n\n## Toolchain snapshot\n\n| Tool | Version | Source |\n| --- | --- | --- |\n| node | ${nodeVersion} | runtime |\n| npm | ${npmVersion} | runtime |\n| truffle | ${truffleFromLock} | package-lock.json |\n| @openzeppelin/contracts | ${ozVersion} | package.json |\n\n## Key dependency pins\n\n| Dependency | Version | Source file |\n| --- | --- | --- |\n${deps.map((d) => `| ${d[0]} | ${d[1]} | \`${d[2]}\` |`).join('\n')}\n\n## Source files used\n\n- \`package.json\`\n- \`package-lock.json\`\n- \`ui/package.json\`\n`; 

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, content);
console.log(`Generated ${path.relative(repoRoot, outFile)}`);
