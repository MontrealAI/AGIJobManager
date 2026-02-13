import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = process.cwd();
const sourcePath = path.join(root, 'contracts/AGIJobManager.sol');
const outPath = path.join(root, 'docs/REFERENCE/CONTRACT_INTERFACE.md');
const source = fs.readFileSync(sourcePath, 'utf8');
const shortSha = execSync('git rev-parse --short HEAD').toString().trim();
const generatedAt = execSync('git show -s --format=%cI HEAD').toString().trim();

const clean = (s) => s.replace(/\s+/g, ' ').trim();
const getMatches = (re) => Array.from(source.matchAll(re)).map((m) => m[1]);

const errors = getMatches(/^\s*error\s+([^;]+);/gm).map(clean).sort();
const events = getMatches(/^\s*event\s+([^;]+);/gm).map(clean).sort();
const funcs = getMatches(/^\s*function\s+([^;{]+)(?:\{|;)/gm)
  .map(clean)
  .filter((x) => /\b(external|public)\b/.test(x))
  .sort();
const publicVars = getMatches(/^\s*(?:IERC20|address|bool|bytes32|uint\d*|string|mapping\([^\)]*\))\s+public\s+([^;]+);/gm)
  .map(clean)
  .sort();

const bullets = (arr) => (arr.length ? arr.map((x) => `- \`${x}\``).join('\n') : '- _None detected_');

const content = `# AGIJobManager Contract Interface (Generated)

Verified against repository state: \`${shortSha}\`.

Generated at: \`${generatedAt}\`.

## Operator-facing interface

${bullets(funcs)}

## Public state variables (operator-relevant)

${bullets(publicVars)}

## Events index

${bullets(events)}

## Errors index

${bullets(errors)}

## Notes on best-effort integrations

- ENS ownership checks, ENSJobPages hooks, and \`tokenURI\` enrichment are best-effort integrations.
- Escrow safety and settlement correctness must not depend on hook success.
`;

fs.writeFileSync(outPath, content);
console.log(`Wrote ${path.relative(root, outPath)}`);
