import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve(process.cwd(), '../docs/ui/graphics');
fs.mkdirSync(outDir, { recursive: true });

const palette = ['#14001F','#1B0B2A','#4B1D86','#7A3FF2','#E9DAFF','#E7E7EA','#A7A7B6'];
const paletteSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='1100' height='240'><rect width='1100' height='240' fill='#14001F'/>${palette.map((c,i)=>`<rect x='${20+i*150}' y='60' width='130' height='80' rx='14' fill='${c}'/><text x='${25+i*150}' y='160' fill='#E7E7EA' font-family='system-ui' font-size='14'>${c}</text>`).join('')}<text x='20' y='34' fill='#E9DAFF' font-family='system-ui' font-size='24'>ASI Sovereign Purple Palette Plate</text></svg>`;
fs.writeFileSync(path.join(outDir, 'palette-plate.svg'), paletteSvg);

const pages = ['dashboard','jobs','job-detail','admin','design'];
for (const [i,p] of pages.entries()) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='520'><rect width='1000' height='520' fill='#14001F'/><rect x='40' y='36' width='920' height='60' rx='14' fill='#1B0B2A' stroke='#7A3FF2' opacity='0.95'/><text x='60' y='72' fill='#E9DAFF' font-family='system-ui' font-size='24'>${p} wireframe plate</text><rect x='40' y='120' width='920' height='360' rx='18' fill='#1B0B2A' stroke='#4B1D86'/><rect x='70' y='160' width='260' height='120' rx='12' fill='#220d35'/><rect x='360' y='160' width='260' height='120' rx='12' fill='#220d35'/><rect x='650' y='160' width='260' height='120' rx='12' fill='#220d35'/><text x='70' y='450' fill='#A7A7B6' font-family='system-ui' font-size='14'>Generated plate #${i+1}</text></svg>`;
  fs.writeFileSync(path.join(outDir, `${p}-wireframe.svg`), svg);
}
console.log('graphics generated');
