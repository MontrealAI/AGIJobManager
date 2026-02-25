import fs from 'node:fs';
import path from 'node:path';

const uiRoot = process.cwd();
const sourcePath = path.join(uiRoot, '.next/server/app/index.html');
const outDir = path.join(uiRoot, 'dist-ipfs');
const outPath = path.join(outDir, 'agijobmanager.html');

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
  const safeScriptBody = scriptBody.replace(/<\/script/gi, '<\\/script');
  return `<script>\n${safeScriptBody}\n</script>`;
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
  const detectGatewayBase = (pathname) => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] === 'ipfs' && segments[1]) return '/ipfs/' + segments[1];
    if (segments[0] === 'ipns' && segments[1]) return '/ipns/' + segments[1];
    return pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  };

  const rawHash = window.location.hash || '';
  if (!rawHash.startsWith('#/')) return;

  const targetPath = rawHash.slice(1);
  const normalized = targetPath.startsWith('/') ? targetPath : '/' + targetPath;
  const gatewayBase = detectGatewayBase(window.location.pathname);
  const bootstrapPath = gatewayBase === '/' ? normalized : (gatewayBase + normalized);
  const bootstrapUrl = bootstrapPath + window.location.search;

  history.replaceState(history.state, '', bootstrapUrl);
  window.__IPFS_BOOTSTRAP_ROUTE__ = normalized;

  window.addEventListener('DOMContentLoaded', () => {
    const current = window.location.pathname + window.location.search;
    if (current === bootstrapUrl) {
      const hashUrl = gatewayBase + '#' + normalized;
      history.replaceState(history.state, '', hashUrl);
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
  const detectGatewayBase = (pathname) => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] === 'ipfs' && segments[1]) return '/ipfs/' + segments[1];
    if (segments[0] === 'ipns' && segments[1]) return '/ipns/' + segments[1];
    return '/';
  };

  const gatewayBase = detectGatewayBase(window.location.pathname);
  const rawPushState = history.pushState.bind(history);
  const rawReplaceState = history.replaceState.bind(history);

  const stripGatewayBase = (pathname) => {
    if (gatewayBase !== '/') {
      if (pathname === gatewayBase) return '/';
      if (pathname.startsWith(gatewayBase + '/')) {
        return pathname.slice(gatewayBase.length);
      }
    }
    return pathname;
  };

  const toHashRoute = (input) => {
    if (typeof input !== 'string') return null;
    if (!input.startsWith('/') || input.startsWith('//')) return null;
    return '#' + input;
  };

  const parseRouteInput = (routeInput) => {
    if (typeof routeInput !== 'string' || !routeInput.startsWith('/')) return null;
    const hashIndex = routeInput.indexOf('#');
    const withoutHash = hashIndex >= 0 ? routeInput.slice(0, hashIndex) : routeInput;
    const queryIndex = withoutHash.indexOf('?');
    const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
    const search = queryIndex >= 0 ? withoutHash.slice(queryIndex) : '';
    return { pathname, search, routeInput: withoutHash };
  };

  const toGatewayUrl = (routeInput) => {
    const parsed = parseRouteInput(routeInput);
    if (!parsed) return null;
    const basePath = gatewayBase === '/' ? parsed.pathname : gatewayBase + parsed.pathname;
    return basePath + parsed.search;
  };

  const toHashUrl = (routeInput) => {
    const parsed = parseRouteInput(routeInput);
    if (!parsed) return null;
    return gatewayBase + '#' + parsed.routeInput;
  };

  let suppressRewrite = false;
  const rewriteHistory = (method) => {
    const original = history[method];
    history[method] = function(state, title, url) {
      if (!suppressRewrite && typeof url === 'string') {
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

  const dispatchRouteUpdate = (state) => {
    window.dispatchEvent(new PopStateEvent('popstate', { state }));
  };

  const navigateHashRoute = (routePath, mode) => {
    if (!routePath || !routePath.startsWith('/')) return;

    const pathUrl = toGatewayUrl(routePath);
    const hashUrl = toHashUrl(routePath);
    if (!pathUrl || !hashUrl) return;
    suppressRewrite = true;
    if (mode === 'replace') {
      rawReplaceState(history.state, '', pathUrl);
    } else {
      rawPushState(history.state, '', pathUrl);
    }
    suppressRewrite = false;

    dispatchRouteUpdate(history.state);

    suppressRewrite = true;
    rawReplaceState(history.state, '', hashUrl);
    suppressRewrite = false;
  };

  if (!window.location.hash && !window.location.pathname.startsWith('/_next')) {
    const routePath = stripGatewayBase(window.location.pathname);
    if (routePath !== '/' && routePath !== '') {
      const hashUrl = toHashUrl(routePath);
      if (!hashUrl) return;
      suppressRewrite = true;
      rawReplaceState(history.state, '', hashUrl);
      suppressRewrite = false;
    }
  }

  window.addEventListener('hashchange', () => {
    const rawHash = window.location.hash || '';
    if (!rawHash.startsWith('#/')) return;
    const routePath = rawHash.slice(1);
    navigateHashRoute(routePath, 'replace');
  });

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!target) return;
    if (target.hasAttribute('download')) return;

    const targetAttr = (target.getAttribute('target') || '').toLowerCase();
    if (targetAttr && targetAttr !== '_self') return;

    const href = target.getAttribute('href') || '';
    const hashRoute = toHashRoute(href);
    if (!hashRoute) return;

    event.preventDefault();
    navigateHashRoute(hashRoute.slice(1), 'push');
  }, true);
})();</script>`);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html);

console.log(`Built single-file IPFS artifact: ${path.relative(uiRoot, outPath)}`);
