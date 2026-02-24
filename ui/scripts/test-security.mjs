import fs from 'node:fs';
import path from 'node:path';

const indexPath = path.join(process.cwd(), 'dist-ipfs', 'index.html');
if (!fs.existsSync(indexPath)) {
  throw new Error('Missing ui/dist-ipfs/index.html. Run npm run build:ipfs first.');
}

const html = fs.readFileSync(indexPath, 'utf8');
const htmlWithoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');

const cspMeta = html.match(/<meta[^>]+http-equiv=(['"])Content-Security-Policy\1[^>]+content=(['"])(.*?)\2/si);
if (!cspMeta) {
  throw new Error('Missing CSP meta tag.');
}
const csp = cspMeta[3];
if (!/frame-ancestors\s+'none'/.test(csp)) {
  throw new Error("CSP must include frame-ancestors 'none'.");
}

if (!/<meta[^>]+name=(['"])referrer\1[^>]+content=(['"])no-referrer\2/i.test(html)) {
  throw new Error('Missing strict referrer policy meta tag: no-referrer');
}

const inlineHandlers = htmlWithoutScripts.match(/\son[a-z]+\s*=/gi) ?? [];
if (inlineHandlers.length > 0) {
  throw new Error(`Inline event handlers are forbidden: found ${inlineHandlers.length}`);
}

const externalLinks = [...htmlWithoutScripts.matchAll(/<(?:script|link|img|source|audio|video)[^>]+(?:src|href)=(['"])(.*?)\1/gi)]
  .map((m) => m[2])
  .filter((url) => !url.startsWith('data:') && !url.startsWith('https://') && !url.startsWith('http://') && !url.startsWith('ipfs://') && !url.startsWith('ens://') && !url.startsWith('#'));
if (externalLinks.length > 0) {
  throw new Error(`Unexpected non-allowlisted asset references: ${externalLinks.join(', ')}`);
}

console.log('Security policy checks passed for dist-ipfs/index.html');
