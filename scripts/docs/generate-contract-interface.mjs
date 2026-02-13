import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const outRootArg = process.argv.find((arg) => arg.startsWith('--out-dir='));
const outRoot = outRootArg ? path.resolve(repoRoot, outRootArg.split('=')[1]) : repoRoot;
const outFile = path.join(outRoot, 'docs/REFERENCE/CONTRACT_INTERFACE.md');
const srcPath = path.join(repoRoot, 'contracts/AGIJobManager.sol');
const src = fs.readFileSync(srcPath, 'utf8');
const shortSha = execSync('git rev-parse --short HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();

const clean = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const body = clean(src);

const errors = [...body.matchAll(/\berror\s+(\w+)\s*\(([^)]*)\)\s*;/g)]
  .map((m) => ({ name: m[1], args: m[2].trim() || '—' }))
  .sort((a, b) => a.name.localeCompare(b.name));

const events = [...body.matchAll(/\bevent\s+(\w+)\s*\(([\s\S]*?)\)\s*;/g)]
  .map((m) => ({
    name: m[1],
    params: m[2].replace(/\s+/g, ' ').trim() || '—'
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const fnRegex = /\bfunction\s+(\w+)\s*\(([^)]*)\)\s*(external|public)([^;{]*)/g;
const functions = [];
for (const m of body.matchAll(fnRegex)) {
  const name = m[1];
  const inputs = m[2].replace(/\s+/g, ' ').trim();
  const visibility = m[3];
  const tail = m[4].replace(/\s+/g, ' ').trim();
  const returnsMatch = tail.match(/returns\s*\(([^)]*)\)/);
  const mut = ['view', 'pure', 'payable'].find((x) => tail.includes(x)) ?? 'nonpayable';
  functions.push({ name, sig: `${name}(${inputs})`, visibility, mut, returns: returnsMatch ? returnsMatch[1].trim() : '—' });
}
functions.sort((a, b) => a.name.localeCompare(b.name));

const publicVars = [...body.matchAll(/^\s*([\w\[\]()<>., ]+)\s+public\s+(\w+)\s*(?:=.*)?;/gm)]
  .map((m) => ({ type: m[1].replace(/\s+/g, ' ').trim(), name: m[2] }))
  .sort((a, b) => a.name.localeCompare(b.name));

const content = `# AGIJobManager Interface Reference (Generated)\n\n- Verified against repository state: \`${shortSha}\`.\n- Source: \`contracts/AGIJobManager.sol\`.\n\n## Operator-facing interface\n\n### Public state variables\n\n| Variable | Type |\n| --- | --- |\n${publicVars.map((v) => `| \`${v.name}\` | \`${v.type}\` |`).join('\n')}\n\n### External/Public functions\n\n| Signature | Visibility | Mutability | Returns |\n| --- | --- | --- | --- |\n${functions.map((f) => `| \`${f.sig}\` | ${f.visibility} | ${f.mut} | ${f.returns === '—' ? '—' : `\`${f.returns}\``} |`).join('\n')}\n\n## Events index\n\n| Event | Parameters |\n| --- | --- |\n${events.map((e) => `| \`${e.name}\` | \`${e.params}\` |`).join('\n')}\n\n## Errors index\n\n| Error | Parameters |\n| --- | --- |\n${errors.map((e) => `| \`${e.name}\` | ${e.args === '—' ? '—' : `\`${e.args}\``} |`).join('\n')}\n\n## Notes on best-effort integrations\n\n- ENS ownership checks and ENS Job Pages hooks are integration conveniences, not safety preconditions for escrow accounting.\n- Settlement safety is enforced by AGI token balances, locked accounting buckets, and state transition guards.\n`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, content);
console.log(`Generated ${path.relative(repoRoot, outFile)}`);
