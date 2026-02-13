import fs from 'node:fs';
import { chromium } from 'playwright';

const pages = [
  ['dashboard', '/'],
  ['jobs', '/jobs'],
  ['job-detail', '/jobs/3'],
  ['admin', '/admin']
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
for (const [name, path] of pages) {
  await page.goto(`http://127.0.0.1:3010${path}`);
  await page.waitForTimeout(300);
  const title = await page.title();
  const text = (await page.locator('body').innerText()).slice(0, 1200).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1400' height='900'><rect width='100%' height='100%' fill='#14001F'/><text x='40' y='70' fill='#E9DAFF' font-size='36' font-family='Inter'>${title || 'AGIJobManager UI'} - ${name}</text><foreignObject x='40' y='110' width='1320' height='760'><div xmlns='http://www.w3.org/1999/xhtml' style='font-family:Inter;color:#E7E7EA;white-space:pre-wrap;line-height:1.35;font-size:18px'>${text}</div></foreignObject></svg>`;
  fs.writeFileSync(new URL(`../../docs/ui/screenshots/${name}.svg`, import.meta.url), svg);
}
await browser.close();
console.log('screenshot svgs generated');
