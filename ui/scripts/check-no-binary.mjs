import fs from 'node:fs';
import path from 'node:path';

const bad = ['.png','.jpg','.jpeg','.gif','.webp','.ico','.pdf','.zip','.tgz','.woff','.woff2','.ttf','.otf'];
const roots = [path.resolve(process.cwd()), path.resolve(process.cwd(), '../docs/ui')];
const hits = [];
function walk(dir){
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === 'test-results') continue;
    const p = path.join(dir,e.name);
    if (e.isDirectory()) walk(p);
    else if (bad.some((ext)=>p.toLowerCase().endsWith(ext))) hits.push(p);
  }
}
for (const r of roots) walk(r);
if (hits.length) { console.error(hits.join('\n')); process.exit(1); }
console.log('no forbidden binaries found');
