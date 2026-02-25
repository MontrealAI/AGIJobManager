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
  const hasValuelessSrc = /\ssrc\b(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]*)?)?(?=\s|>|\/)/i.test(tagText);

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
    value: (m[3] ?? m[4] ?? m[5] ?? '').trim()
  }));

const isAllowedNavigationUrl = (url) => {
  const lower = url.toLowerCase();
  return (
    lower.startsWith('#') ||
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('ipfs://') ||
    lower.startsWith('ens://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:')
  );
};

const isAllowedAssetUrl = (url) => url.toLowerCase().startsWith('data:');

const extractSrcsetUrls = (srcsetValue) =>
  srcsetValue
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((candidate) => candidate.split(/\s+/)[0])
    .filter(Boolean);

const disallowedRefs = [];
for (const entry of attributeRefs) {
  if (entry.attr === 'srcset') {
    const urls = extractSrcsetUrls(entry.value);
    for (const url of urls) {
      if (!isAllowedAssetUrl(url)) {
        disallowedRefs.push(`${entry.tag}[srcset]=${url}`);
      }
    }
    continue;
  }

  if (entry.tag === 'a' && entry.attr === 'href') {
    if (!isAllowedNavigationUrl(entry.value)) {
      disallowedRefs.push(`${entry.tag}[${entry.attr}]=${entry.value}`);
    }
    continue;
  }

  if (!isAllowedAssetUrl(entry.value)) {
    disallowedRefs.push(`${entry.tag}[${entry.attr}]=${entry.value}`);
  }
}

if (disallowedRefs.length > 0) {
  throw new Error(`Relative or unsupported asset references found: ${disallowedRefs.slice(0, 5).join(', ')}`);
}

const metaTags = [...htmlWithoutScripts.matchAll(/<meta\b[^>]*>/gi)].map((m) => parseTagAttributes(m[0]));
const cspMeta = metaTags.find((attrs) => (attrs.get('http-equiv') || '').toLowerCase() === 'content-security-policy');
if (!cspMeta) {
  throw new Error('CSP meta tag is missing from IPFS artifact.');
}

const cspContent = (cspMeta.get('content') || '').toLowerCase();
const cspDirectives = Object.fromEntries(
  cspContent
    .split(';')
    .map((directive) => directive.trim())
    .filter(Boolean)
    .map((directive) => {
      const [name, ...rest] = directive.split(/\s+/);
      return [name, rest.join(' ')];
    })
);

if (!cspDirectives['frame-ancestors'] || !cspDirectives['frame-ancestors'].includes("'none'")) {
  throw new Error('CSP meta tag must include frame-ancestors \'none\'.');
}

if (!cspDirectives['default-src'] || !cspDirectives['default-src'].includes("'self'") || /\*/.test(cspDirectives['default-src'])) {
  throw new Error('CSP meta tag must include restrictive default-src (self, no wildcard).');
}

const referrerMeta = metaTags.find((attrs) => (attrs.get('name') || '').toLowerCase() === 'referrer');
if (!referrerMeta) {
  throw new Error('Referrer policy meta tag is missing from IPFS artifact.');
}

if ((referrerMeta.get('content') || '').toLowerCase() !== 'no-referrer') {
  throw new Error('Referrer policy meta tag must set content=no-referrer.');
}

const htmlWithoutScriptBlocks = html.replace(/<script[\s\S]*?<\/script>/gi, '');
if (/<[^>]+\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i.test(htmlWithoutScriptBlocks)) {
  throw new Error('Inline event handlers detected in built HTML.');
}

console.log('IPFS artifact verified: single-file, no external local assets, security metas present.');
