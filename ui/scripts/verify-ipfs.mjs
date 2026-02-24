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

const extractAttributes = (tagMarkup) => {
  const attrs = {};
  const attrPattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;
  let match;
  while ((match = attrPattern.exec(tagMarkup)) !== null) {
    const name = match[1].toLowerCase();
    if (name === 'script' || name === 'link') continue;
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[name] = value;
  }
  return attrs;
};

const scriptRefs = [...html.matchAll(/<script\b[^>]*>/gi)]
  .map((m) => extractAttributes(m[0]).src)
  .filter(Boolean);
if (scriptRefs.length > 0) {
  throw new Error(`External script references found: ${scriptRefs.join(', ')}`);
}

const stylesheetLinks = [...html.matchAll(/<link\b[^>]*>/gi)]
  .map((m) => extractAttributes(m[0]))
  .filter((attrs) => (attrs.rel || '').toLowerCase().split(/\s+/).includes('stylesheet'))
  .map((attrs) => attrs.href)
  .filter(Boolean);
if (stylesheetLinks.length > 0) {
  throw new Error(`External stylesheet references found: ${stylesheetLinks.join(', ')}`);
}

const htmlWithoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
const attributeRefs = [...htmlWithoutScripts.matchAll(/<(?:a|img|script|link|source|iframe|audio|video|track|embed|object)\b[^>]*>/gi)]
  .map((m) => extractAttributes(m[0]))
  .flatMap((attrs) => [attrs.src, attrs.href])
  .filter(Boolean);

const isAllowedUrl = (url) => {
  const lower = url.toLowerCase();
  return lower.startsWith('#')
    || lower.startsWith('data:')
    || lower.startsWith('http://')
    || lower.startsWith('https://')
    || lower.startsWith('ipfs://')
    || lower.startsWith('ens://')
    || lower.startsWith('mailto:')
    || lower.startsWith('tel:');
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

if (/\son[a-z]+\s*=\s*["'][^"']*["']/i.test(html)) {
  throw new Error('Inline event handlers detected in built HTML.');
}

console.log('IPFS artifact verified: single-file, no external local assets, security metas present.');
