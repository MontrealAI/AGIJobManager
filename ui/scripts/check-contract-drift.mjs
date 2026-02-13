import fs from 'node:fs';
import path from 'node:path';

const solidity = fs.readFileSync(path.resolve(process.cwd(), '../contracts/AGIJobManager.sol'), 'utf8');
const abi = fs.readFileSync(path.resolve(process.cwd(), 'src/abis/agiJobManager.ts'), 'utf8');

const names = [...abi.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]).filter((n) => !['constructor'].includes(n));
const missing = names.filter((name) => !new RegExp(`\\b${name}\\b`).test(solidity));
if (missing.length) {
  console.error('Contract drift detected:', missing);
  process.exit(1);
}
console.log('contract drift check passed');
