import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.cwd(), '..');
const forbidden = /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|tgz|woff|woff2|ttf|otf)$/i;
const ignore = new Set(['node_modules', '.next', 'test-results']);
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(ignore.has(e.name)) continue; const full=path.join(dir,e.name); if(e.isDirectory()) walk(full); else if(forbidden.test(e.name)) throw new Error(`Forbidden binary: ${full}`);}}
walk(path.join(root,'ui')); walk(path.join(root,'docs/ui')); console.log('no-binary check passed');
