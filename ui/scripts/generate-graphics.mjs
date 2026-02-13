import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), '..');
const dir = path.join(root, 'docs/ui/graphics');
fs.mkdirSync(dir, { recursive: true });
const palette = ['#14001F','#1B0B2A','#4B1D86','#7A3FF2','#E9DAFF','#E7E7EA'];
const paletteSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 220'><rect width='1200' height='220' fill='#14001F'/>${palette.map((c,i)=>`<rect x='${20+i*190}' y='40' width='170' height='110' rx='14' fill='${c}'/><text x='${30+i*190}' y='175' fill='#E9DAFF' font-size='18'>${c}</text>`).join('')}</svg>`;
fs.writeFileSync(path.join(dir,'palette-plate.svg'), paletteSvg);
const pages=['dashboard','jobs','job-detail','admin','design'];
for (const p of pages){
  fs.writeFileSync(path.join(dir,`${p}-wireframe.svg`), `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 700'><rect width='1200' height='700' fill='#14001F'/><rect x='40' y='30' width='1120' height='60' rx='14' fill='#1B0B2A'/><rect x='40' y='120' width='1120' height='140' rx='18' fill='#4B1D86'/><rect x='40' y='290' width='360' height='180' rx='14' fill='#1B0B2A'/><rect x='420' y='290' width='360' height='180' rx='14' fill='#1B0B2A'/><rect x='800' y='290' width='360' height='180' rx='14' fill='#1B0B2A'/><text x='60' y='70' fill='#E9DAFF' font-size='28'>${p}</text></svg>`);
}
console.log('graphics generated');
