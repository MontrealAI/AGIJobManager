import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(root, 'contracts/AGIJobManager.sol'), 'utf8');
const match = source.match(/^\/\/ SPDX-License-Identifier: MIT\s*\/\*([\s\S]*?)\*\//);
if (!match) throw new Error('Missing canonical opening protocol notice.');
const escaped = match[1].trim().replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const filename = path.join(root, 'ui/agijobmanager-usdc.html');
const html = fs.readFileSync(filename, 'utf8');
const pattern = /(<div class="term-body" style="white-space:pre-wrap">)[\s\S]*?(<\/div><\/details>)/g;
if ([...html.matchAll(pattern)].length !== 1) throw new Error('Expected exactly one embedded protocol notice.');
const updated = html.replace(pattern, (_all, begin, end) => begin + escaped + end);
if (process.argv.includes('--check')) {
  if (updated !== html) throw new Error('Embedded protocol notice differs from the source. Run npm run docs:terms.');
  console.log('Embedded protocol notice matches the source.');
} else {
  fs.writeFileSync(filename, updated);
  console.log('Synchronized embedded protocol notice.');
}
