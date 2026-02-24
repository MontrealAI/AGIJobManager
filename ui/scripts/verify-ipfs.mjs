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

function parseTagAttributes(tagText) {
  const attrs = new Map();

  const valuedAttrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]*))/g;
  for (const match of tagText.matchAll(valuedAttrRegex)) {
    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attrs.set(key, value);
  }

  const valuelessAttrRegex = /\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?=\s|=|>|\/)/g;
  for (const match of tagText.matchAll(valuelessAttrRegex)) {
    const key = match[1].toLowerCase();
    if (!attrs.has(key)) attrs.set(key, '');
  }

  return attrs;
}

const scriptSrcMatches = [];
for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
  const attrs = parseTagAttributes(match[0]);
  if (attrs.has('src')) {
    const src = attrs.get('src') ?? '';
    scriptSrcMatches.push(src);
  }
}
if (scriptSrcMatches.length > 0) {
  throw new Error(`External script references found: ${scriptSrcMatches.join(', ')}`);
}

const stylesheetLinks = [];
for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
  const attrs = parseTagAttributes(match[0]);
  const rel = (attrs.get('rel') || '').toLowerCase();
  const href = attrs.get('href');
  if (rel.split(/\s+/).includes('stylesheet') && href) {
    stylesheetLinks.push(href);
  }
}
if (stylesheetLinks.length > 0) {
  throw new Error(`External stylesheet references found: ${stylesheetLinks.join(', ')}`);
}

const htmlWithoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
const attributeRefs = [...htmlWithoutScripts.matchAll(/<(?:a|img|script|link|source|iframe|audio|video|track|embed|object)[^>]+(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))[^>]*>/gi)]
  .map((m) => m[1] ?? m[2] ?? m[3] ?? '');

const isAllowedUrl = (url) => {
  const lower = url.toLowerCase();
  if (
    lower.startsWith('#') ||
    lower.startsWith('data:') ||
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('ipfs://') ||
    lower.startsWith('ens://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:')
  ) {
    return true;
  }
  return false;
};

const localRefs = attributeRefs.filter((url) => !isAllowedUrl(url));
if (localRefs.length > 0) {
  throw new Error(`Relative or unsupported asset references found: ${localRefs.slice(0, 5).join(', ')}`);
}

if (!html.includes('http-equiv="Content-Security-Policy"')) {
  throw new Error('CSP meta tag is missing from IPFS artifact.');
}

if (!html.includes('name="referrer"')) {
  throw new Error('Referrer policy meta tag is missing from IPFS artifact.');
}

const htmlWithoutScriptBlocks = html.replace(/<script[\s\S]*?<\/script>/gi, '');
if (/<[^>]+\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i.test(htmlWithoutScriptBlocks)) {
  throw new Error('Inline event handlers detected in built HTML.');
}

console.log('IPFS artifact verified: single-file, no external local assets, security metas present.');
