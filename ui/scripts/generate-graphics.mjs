import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.cwd(), '../docs/ui/graphics');
fs.mkdirSync(dir, { recursive: true });

const palette = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 240'><rect width='900' height='240' fill='#14001F'/>${[
  ['ASI Deep','#14001F'],['Sovereign Ink','#1B0B2A'],['Imperial Purple','#4B1D86'],['Amethyst','#7A3FF2'],['Orchid Mist','#E9DAFF'],['Platinum','#E7E7EA']
].map((c,i)=>`<rect x='${20+i*145}' y='40' width='130' height='130' rx='14' fill='${c[1]}'/><text x='${30+i*145}' y='190' fill='#E7E7EA' font-size='14'>${c[0]}</text>`).join('')}</svg>`;
fs.writeFileSync(path.join(dir, 'palette-plate.svg'), palette);

for (const p of ['dashboard','jobs','job-detail','admin','design']) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 700'><rect width='1200' height='700' fill='#14001F'/><rect x='60' y='60' width='1080' height='80' rx='16' fill='#1B0B2A' stroke='#7A3FF2'/><text x='90' y='110' fill='#E9DAFF' font-size='30'>${p} wireframe</text><rect x='60' y='180' width='1080' height='460' rx='16' fill='#1B0B2A' stroke='#4B1D86'/></svg>`;
  fs.writeFileSync(path.join(dir, `${p}-plate.svg`), svg);
}
console.log('graphics generated');
