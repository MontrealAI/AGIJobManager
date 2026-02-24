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
const refMatches = [...htmlWithoutScripts.matchAll(/<(a|img|script|link|source|iframe|audio|video|track|embed|object)\b[^>]*(src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))[^>]*>/gi)]
  .map((m) => ({ tag: m[1].toLowerCase(), attr: m[2].toLowerCase(), url: (m[3] ?? m[4] ?? m[5] ?? '').trim() }));

const isAllowedReference = ({ tag, attr, url }) => {
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

  return lower.startsWith('data:');
};

const disallowedRefs = refMatches.filter((ref) => !isAllowedReference(ref));
if (disallowedRefs.length > 0) {
  const preview = disallowedRefs.slice(0, 5).map((ref) => `${ref.tag}[${ref.attr}]=${ref.url || '(empty)'}`);
  throw new Error(`Relative, external, or unsupported asset references found: ${preview.join(', ')}`);
}

const metaTags = [...htmlWithoutScripts.matchAll(/<meta\b[^>]*>/gi)].map((m) => parseTagAttributes(m[0]));
const hasCspMeta = metaTags.some((attrs) => (attrs.get('http-equiv') || '').toLowerCase() === 'content-security-policy');
if (!hasCspMeta) {
  throw new Error('CSP meta tag is missing from IPFS artifact.');
}

const hasReferrerMeta = metaTags.some((attrs) => (attrs.get('name') || '').toLowerCase() === 'referrer');
if (!hasReferrerMeta) {
  throw new Error('Referrer policy meta tag is missing from IPFS artifact.');
}

const htmlWithoutScriptBlocks = html.replace(/<script[\s\S]*?<\/script>/gi, '');
if (/<[^>]+\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i.test(htmlWithoutScriptBlocks)) {
  throw new Error('Inline event handlers detected in built HTML.');
}

console.log('IPFS artifact verified: single-file, no external local assets, security metas present.');
