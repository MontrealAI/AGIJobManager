import fs from 'node:fs';
const outDir = new URL('../../docs/ui/screenshots/', import.meta.url);
fs.mkdirSync(outDir, { recursive: true });
const pages = ['dashboard','jobs-list','job-detail','admin'];
for (const p of pages) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'><rect width='100%' height='100%' fill='#14001F'/><text x='40' y='90' fill='#E9DAFF' font-size='48' font-family='Inter'>AGIJobManager UI Demo</text><text x='40' y='160' fill='#A7A7B6' font-size='30' font-family='Inter'>${p}</text><rect x='40' y='210' width='1200' height='460' rx='18' fill='#1B0B2A' stroke='#7A3FF2'/></svg>`;
  fs.writeFileSync(new URL(`${p}.svg`, outDir), svg);
}
console.log('wrote svg screenshots');
