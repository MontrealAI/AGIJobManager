import fs from 'node:fs';
import path from 'node:path';
import * as parse5 from 'parse5';

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

function stripScriptTags(sourceHtml) {
  const document = parse5.parse(sourceHtml);

  const removeScripts = (node) => {
    if (!node || !Array.isArray(node.childNodes) || node.childNodes.length === 0) return;

    node.childNodes = node.childNodes.filter((child) => child.nodeName !== 'script');
    node.childNodes.forEach(removeScripts);
  };

  removeScripts(document);
  return parse5.serialize(document);
}


// For the IPFS single-file artifact we intentionally remove framework runtime scripts
// and keep a deterministic static document + explicit hash router bootstrap.
html = stripScriptTags(html);

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
  // Replace full forbidden data URIs (not just scheme tokens) so blocked payloads
  // cannot survive runtime string evaluation in inlined JavaScript.
  const forbiddenDataUriPattern = /data:(?:image|font)\/[a-z0-9.+-]+(?:;[a-z0-9.+-]+=[^;,)'"\s>]+)*(?:;base64)?,[^)'"\s>]*/gi;
  const sanitized = sourceHtml.replace(forbiddenDataUriPattern, 'about:blank#blocked-data-uri');

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
  const rawHash = window.location.hash || '';
  if (!rawHash.startsWith('#/')) return;
  const targetPath = rawHash.slice(1);
  window.__IPFS_BOOTSTRAP_ROUTE__ = targetPath.startsWith('/') ? targetPath : '/' + targetPath;
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
  const documentPath = window.location.pathname;
  const documentSearch = window.location.search;
  const documentUrl = documentPath + documentSearch;

  const rawPushState = history.pushState.bind(history);
  const rawReplaceState = history.replaceState.bind(history);

  const toHashRoute = (input) => {
    if (typeof input !== 'string') return null;
    if (!input.startsWith('/') || input.startsWith('//')) return null;
    return '#' + input;
  };

  const normalizeHashHref = (input) => {
    if (typeof input !== 'string' || !input) return null;
    if (input.startsWith('#/')) return input;
    if (input.startsWith('/')) return toHashRoute(input);
    if (input.startsWith('//')) return null;

    let parsed;
    try {
      parsed = new URL(input, window.location.href);
    } catch (_error) {
      return null;
    }

    if (parsed.origin !== window.location.origin) return null;

    if (parsed.hash && parsed.hash.startsWith('#/')) {
      return parsed.hash;
    }

    return toHashRoute(parsed.pathname + parsed.search);
  }; // end normalizeHashHref

  const toHashUrl = (routeInput) => {
    if (typeof routeInput !== 'string' || !routeInput.startsWith('/')) return null;
    return documentUrl + '#' + routeInput;
  };

  const dispatchRouteUpdate = (state) => {
    window.dispatchEvent(new PopStateEvent('popstate', { state }));
  };

  const navigateHashRoute = (nextRoute, options = {}) => {
    const mode = options.mode === 'replace' ? 'replace' : 'push';
    if (!nextRoute || !nextRoute.startsWith('/')) return;

    const hashUrl = toHashUrl(nextRoute);
    if (!hashUrl) return;

    if (mode === 'replace') {
      rawReplaceState(history.state, '', hashUrl);
    } else {
      rawPushState(history.state, '', hashUrl);
    }

    dispatchRouteUpdate(history.state);
  };

  const sanitizeInitialHash = () => {
    const currentHash = window.location.hash || '';
    if (!currentHash) return null;

    if (currentHash.startsWith('#/#/')) return '#/';
    if (currentHash.startsWith('##/')) return '#/';

    const value = currentHash.toLowerCase();
    const lowerPathname = window.location.pathname.toLowerCase();
    if (value.includes('agijobmanager.html') || (lowerPathname !== '/' && value.includes(lowerPathname))) {
      return '#/';
    }

    if (!currentHash.startsWith('#/')) {
      return '#/';
    }

    return currentHash;
  };

  const routeViewCopy = {
    '/': { title: 'Dashboard', description: 'Read-only-first control plane for AGIJobManager and ENS identity operations.' },
    '/jobs': { title: 'Jobs', description: 'Jobs ledger view. Use hash routes to paginate and inspect job slots.' },
    '/identity': { title: 'Identity', description: 'ENS identity layer overview with job-name derivation and permission checks.' },
    '/admin': { title: 'Admin', description: 'Owner/operator safety controls. Non-owners remain read-only.' },
    '/advanced': { title: 'Advanced', description: 'ABI-driven advanced contract console with simulation-first payloads.' },
    '/design': { title: 'Design', description: 'Sovereign Purple design gallery and deterministic review fixtures.' },
    '/deployment': { title: 'Deployment', description: 'Mainnet deployment registry sourced from committed artifacts.' },
    '/demo': { title: 'Demo', description: 'Deterministic demo scenarios for humans and autonomous agents.' }
  };

  const normalizeRouteForView = (routePath) => {
    if (!routePath || routePath === '/') return '/';
    if (routePath.startsWith('/jobs/')) return '/jobs';
    return routeViewCopy[routePath] ? routePath : '/';
  };

  const updateRoutePanel = (routePath) => {
    const normalized = normalizeRouteForView(routePath);
    const view = routeViewCopy[normalized] || routeViewCopy['/'];
    const root = document.getElementById('ipfs-route-panel') || (() => {
      const panel = document.createElement('section');
      panel.id = 'ipfs-route-panel';
      panel.style.borderTop = '1px solid rgba(169,160,180,0.25)';
      panel.style.padding = '0.85rem 1rem';
      panel.style.fontFamily = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      panel.style.background = 'rgba(30,12,45,0.2)';
      panel.style.color = 'inherit';
      document.body.append(panel);
      return panel;
    })();

    root.textContent = view.title + ' · ' + view.description;
    document.body.setAttribute('data-hash-route', normalized);

    document.querySelectorAll('nav a[href^="#/"]').forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      anchor.setAttribute('aria-current', href === '#' + normalized ? 'page' : 'false');
    });
  };

  const routeContent = {
    '/': '<h2>Dashboard</h2><p>Read-only-first supervision console for autonomous agents with human owner oversight.</p>',
    '/jobs': '<h2>Jobs</h2><p>Jobs ledger route active.</p>',
    '/identity': '<h2>Identity</h2><p>ENS identity layer route active.</p>',
    '/admin': '<h2>Admin</h2><p>Owner/operator controls route active.</p>',
    '/advanced': '<h2>Advanced</h2><p>ABI-driven advanced console route active.</p>',
    '/design': '<h2>Design</h2><p>Sovereign Purple design system route active.</p>',
    '/deployment': '<h2>Deployment</h2><p>Mainnet deployment registry route active.</p>',
    '/demo': '<h2>Demo</h2><p>Deterministic demo scenarios route active.</p>'
  };

  const updatePrimaryView = (routePath) => {
    const normalized = normalizeRouteForView(routePath);
    const main = document.querySelector('main');
    if (!main) return;
    const existing = main.querySelector('[data-ipfs-route-view="true"]');
    const host = existing || (() => {
      const wrapper = document.createElement('section');
      wrapper.setAttribute('data-ipfs-route-view', 'true');
      wrapper.style.padding = '1rem';
      wrapper.style.borderTop = '1px solid rgba(169,160,180,0.25)';
      main.append(wrapper);
      return wrapper;
    })();
    host.innerHTML = routeContent[normalized] || routeContent['/'];
  };

  window.addEventListener('hashchange', () => {
    const rawHash = sanitizeInitialHash() || '';
    if (rawHash !== (window.location.hash || '')) {
      rawReplaceState(history.state, '', documentUrl + rawHash);
    }
    if (!rawHash.startsWith('#/')) return;
    const routePath = rawHash.slice(1);
    navigateHashRoute(routePath, { mode: 'replace' });
    updateRoutePanel(routePath);
    updatePrimaryView(routePath);
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
    const routePath = hashRoute.slice(1);
    navigateHashRoute(routePath, { mode: 'push' });
    updateRoutePanel(routePath);
    updatePrimaryView(routePath);
  }, true);

  const startupHash = sanitizeInitialHash() || '';
  if (startupHash && startupHash !== (window.location.hash || '')) {
    rawReplaceState(history.state, '', documentUrl + startupHash);
  }
  if (startupHash.startsWith('#/')) {
    const routePath = startupHash.slice(1);
    navigateHashRoute(routePath, { mode: 'replace' });
    updateRoutePanel(routePath);
    updatePrimaryView(routePath);
  } else {
    updateRoutePanel('/');
    updatePrimaryView('/');
  }
})();</script>`);



function assertNoDuplicateNextFlightBootstrap(singleFileHtml) {
  const markers = [
    '(self.__next_f=self.__next_f||[]).push([0]);self.__next_f.push([2,null])',
    'self.__next_f.push([1,"0:[\"$\",\"$L3\"',
    'self.__next_f.push([1,"b:[['
  ];

  for (const marker of markers) {
    const first = singleFileHtml.indexOf(marker);
    if (first < 0) continue;
    const second = singleFileHtml.indexOf(marker, first + marker.length);
    if (second >= 0) {
      throw new Error(`Generated artifact contains duplicate Next flight/bootstrap marker: ${marker.slice(0, 40)}...`);
    }
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
  const hasClosedBootstrap = /navigateHashRoute\(routePath, \{ mode: 'push' \}\);[\s\S]*?\}\)\(\);<\/script>/.test(singleFileHtml);
  if (!hasClosedBootstrap) {
    throw new Error('Hash routing bootstrap script appears unclosed or malformed in single-file artifact.');
  }
}


function extractNavigateHashRouteBounds(scriptBody) {
  const declarationPattern = /(?:const|let|var)\s+navigateHashRoute\s*=\s*\(nextRoute\s*,\s*options\s*=\s*\{\}\)\s*=>\s*\{/;
  const match = declarationPattern.exec(scriptBody);
  if (!match) return null;

  const braceStart = scriptBody.indexOf('{', match.index);
  if (braceStart < 0) return null;

  let depth = 0;
  for (let i = braceStart; i < scriptBody.length; i += 1) {
    const ch = scriptBody[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { start: match.index, end: i + 1 };
      }
    }
  }

  return null;
}


function hasOrphanHashUrlGuard(source) {
  const guardPattern = /if\s*\(\s*!hashUrl\s*\)\s*return\s*;/g;
  for (const match of source.matchAll(guardPattern)) {
    const idx = match.index ?? -1;
    if (idx < 0) continue;
    const contextStart = Math.max(0, idx - 160);
    const context = source.slice(contextStart, idx);
    if (!/(?:const|let|var)\s+hashUrl\s*=/.test(context)) {
      return true;
    }
  }
  return false;
}

function assertRouterBootstrapCoherence(singleFileHtml) {
  const scriptBodies = [...singleFileHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  const routerScript = scriptBodies.find((body) => (
    body.includes('const normalizeHashHref = (input) => {')
    && body.includes('const navigateHashRoute = (nextRoute, options = {}) => {')
    && body.includes("window.addEventListener('hashchange'")
  ));

  if (!routerScript) {
    throw new Error('Router bootstrap script with normalizeHashHref/navigateHashRoute/hashchange was not found in single-file artifact.');
  }

  if (!routerScript.includes('const hashRoute = normalizeHashHref(href);')) {
    throw new Error('Router bootstrap click interception no longer uses normalizeHashHref(href) in single-file artifact.');
  }

  if (routerScript.includes('</script><script>') || routerScript.includes('<script>')) {
    throw new Error('Router bootstrap script appears interleaved with script tag boundaries in single-file artifact.');
  }

  if (routerScript.includes('<div data-rk')) {
    throw new Error('Router bootstrap script contains leaked DOM markup (<div data-rk>) and is malformed.');
  }

  if (!/\}\)\(\);\s*$/.test(routerScript.trimEnd())) {
    throw new Error('Router bootstrap script must terminate as a closed IIFE (})();).');
  }

  try {
    // Guard against malformed interleaving that can leave duplicate declarations
    // (e.g., "Identifier 'routePath' has already been declared") in emitted HTML.
    new Function(routerScript);
  } catch (error) {
    throw new Error(`Router bootstrap script is not parseable JavaScript: ${error instanceof Error ? error.message : String(error)}`);
  }

  const navigateBounds = extractNavigateHashRouteBounds(routerScript);
  if (!navigateBounds) {
    throw new Error('Router bootstrap script has no parseable navigateHashRoute wrapper in single-file artifact.');
  }

  const outsideNavigate = routerScript.slice(0, navigateBounds.start) + routerScript.slice(navigateBounds.end);
  if (hasOrphanHashUrlGuard(outsideNavigate)) {
    throw new Error('Router bootstrap leaked orphan `if (!hashUrl) return;` outside navigateHashRoute wrapper.');
  }
}

function assertParseableNavigateHashRoute(singleFileHtml) {
  const hasHashListener = /\b(?:window\.)?addEventListener\(\s*['"`]hashchange['"`]/.test(singleFileHtml);
  if (!hasHashListener) {
    throw new Error('IPFS artifact lost hashchange listener required for hash routing.');
  }

  const declaration = 'const navigateHashRoute = (nextRoute, options = {}) => {';
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


function assertNormalizeHashHrefParsedBinding(singleFileHtml) {
  const declaration = 'const normalizeHashHref = (input) => {';
  const start = singleFileHtml.indexOf(declaration);
  if (start < 0) {
    throw new Error('Unable to locate normalizeHashHref declaration in generated single-file artifact.');
  }

  const openBrace = singleFileHtml.indexOf('{', start);
  if (openBrace < 0) {
    throw new Error('normalizeHashHref declaration is missing an opening brace.');
  }

  let depth = 0;
  let closeBrace = -1;
  for (let i = openBrace; i < singleFileHtml.length; i += 1) {
    const ch = singleFileHtml[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        closeBrace = i;
        break;
      }
    }
  }

  if (closeBrace < 0) {
    throw new Error('Unable to parse normalizeHashHref body in generated single-file artifact.');
  }

  const helperBody = singleFileHtml.slice(openBrace + 1, closeBrace);
  if (!/\blet\s+parsed\s*;/.test(helperBody)) {
    throw new Error('normalizeHashHref must declare `let parsed;` in generated single-file artifact.');
  }

  if (/\bconst\s+parsed\s*=\s*parseRouteInput\(routeInput\)\s*;/.test(helperBody)) {
    throw new Error('normalizeHashHref contains a conflicting `const parsed` declaration and will fail to parse.');
  }

  if (/\bconst\s+parsed\s*=\s*parseRouteInput\(routeInput\)\s*;/.test(singleFileHtml)) {
    throw new Error('Router bootstrap must avoid reusing `parsed` for parseRouteInput(routeInput) to prevent parser ambiguity/regressions.');
  }

  if (/\bconst\s+parsedGatewayRoute\s*=\s*parseRouteInput\(routeInput\)\s*;/.test(helperBody)) {
    throw new Error('normalizeHashHref must not include parseRouteInput(routeInput) gateway helper bindings.');
  }

  if (/\bconst\s+basePath\s*=/.test(helperBody)) {
    throw new Error('normalizeHashHref must not include basePath declarations from toGatewayUrl.');
  }

  const routerScriptStart = singleFileHtml.indexOf(declaration);
  const routerScriptEnd = singleFileHtml.indexOf('</script>', routerScriptStart);
  const routerWindow = routerScriptEnd > routerScriptStart
    ? singleFileHtml.slice(routerScriptStart, routerScriptEnd)
    : singleFileHtml.slice(routerScriptStart);

  if (/\bconst\s+basePath\s*=/.test(routerWindow)) {
    throw new Error('Router bootstrap must not declare basePath; use a unique helper-local pathname binding to avoid parse-collision regressions.');
  }

}

function assertNoNavigateInvocationWithoutDeclaration(singleFileHtml) {
  const scriptBodies = [...singleFileHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  for (const body of scriptBodies) {
    const invokesNavigate = /\bnavigateHashRoute\s*\(/.test(body);
    if (!invokesNavigate) continue;

    const hasDeclaration = /\b(?:const|let|var)\s+navigateHashRoute\s*=\s*\([^)]*\)\s*=>\s*\{|\bfunction\s+navigateHashRoute\s*\(/.test(body);
    if (!hasDeclaration) {
      throw new Error('Router bootstrap invokes navigateHashRoute but no navigateHashRoute declaration exists in the same script body.');
    }
  }
}

html = sanitizeForbiddenDataUris(html);
assertNoDuplicateNextFlightBootstrap(html);
assertNoPrematureDocumentClose(html);
assertHashRoutingBootstrapClosed(html);
assertParseableNavigateHashRoute(html);
assertRouterBootstrapCoherence(html);
assertNormalizeHashHrefParsedBinding(html);
assertNoNavigateInvocationWithoutDeclaration(html);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html);

const skipRootSync = process.env.BUILD_IPFS_SKIP_ROOT_SYNC === '1';
if (!skipRootSync) {
  fs.writeFileSync(repoArtifactPath, html);
}

console.log(`Built single-file IPFS artifact: ${path.relative(uiRoot, outPath)}`);
if (skipRootSync) {
  console.log('Skipped repository artifact synchronization (BUILD_IPFS_SKIP_ROOT_SYNC=1).');
} else {
  console.log(`Synchronized repository artifact: ${path.relative(repoRoot, repoArtifactPath)}`);
}
