import fs from 'node:fs';
const sol = fs.readFileSync('../contracts/AGIJobManager.sol','utf8') + '\n' + fs.readFileSync('../contracts/ens/ENSJobPages.sol','utf8');
const abi = fs.readFileSync('src/abis/agiJobManager.ts','utf8');
const names = [...abi.matchAll(/\{"type":"(?:function|event|error)","name":"([A-Za-z0-9_]+)"/g)].map((m)=>m[1]);
const inherited = new Set(['owner', 'paused']);
const exists = (n) => inherited.has(n) || new RegExp(`(function|event|error)\\s+${n}\\b`).test(sol) || new RegExp(`public[^;\\n]*\\b${n}\\b`).test(sol);
const missing = names.filter((n)=>!exists(n));
if (missing.length) throw new Error(`ABI drift: ${missing.join(', ')}`);
console.log('Contract drift check passed.');
