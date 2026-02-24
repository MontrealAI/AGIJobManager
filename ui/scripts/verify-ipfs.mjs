import fs from 'node:fs';
import path from 'node:path';

const uiRoot = process.cwd();
const distDir = path.join(uiRoot, 'dist-ipfs');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(distDir)) {
  throw new Error('dist-ipfs directory missing. Run npm run build:ipfs first.');
}

const entries = fs.readdirSync(distDir);
if (entries.length !== 1 || entries[0] !== 'index.html') {
  throw new Error(`dist-ipfs must contain exactly one file (index.html). Found: ${entries.join(', ')}`);
}

const html = fs.readFileSync(indexPath, 'utf8');

const scriptSrcMatches = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi)];
if (scriptSrcMatches.length > 0) {
  throw new Error(`External script references found: ${scriptSrcMatches.map((m) => m[1]).join(', ')}`);
}

const stylesheetLinks = [...html.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)];
if (stylesheetLinks.length > 0) {
  throw new Error(`External stylesheet references found: ${stylesheetLinks.map((m) => m[1]).join(', ')}`);
}

const htmlWithoutScriptBlocks = html.replace(/<script[\s\S]*?<\/script>/gi, '');

const assetAttrs = [...htmlWithoutScriptBlocks.matchAll(/<[^>]+\b(?:src|href)=[\"']([^\"']+)[\"'][^>]*>/gi)].map((m) => m[1]);
const isAllowedInlineOrRemote = (value) => {
  const lowered = value.toLowerCase();
  if (lowered.startsWith('#')) return true;
  if (lowered.startsWith('data:')) return true;
  if (lowered.startsWith('http://') || lowered.startsWith('https://')) return true;
  if (lowered.startsWith('ipfs://') || lowered.startsWith('ens://')) return true;
  if (lowered.startsWith('mailto:') || lowered.startsWith('tel:')) return true;
  return false;
};

const localRefs = assetAttrs.filter((value) => !isAllowedInlineOrRemote(value));
if (localRefs.length > 0) {
  throw new Error(`Relative/local asset references found: ${localRefs.slice(0, 5).join(', ')}`);
}

if (!html.includes('http-equiv="Content-Security-Policy"')) {
  throw new Error('CSP meta tag is missing from IPFS artifact.');
}

if (!html.includes('name="referrer"')) {
  throw new Error('Referrer policy meta tag is missing from IPFS artifact.');
}

if (/\son[a-z]+\s*=\s*["'][^"']*["']/i.test(html)) {
  throw new Error('Inline event handlers detected in built HTML.');
}

console.log('IPFS artifact verified: single-file, no external local assets, security metas present.');
