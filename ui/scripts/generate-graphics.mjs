import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve('../docs/ui/graphics');
fs.mkdirSync(dir, { recursive: true });
const palette = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 260'><rect width='900' height='260' fill='#14001F'/><text x='24' y='38' fill='#E9DAFF' font-family='serif' font-size='24'>ASI Sovereign Purple Palette</text>${[['#14001F','ASI Deep'],['#1B0B2A','Sovereign Ink'],['#4B1D86','Imperial Purple'],['#7A3FF2','Amethyst'],['#E9DAFF','Orchid Mist']].map((c,i)=>`<rect x='${24+i*170}' y='70' width='150' height='120' fill='${c[0]}' rx='14'/><text x='${30+i*170}' y='210' fill='#E7E7EA' font-size='14'>${c[1]}</text>`).join('')}</svg>`;
fs.writeFileSync(path.join(dir,'palette-plate.svg'), palette);
const pages = ['dashboard','jobs','job-detail','admin','design'];
for (const p of pages) {
  fs.writeFileSync(path.join(dir,`${p}-wireframe.svg`), `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 520'><rect width='900' height='520' fill='#14001F'/><rect x='30' y='30' width='840' height='70' rx='12' fill='#1B0B2A' stroke='#7A3FF2'/><rect x='30' y='120' width='840' height='370' rx='18' fill='none' stroke='#4B1D86'/><text x='50' y='72' fill='#E9DAFF' font-size='22' font-family='serif'>${p} plate</text></svg>`);
}
