import fs from 'node:fs';
import path from 'node:path';

const forbidden = /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|tgz|woff2?|ttf|otf)$/i;
const roots = [path.resolve(process.cwd()), path.resolve(process.cwd(), '../docs/ui')];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'test-results') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (forbidden.test(entry.name)) throw new Error(`Forbidden binary extension: ${p}`);
  }
}
roots.forEach(walk);
console.log('no forbidden binary extensions found');
