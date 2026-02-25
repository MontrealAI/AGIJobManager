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
const scriptBlocks = [...html.matchAll(/<script\b[\s\S]*?<\/script>/gi)].map((m) => m[0]);
for (const block of scriptBlocks) {
  const openingTagMatch = block.match(/^<script\b[^>]*>/i);
  if (!openingTagMatch) continue;
  const tagText = openingTagMatch[0];
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
const htmlWithoutScriptsAndStyles = htmlWithoutScripts.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
const urlBearingTags = new Set(['a', 'img', 'link', 'source', 'iframe', 'audio', 'video', 'track', 'embed', 'object']);
const attributeRefs = [];

for (const match of htmlWithoutScriptsAndStyles.matchAll(/<([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/g)) {
  const tag = (match[1] || '').toLowerCase();
  if (!urlBearingTags.has(tag)) continue;
  const attrs = parseTagAttributes(match[0]);
  for (const attr of ['src', 'href', 'srcset']) {
    if (attrs.has(attr)) {
      attributeRefs.push({
        tag,
        attr,
        url: (attrs.get(attr) || '').trim()
      });
    }
  }
}

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

const styleAttributeUrls = [...htmlWithoutScripts.matchAll(/<[^>]+\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)]
  .flatMap((m) => {
    const styleValue = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    return [...styleValue.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)].map((x) => (x[2] || '').trim());
  })
  .filter(Boolean);

const disallowedStyleAttrUrls = styleAttributeUrls.filter((url) => !url.toLowerCase().startsWith('data:'));
if (disallowedStyleAttrUrls.length > 0) {
  throw new Error(`Unsupported inline style url() references found: ${disallowedStyleAttrUrls.slice(0, 5).join(', ')}`);
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


const scriptBodies = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const scriptPatterns = [
  /\bfetch\(\s*(["'`])(?:\.{1,2}\/|\/)[^"'`]*\1/gi,
  /\bimportScripts\(\s*(["'`])(?:\.{1,2}\/|\/)[^"'`]*\1/gi,
  /\bimport\(\s*(["'`])(?:\.{1,2}\/|\/)[^"'`]*\1\s*\)/gi
];

const scriptInjectionPatterns = [
  /\.src\s*=\s*(["'`])(?:\.{1,2}\/|\/)[^"'`]*\1/gi,
  /\.setAttribute\(\s*(["'])src\1\s*,\s*(["'`])(?:\.{1,2}\/|\/)[^"'`]*\2\s*\)/gi
];

const localUrlVarPattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(["'`])((?:\.{1,2}\/|\/)[^"'`]*)\2\s*;?/gi;
const variableSrcPatterns = [
  /\.src\s*=\s*([A-Za-z_$][\w$]*)/gi,
  /\.setAttribute\(\s*(["'])src\1\s*,\s*([A-Za-z_$][\w$]*)\s*\)/gi
];

const localScriptFetches = [];
for (const body of scriptBodies) {
  for (const pattern of scriptPatterns) {
    for (const match of body.matchAll(pattern)) {
      localScriptFetches.push(match[0]);
    }
  }

  if (/\b(?:document\.)?createElement\(\s*(["'])script\1\s*\)/i.test(body)) {
    for (const pattern of scriptInjectionPatterns) {
      for (const match of body.matchAll(pattern)) {
        localScriptFetches.push(match[0]);
      }
    }

    const localUrlVars = new Set([...body.matchAll(localUrlVarPattern)].map((m) => m[1]));
    if (localUrlVars.size > 0) {
      for (const pattern of variableSrcPatterns) {
        for (const match of body.matchAll(pattern)) {
          const varName = match[1] ?? match[2];
          if (varName && localUrlVars.has(varName)) {
            localScriptFetches.push(match[0]);
          }
        }
      }
    }
  }
}
if (localScriptFetches.length > 0) {
  throw new Error(`Local sidecar fetches detected in script bodies: ${localScriptFetches.slice(0, 5).join(', ')}`);
}

console.log('IPFS artifact verified: single-file, no external local assets, security metas present.');
