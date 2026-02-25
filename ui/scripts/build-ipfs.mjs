import fs from 'node:fs';
import path from 'node:path';

const uiRoot = process.cwd();
const sourcePath = path.join(uiRoot, '.next/server/app/index.html');
const outDir = path.join(uiRoot, 'dist-ipfs');
const outPath = path.join(outDir, 'index.html');

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Next build output not found at ${sourcePath}. Run npm run build first.`);
}

let html = fs.readFileSync(sourcePath, 'utf8');

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

function resolveLocalAsset(assetPath) {
  const clean = assetPath.split('?')[0];
  if (clean.startsWith('/_next/')) {
    return path.join(uiRoot, '.next', clean.slice('/_next/'.length));
  }
  if (clean === '/icon.svg') {
    return path.join(uiRoot, 'src/app/icon.svg');
  }
  if (clean.startsWith('/')) {
    return path.join(uiRoot, 'public', clean.slice(1));
  }
  if (clean.startsWith('./')) {
    return path.join(uiRoot, clean);
  }
  return null;
}

html = html.replace(/<script\b[^>]*\ssrc=(?:"([^"]+)"|'([^']+)')\s*[^>]*><\/script>/gi, (fullTag, srcA, srcB) => {
  const src = srcA ?? srcB ?? '';
  const localPath = resolveLocalAsset(src);
  if (!localPath || !fs.existsSync(localPath)) {
    throw new Error(`Referenced script not found: ${src}`);
  }
  const scriptBody = fs.readFileSync(localPath, 'utf8');
  return `<script>\n${scriptBody}\n</script>`;
});

for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
  const fullTag = match[0];
  const attrs = parseTagAttributes(fullTag);
  const rel = (attrs.get('rel') || '').toLowerCase();
  const href = attrs.get('href') || '';

  if (rel.split(/\s+/).includes('stylesheet')) {
    const localPath = resolveLocalAsset(href);
    if (!localPath || !fs.existsSync(localPath)) {
      throw new Error(`Referenced stylesheet not found: ${href}`);
    }
    const css = fs.readFileSync(localPath, 'utf8');
    html = html.replace(fullTag, `<style>\n${css}\n</style>`);
    continue;
  }

  if (rel === 'preload' || rel === 'modulepreload') {
    html = html.replace(fullTag, '');
    continue;
  }

  if (rel === 'icon' && href.startsWith('/')) {
    const localPath = resolveLocalAsset(href);
    if (!localPath || !fs.existsSync(localPath)) {
      throw new Error(`Referenced icon not found: ${href}`);
    }
    const svg = fs.readFileSync(localPath, 'utf8');
    const encoded = encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');
    html = html.replace(fullTag, `<link rel="icon" href="data:image/svg+xml,${encoded}" type="image/svg+xml" sizes="any"/>`);
  }
}

const insertBeforeHeadClose = (snippet) => {
  html = html.replace('</head>', `${snippet}\n</head>`);
};

const insertBeforeBodyClose = (snippet) => {
  html = html.replace('</body>', `${snippet}\n</body>`);
};

html = html.replace(/<a\b([^>]*?)\shref=(?:"([^"]+)"|'([^']+)')([^>]*)>/gi, (full, before, h1, h2, after) => {
  const href = h1 ?? h2 ?? '';
  if (!href.startsWith('/') || href.startsWith('//')) return full;
  const hashHref = `#${href}`;
  return `<a${before} href="${hashHref}"${after}>`;
});

insertBeforeHeadClose(`<script>(function(){
  const rawHash = window.location.hash || '';
  if (!rawHash.startsWith('#/')) return;

  const targetPath = rawHash.slice(1);
  const normalized = targetPath.startsWith('/') ? targetPath : '/' + targetPath;
  history.replaceState(history.state, '', normalized);
  window.__IPFS_BOOTSTRAP_ROUTE__ = normalized;

  window.addEventListener('DOMContentLoaded', () => {
    const current = window.location.pathname + window.location.search;
    if (current === normalized) {
      history.replaceState(history.state, '', '#' + normalized);
    }
  }, { once: true });
})();</script>`);

if (!/http-equiv=["']Content-Security-Policy["']/i.test(html)) {
  insertBeforeHeadClose('  <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https:; connect-src \'self\' https:; frame-ancestors \'none\'; base-uri \'none\'; form-action \'self\'">');
}

if (!/name=["']referrer["']/i.test(html)) {
  insertBeforeHeadClose('  <meta name="referrer" content="no-referrer">');
}

insertBeforeBodyClose(`<script>(function(){
  const toHashRoute = (input) => {
    if (typeof input !== 'string') return null;
    if (!input.startsWith('/') || input.startsWith('//')) return null;
    return "#" + input;
  };

  const rewriteHistory = (method) => {
    const original = history[method];
    history[method] = function(state, title, url) {
      if (typeof url === 'string') {
        const hashRoute = toHashRoute(url);
        if (hashRoute) {
          return original.call(this, state, title, hashRoute);
        }
      }
      return original.call(this, state, title, url);
    };
  };

  rewriteHistory('pushState');
  rewriteHistory('replaceState');

  if (!window.location.hash && window.location.pathname !== '/' && !window.location.pathname.startsWith('/_next')) {
    history.replaceState(history.state, '', '#' + window.location.pathname + window.location.search);
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!target) return;
    const href = target.getAttribute('href') || '';
    const hashRoute = toHashRoute(href);
    if (!hashRoute) return;
    event.preventDefault();
    history.pushState({}, '', hashRoute);
  }, true);
})();</script>`);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html);

console.log(`Built single-file IPFS artifact: ${path.relative(uiRoot, outPath)}`);
