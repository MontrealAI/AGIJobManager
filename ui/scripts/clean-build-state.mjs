import fs from 'node:fs';
import path from 'node:path';

const uiRoot = process.cwd();
for (const relative of ['.next', 'dist-ipfs']) {
  fs.rmSync(path.join(uiRoot, relative), { recursive: true, force: true });
}

console.log('Cleaned build state: .next, dist-ipfs');
