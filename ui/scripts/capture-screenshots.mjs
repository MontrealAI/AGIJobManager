import fs from 'node:fs';
import path from 'node:path';
const out = path.resolve(process.cwd(), '..', 'docs', 'ui', 'screenshots');
const pages = [
  ['dashboard.svg','Dashboard','/'],
  ['jobs-list.svg','Jobs list','/jobs'],
  ['job-detail.svg','Job detail timeline','/jobs/3'],
  ['admin.svg','Admin console','/admin']
];
fs.mkdirSync(out, { recursive: true });
for (const [file, title, route] of pages) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'><rect width='100%' height='100%' fill='#14001F'/><rect x='40' y='40' width='1200' height='640' rx='18' fill='#1B0B2A' stroke='#7A3FF2'/><text x='80' y='130' fill='#E9DAFF' font-size='44' font-family='Inter,Arial'>${title}</text><text x='80' y='180' fill='#A7A7B6' font-size='26' font-family='Inter,Arial'>Deterministic demo artifact (text-only SVG)</text><text x='80' y='230' fill='#A7A7B6' font-size='24' font-family='monospace'>Route: ${route}</text></svg>`;
  fs.writeFileSync(path.join(out, file), svg);
}
console.log('screenshot placeholders generated');
