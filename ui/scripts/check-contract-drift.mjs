import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve(process.cwd(), '../contracts/AGIJobManager.sol'), 'utf8');
const abiText = fs.readFileSync(path.resolve(process.cwd(), 'src/abis/agiJobManager.ts'), 'utf8');
const inherited = new Set(['owner', 'paused']);
const entries = [...abiText.matchAll(/"type":"(function|event|error)","name":"([^"]+)"/g)].map((m) => ({ type: m[1], name: m[2] }));
let failed = false;
for (const e of entries) {
  let ok = false;
  if (e.type === 'function') {
    if (inherited.has(e.name)) ok = true;
    else ok = new RegExp(`function\\s+${e.name}\\s*\\(`).test(src) || new RegExp(`\\b${e.name}\\b[^;\\n]*\\bpublic\\b`).test(src) || new RegExp(`\\bpublic\\b[^;\\n]*\\b${e.name}\\b`).test(src);
  } else if (e.type === 'event') {
    ok = new RegExp(`event\\s+${e.name}\\s*\\(`).test(src);
  } else {
    ok = new RegExp(`error\\s+${e.name}\\s*\\(`).test(src);
  }
  if (!ok) {
    console.error(`Drift: ${e.type} ${e.name} missing in contract source`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(`contract drift check passed (${entries.length} ABI entries)`);
