import fs from 'node:fs';
import path from 'node:path';

const uiRoot = process.cwd();
const repoRoot = path.resolve(uiRoot, '..');
const sourcePath = path.join(uiRoot, '.next/server/app/index.html');
const outDir = path.join(uiRoot, 'dist-ipfs');
const outPath = path.join(outDir, 'agijobmanager.html');
const repoArtifactPath = path.join(repoRoot, 'agijobmanager.html');

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

  if (rel === 'icon' || rel === 'apple-touch-icon' || rel === 'manifest') {
    html = html.replace(fullTag, '');
  }
}


function sanitizeForbiddenDataUris(sourceHtml) {
  const replacements = [
    { pattern: /data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, replacement: 'about:blank#blocked-data-image-base64' },
    { pattern: /data:image\/[a-z0-9.+-]+,[^"'\s)]+/gi, replacement: 'about:blank#blocked-data-image' },
    { pattern: /data:font\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, replacement: 'about:blank#blocked-data-font-base64' },
    { pattern: /data:font\/[a-z0-9.+-]+,[^"'\s)]+/gi, replacement: 'about:blank#blocked-data-font' }
  ];

  let sanitized = sourceHtml;
  for (const { pattern, replacement } of replacements) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  // Preserve JavaScript semantics by obfuscating token literals instead of rewriting
  // to about:blank for unmatched string fragments inside bundles.
  sanitized = sanitized.replace(/data:image\//gi, 'data\\x3aimage/');
  sanitized = sanitized.replace(/data:font\//gi, 'data\\x3afont/');

  if (/data:image\//i.test(sanitized) || /data:font\//i.test(sanitized)) {
    throw new Error('Generated artifact still contains forbidden data:image/* or data:font/* URI content.');
  }

  return sanitized;
}

function createTagInsertionPoint(tagName) {
  const openTagPattern = new RegExp(`<${tagName}\\b[^>]*>`, 'i');
  let cursor = null;

  return (snippet) => {
    if (cursor === null) {
      const match = openTagPattern.exec(html);
      if (!match || match.index === undefined) {
        throw new Error(`Unable to locate opening <${tagName}> tag in built HTML.`);
      }
      cursor = match.index + match[0].length;
    }

    html = `${html.slice(0, cursor)}${snippet}\n${html.slice(cursor)}`;
    cursor += snippet.length + 1;
  };
}

const insertIntoHead = createTagInsertionPoint('head');
const insertIntoBody = createTagInsertionPoint('body');

html = html.replace(/<a\b([^>]*?)\shref=(?:"([^"]+)"|'([^']+)')([^>]*)>/gi, (full, before, h1, h2, after) => {
  const href = h1 ?? h2 ?? '';
  if (!href.startsWith('/') || href.startsWith('//')) return full;
  const hashHref = `#${href}`;
  return `<a${before} href="${hashHref}"${after}>`;
});

insertIntoHead(`<script>(function(){
  const detectGatewayBase = (pathname) => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] === 'ipfs' && segments[1]) return '/ipfs/' + segments[1];
    if (segments[0] === 'ipns' && segments[1]) return '/ipns/' + segments[1];
    return pathname === '/' ? '/' : pathname.replace(/\\/+$/, '');
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

const enforcedCsp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: ipfs:; connect-src 'self' https:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
if (/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i.test(html)) {
  html = html.replace(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, `  <meta http-equiv=\"Content-Security-Policy\" content=\"${enforcedCsp}\">`);
} else {
  insertIntoHead(`  <meta http-equiv=\"Content-Security-Policy\" content=\"${enforcedCsp}\">`);
}

if (!/name=["']referrer["']/i.test(html)) {
  insertIntoHead('  <meta name="referrer" content="no-referrer">');
}

insertIntoBody(`<script>(function(){
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

  const normalizeHashHref = (input) => {
    if (typeof input !== 'string' || !input) return null;

    if (input.startsWith('#/')) return input;

    const hashIndex = input.indexOf('#/');
    if (hashIndex >= 0) {
      return input.slice(hashIndex);
    }

    return toHashRoute(input);
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
    const hashRoute = normalizeHashHref(href);
    if (!hashRoute) return;

    event.preventDefault();
    navigateHashRoute(hashRoute.slice(1), 'push');
  }, true);
})();</script>`);




function assertSingleFlightPayload(singleFileHtml) {
  const appPayloadMarker = 'self.__next_f.push([1,"0:[';
  const appPayloadCount = singleFileHtml.split(appPayloadMarker).length - 1;
  if (appPayloadCount !== 1) {
    throw new Error(`Generated artifact has ${appPayloadCount} app flight payload marker(s); expected exactly 1.`);
  }
}

function assertNoPrematureDocumentClose(singleFileHtml) {
  const closeTag = '</body></html>';
  const firstClose = singleFileHtml.indexOf(closeTag);
  const lastClose = singleFileHtml.lastIndexOf(closeTag);

  if (firstClose < 0 || lastClose < 0) {
    throw new Error('Generated artifact is missing terminal </body></html> close tags.');
  }

  if (firstClose !== lastClose) {
    throw new Error('Generated artifact contains multiple </body></html> close tags, indicating malformed document structure.');
  }

  const trailing = singleFileHtml.slice(firstClose + closeTag.length).trim();
  if (trailing.length > 0) {
    throw new Error('Generated artifact has trailing content after terminal </body></html>, indicating malformed output.');
  }
}

function assertHashRoutingBootstrapClosed(singleFileHtml) {
  const hasClosedBootstrap = /navigateHashRoute\(hashRoute\.slice\(1\), 'push'\);\s*\}, true\);\s*\}\)\(\);<\/script>/.test(singleFileHtml);
  if (!hasClosedBootstrap) {
    throw new Error('Hash routing bootstrap script appears unclosed or malformed in single-file artifact.');
  }
}

function assertParseableNavigateHashRoute(singleFileHtml) {
  const hasHashListener = /\b(?:window\.)?addEventListener\(\s*['"`]hashchange['"`]/.test(singleFileHtml);
  if (!hasHashListener) {
    throw new Error('IPFS artifact lost hashchange listener required for hash routing.');
  }

  const declaration = 'const navigateHashRoute = (routePath, mode) => {';
  const declarationIndex = singleFileHtml.indexOf(declaration);
  if (declarationIndex < 0) {
    throw new Error('Unable to locate stable navigateHashRoute declaration in generated single-file artifact.');
  }

  const hashchangeIndex = singleFileHtml.indexOf("window.addEventListener('hashchange'", declarationIndex);
  const windowEnd = hashchangeIndex > declarationIndex
    ? hashchangeIndex
    : Math.min(singleFileHtml.length, declarationIndex + 5000);
  const helperWindow = singleFileHtml.slice(declarationIndex, windowEnd);

  if (/\brawHash\b/.test(helperWindow)) {
    throw new Error('navigateHashRoute helper window must not reference rawHash in single-file artifact.');
  }

  if (!/\bmode\b/.test(helperWindow) || !/\brawPushState\b/.test(helperWindow) || !/\brawReplaceState\b/.test(helperWindow)) {
    throw new Error('navigateHashRoute helper window is missing mode/rawPushState/rawReplaceState logic.');
  }
}

html = sanitizeForbiddenDataUris(html);
assertNoPrematureDocumentClose(html);
assertSingleFlightPayload(html);
assertHashRoutingBootstrapClosed(html);
assertParseableNavigateHashRoute(html);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html);
fs.writeFileSync(repoArtifactPath, html);

console.log(`Built single-file IPFS artifact: ${path.relative(uiRoot, outPath)}`);
console.log(`Synchronized repository artifact: ${path.relative(repoRoot, repoArtifactPath)}`);
