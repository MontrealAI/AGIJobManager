import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.cwd(), '..');
const sol = fs.readFileSync(path.join(root, 'contracts/AGIJobManager.sol'), 'utf8');
const abi = fs.readFileSync(path.join(process.cwd(), 'src/abis/agiJobManager.ts'), 'utf8');
const entries = [...abi.matchAll(/"type":"(function|event|error)","name":"([A-Za-z0-9_]+)"/g)].map((m) => ({ type: m[1], name: m[2] }));
const allowInherited = new Set(['owner', 'paused', 'unpause', 'pause', 'tokenURI']);
const missing = entries
  .map((e) => e.name)
  .filter((n, i, a) => a.indexOf(n) === i)
  .filter((n) => !allowInherited.has(n))
  .filter((n) => !new RegExp(`\\b${n}\\b`).test(sol));
if (missing.length) throw new Error(`Contract drift: ${missing.join(', ')}`);
console.log('contract drift check passed');
