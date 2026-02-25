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
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tagText.matchAll(attrRegex)) {
    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attrs.set(key, value);
  }
  return attrs;
}

const scriptSrcMatches = [];
for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
  const tagText = match[0];
  const attrs = parseTagAttributes(tagText);
  const hasValuedSrc = attrs.has('src');
  const hasValuelessSrc = /\ssrc\b(?:\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s\"'=<>`]*)?)?(?=\s|>|\/)/i.test(tagText);

  if (hasValuedSrc || hasValuelessSrc) {
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
const attributeRefs = [...htmlWithoutScripts.matchAll(/<([a-zA-Z][a-zA-Z0-9:-]*)[^>]+\b(src|href|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))[^>]*>/g)]
  .map((m) => ({
    tag: m[1].toLowerCase(),
    attr: m[2].toLowerCase(),
    url: (m[3] ?? m[4] ?? m[5] ?? '').trim()
  }));

const isAllowedUrl = ({ tag, attr, url }) => {
  const lower = url.toLowerCase();

  if (tag === 'a' && attr === 'href') {
    return (
      lower.startsWith('#') ||
      lower.startsWith('http://') ||
      lower.startsWith('https://') ||
      lower.startsWith('ipfs://') ||
      lower.startsWith('ens://') ||
      lower.startsWith('mailto:') ||
      lower.startsWith('tel:')
    );
  }

  if (attr === 'srcset') {
    const candidates = url
      .split(',')
      .map((entry) => entry.trim().split(/\s+/)[0] ?? '')
      .filter(Boolean);
    return candidates.every((candidate) => candidate.toLowerCase().startsWith('data:'));
  }

  return lower.startsWith('data:');
};

const disallowedRefs = attributeRefs.filter((entry) => !isAllowedUrl(entry));
if (disallowedRefs.length > 0) {
  const sample = disallowedRefs.slice(0, 5).map((entry) => `${entry.tag}[${entry.attr}]=${entry.url}`);
  throw new Error(`Relative or unsupported asset references found: ${sample.join(', ')}`);
}


const cssUrlRefs = [...htmlWithoutScripts.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
  .flatMap((m) => [...m[1].matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)].map((x) => (x[2] || '').trim()))
  .filter(Boolean);

const disallowedCssUrls = cssUrlRefs.filter((url) => !url.toLowerCase().startsWith('data:'));
if (disallowedCssUrls.length > 0) {
  throw new Error(`Unsupported CSS url() references found: ${disallowedCssUrls.slice(0, 5).join(', ')}`);
}

const metaTags = [...htmlWithoutScripts.matchAll(/<meta\b[^>]*>/gi)].map((m) => parseTagAttributes(m[0]));
const cspMeta = metaTags.find((attrs) => (attrs.get('http-equiv') || '').toLowerCase() === 'content-security-policy');
if (!cspMeta) {
  throw new Error('CSP meta tag is missing from IPFS artifact.');
}

const cspContent = (cspMeta.get('content') || '').toLowerCase();
if (!cspContent.includes("frame-ancestors 'none'")) {
  throw new Error("CSP meta content must include frame-ancestors 'none'.");
}

const referrerMeta = metaTags.find((attrs) => (attrs.get('name') || '').toLowerCase() === 'referrer');
if (!referrerMeta) {
  throw new Error('Referrer policy meta tag is missing from IPFS artifact.');
}

const referrerContent = (referrerMeta.get('content') || '').toLowerCase();
if (referrerContent !== 'no-referrer') {
  throw new Error('Referrer policy meta content must be no-referrer.');
}

const htmlWithoutScriptBlocks = html.replace(/<script[\s\S]*?<\/script>/gi, '');
if (/<[^>]+\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i.test(htmlWithoutScriptBlocks)) {
  throw new Error('Inline event handlers detected in built HTML.');
}

console.log('IPFS artifact verified: single-file, no external local assets, security metas present.');
