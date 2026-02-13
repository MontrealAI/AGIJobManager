import fs from 'node:fs';
const shots = {
  'dashboard.svg':'Dashboard demo view',
  'jobs-list.svg':'Jobs list with status matrix',
  'job-detail.svg':'Job detail with timeline',
  'admin-console.svg':'Admin console with authorization notice'
};
for (const [name, title] of Object.entries(shots)) {
  fs.writeFileSync(`../docs/ui/screenshots/${name}`, `<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'><rect width='100%' height='100%' fill='#14001F'/><text x='50%' y='50%' fill='#E9DAFF' font-size='36' text-anchor='middle' font-family='Inter'>${title}</text></svg>`);
}
console.log('Generated SVG screenshot artifacts.');
