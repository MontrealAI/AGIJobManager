import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join(process.cwd(), 'dist-ipfs');
const indexPath = path.join(outDir, 'index.html');

if (!fs.existsSync(outDir)) {
  throw new Error('Missing ui/dist-ipfs directory. Run npm run build:ipfs first.');
}

const entries = fs.readdirSync(outDir, { withFileTypes: true });
if (entries.length !== 1 || entries[0].name !== 'index.html' || !entries[0].isFile()) {
  throw new Error('ui/dist-ipfs must contain exactly one file: index.html');
}

const html = fs.readFileSync(indexPath, 'utf8');
const htmlWithoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');

const scriptSrcMatches = [...html.matchAll(/<script[^>]*\ssrc=(['"])(.*?)\1/gi)].map((m) => m[2]);
if (scriptSrcMatches.length > 0) {
  throw new Error(`External script references are forbidden: ${scriptSrcMatches.join(', ')}`);
}

const stylesheetLinks = [...htmlWithoutScripts.matchAll(/<link[^>]*\shref=(['"])(.*?)\1[^>]*>/gi)]
  .map((m) => m[2])
  .filter((href) => !href.startsWith('data:'));
if (stylesheetLinks.length > 0) {
  throw new Error(`External stylesheet links are forbidden: ${stylesheetLinks.join(', ')}`);
}

const assetRefs = [...htmlWithoutScripts.matchAll(/<(?:img|audio|video|source|track|iframe|embed|object|a)[^>]+(?:src|href)=(['"])(.*?)\1/gi)]
  .map((m) => m[2]);
const badRefs = assetRefs.filter((url) => !/^(#|https?:\/\/|ipfs:\/\/|ens:\/\/|mailto:|tel:|data:|\/)/i.test(url));
if (badRefs.length > 0) {
  throw new Error(`Relative asset URLs are forbidden in IPFS single-file build: ${badRefs.join(', ')}`);
}

console.log('IPFS single-file verification passed for ui/dist-ipfs/index.html');
