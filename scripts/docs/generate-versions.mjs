import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const outRootArg = process.argv.find((arg) => arg.startsWith('--out-dir='));
const outRoot = outRootArg ? path.resolve(repoRoot, outRootArg.split('=')[1]) : repoRoot;
const outFile = path.join(outRoot, 'docs/REFERENCE/VERSIONS.md');

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(repoRoot, p), 'utf8'));
const rootPkg = readJson('package.json');
const uiPkg = readJson('ui/package.json');
const lock = readJson('package-lock.json');

const sourceFiles = ['package.json', 'package-lock.json', 'ui/package.json'];
const sourceFingerprint = crypto
  .createHash('sha256')
  .update(sourceFiles.map((f) => fs.readFileSync(path.join(repoRoot, f), 'utf8')).join('\n\n'))
  .digest('hex')
  .slice(0, 12);
const generatedAt = sourceFingerprint;

const truffleFromLock = lock.packages?.['node_modules/truffle']?.version ?? rootPkg.devDependencies?.truffle ?? 'n/a';
const ozVersion = rootPkg.dependencies?.['@openzeppelin/contracts'] ?? 'n/a';
const nodeVersion = rootPkg.engines?.node ?? 'recommended: Node 20.x (CI baseline)';
const npmVersion = rootPkg.packageManager ?? 'recommended: npm 10.x (paired with Node 20.x)';

const deps = [
  ['@openzeppelin/contracts', ozVersion, 'package.json'],
  ['truffle', truffleFromLock, 'package-lock.json'],
  ['ganache', rootPkg.devDependencies?.ganache ?? 'n/a', 'package.json'],
  ['solhint', rootPkg.devDependencies?.solhint ?? 'n/a', 'package.json'],
  ['next (ui)', uiPkg.dependencies?.next ?? uiPkg.devDependencies?.next ?? 'n/a', 'ui/package.json'],
  ['wagmi (ui)', uiPkg.dependencies?.wagmi ?? 'n/a', 'ui/package.json'],
  ['viem (ui)', uiPkg.dependencies?.viem ?? 'n/a', 'ui/package.json']
].sort((a, b) => a[0].localeCompare(b[0]));

const content = `# Versions Reference (Generated)\n\n- Generated at (deterministic source fingerprint): \`${generatedAt}\`.\n- Source snapshot fingerprint: \`${sourceFingerprint}\`.\n- Generation mode: deterministic from repository source files.\n\n## Toolchain snapshot\n\n| Tool | Version | Source |\n| --- | --- | --- |\n| node | ${nodeVersion} | runtime |\n| npm | ${npmVersion} | runtime |\n| truffle | ${truffleFromLock} | package-lock.json |\n| @openzeppelin/contracts | ${ozVersion} | package.json |\n\n## Key dependency pins\n\n| Dependency | Version | Source file |\n| --- | --- | --- |\n${deps.map((d) => `| ${d[0]} | ${d[1]} | \`${d[2]}\` |`).join('\n')}\n\n## Source files used\n\n- \`package.json\`\n- \`package-lock.json\`\n- \`ui/package.json\`\n`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, content);
console.log(`Generated ${path.relative(repoRoot, outFile)}`);
