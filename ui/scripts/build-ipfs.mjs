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

function inlineExternalScripts(sourceHtml) {
  return sourceHtml.replace(/<script\b([^>]*)><\/script>/gi, (fullTag, rawAttrs) => {
    const attrs = parseTagAttributes(rawAttrs || '');
    const src = attrs.get('src');
    if (!src) return fullTag;

    const localPath = resolveLocalAsset(src);
    if (!localPath || !fs.existsSync(localPath)) {
      throw new Error(`Referenced script not found: ${src}`);
    }

    const js = fs.readFileSync(localPath, 'utf8')
      .replace(/<\/script/gi, '<\\/script')
      .replace(/<!--/g, '<\\!--');
    const attrsWithoutSrc = (rawAttrs || '')
      .replace(/\s+src\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    const openingTag = attrsWithoutSrc.length > 0 ? `<script ${attrsWithoutSrc}>` : '<script>';
    return `${openingTag}\n${js}\n</script>`;
  });
}

html = inlineExternalScripts(html);

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


const appShellStart = html.indexOf('<div data-rk="">');
const appShellEnd = appShellStart >= 0 ? html.indexOf('<script async="">', appShellStart) : -1;
if (appShellStart < 0 || appShellEnd <= appShellStart) {
  throw new Error('Unable to locate rendered app shell bounds for safe anchor href rewrite.');
}

const shellMarkup = html.slice(appShellStart, appShellEnd);
const rewrittenShellMarkup = shellMarkup.replace(/(<a\b[^>]*\shref=")\/([^"]*)"/gi, (_full, prefix, routeTail) => {
  if (routeTail.startsWith('/')) return `${prefix}/${routeTail}"`;
  const normalizedTail = routeTail ? routeTail.replace(/^\/+/, '') : '';
  const hashRoute = normalizedTail ? `#/${normalizedTail}` : '#/';
  return `${prefix}${hashRoute}"`;
});

if (/\bhref="\/(?!\/)/i.test(rewrittenShellMarkup)) {
  throw new Error('Internal app-shell anchors still contain pathname href values after hash-route rewrite.');
}

if (!rewrittenShellMarkup.includes('data-testid="top-nav-dashboard" href="#/"')) {
  throw new Error('Dashboard top-nav href did not normalize to hash route (#/).');
}

html = `${html.slice(0, appShellStart)}${rewrittenShellMarkup}${html.slice(appShellEnd)}`;

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
  const detectGatewayBase = (pathname) => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] === 'ipfs' && segments[1]) return '/ipfs/' + segments[1];
    if (segments[0] === 'ipns' && segments[1]) return '/ipns/' + segments[1];
    return pathname;
  };

  const documentPath = window.location.pathname;
  const documentSearch = window.location.search;
  const documentUrl = documentPath + documentSearch;
  const gatewayBase = detectGatewayBase(documentPath);

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

  const baseRoutes = new Set(['/', '/jobs', '/identity', '/admin', '/advanced', '/design', '/deployment', '/demo']);

  const recoverPrefixedRoute = (routePath) => {
    if (typeof routePath !== 'string' || !routePath.startsWith('/')) return null;

    const segments = routePath.split('/').filter(Boolean);
    if (segments.length === 0) return '/';

    const normalizedSegments = [];
    for (const segment of segments) {
      const lower = segment.toLowerCase();
      if (!segment) continue;
      if (lower === 'ipfs' || lower === 'ipns') {
        normalizedSegments.length = 0;
        continue;
      }
      if (lower === 'agijobmanager' || lower === 'index.html' || lower === 'agijobmanager.html') {
        continue;
      }
      if (lower.endsWith('.html')) {
        continue;
      }
      normalizedSegments.push(segment);
    }

    if (normalizedSegments.length === 0) return '/';

    const first = normalizedSegments[0] || '';
    const firstLower = first.toLowerCase();
    if (firstLower === 'jobs') {
      const maybeJobId = normalizedSegments.slice(1).join('/');
      if (!maybeJobId) return '/jobs';
      return '/jobs/' + maybeJobId;
    }

    const candidate = '/' + firstLower;
    if (baseRoutes.has(candidate)) return candidate;
    return null;
  };

  const sanitizeRoutePath = (routePath) => {
    if (typeof routePath !== 'string' || !routePath) return '/';

    const nestedHashRouteIndex = routePath.lastIndexOf('#/');
    if (nestedHashRouteIndex > 0) {
      const nestedHashRoute = routePath.slice(nestedHashRouteIndex + 1);
      return sanitizeRoutePath(nestedHashRoute);
    }

    const routeWithoutHash = routePath.split('#')[0] || '/';
    const withoutQuery = routeWithoutHash.split('?')[0] || '/';
    const normalizedSlash = withoutQuery.startsWith('/') ? withoutQuery : '/' + withoutQuery;
    const collapsed = normalizedSlash.replace(/\\/{2,}/g, '/');
    const lowered = collapsed.toLowerCase();

    if (lowered.includes('agijobmanager.html') || lowered.startsWith('/agijobmanager/') || lowered.startsWith('/ipfs/') || lowered.startsWith('/ipns/')) {
      const recoveredRoute = recoverPrefixedRoute(collapsed);
      if (recoveredRoute) {
        if (recoveredRoute.startsWith('/jobs/')) {
          const rawRecoveredJobId = recoveredRoute.slice('/jobs/'.length);
          let decodedRecoveredJobId = rawRecoveredJobId;
          try {
            decodedRecoveredJobId = decodeURIComponent(rawRecoveredJobId);
          } catch (_error) {
            decodedRecoveredJobId = rawRecoveredJobId;
          }
          return '/jobs/' + encodeURIComponent(decodedRecoveredJobId);
        }
        return recoveredRoute;
      }
      return '/';
    }

    if (collapsed.startsWith('/jobs/')) {
      const jobId = collapsed.slice('/jobs/'.length);
      if (!jobId || jobId.startsWith('/')) return '/jobs';
      let decodedJobId = jobId;
      try {
        decodedJobId = decodeURIComponent(jobId);
      } catch (_error) {
        decodedJobId = jobId;
      }
      return '/jobs/' + encodeURIComponent(decodedJobId);
    }

    if (baseRoutes.has(collapsed)) return collapsed;
    return '/';
  };

  const parseRouteInput = (routeInput) => {
    if (typeof routeInput !== 'string' || !routeInput.startsWith('/')) return null;
    const hashIndex = routeInput.indexOf('#');
    const withoutHash = hashIndex >= 0 ? routeInput.slice(0, hashIndex) : routeInput;
    const queryIndex = withoutHash.indexOf('?');
    const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
    const search = queryIndex >= 0 ? withoutHash.slice(queryIndex) : '';
    return { pathname, search, routeInput: withoutHash };
  }; // end parseRouteInput

  const toHashUrl = (routeInput) => {
    const parsedHashRoute = parseRouteInput(routeInput);
    if (!parsedHashRoute) return null;
    // Always preserve the exact document URL prefix (path + filename + query)
    // and mutate only the hash fragment. This keeps routing filename-agnostic
    // and nested-hosting-safe for GitHub Pages, arbitrary subpaths, and IPFS gateways.
    return documentUrl + '#' + parsedHashRoute.routeInput;
  };

  const dispatchRouteUpdate = (state) => {
    window.dispatchEvent(new PopStateEvent('popstate', { state }));
  };

  const getStartupCanonicalHash = (rawHash) => {
    if (!rawHash || rawHash === '#') return null;
    const lowerHash = rawHash.toLowerCase();

    const directRouteCandidate = rawHash.startsWith('#/') ? rawHash.slice(1) : '';
    if (directRouteCandidate) {
      const sanitizedDirectRoute = sanitizeRoutePath(directRouteCandidate);
      const directCanonicalHash = '#' + sanitizedDirectRoute;
      if (directCanonicalHash !== rawHash) return directCanonicalHash;
      return null;
    }

    if (rawHash.startsWith('#/#/') || rawHash.startsWith('##/')) return '#/';
    if (lowerHash.includes('agijobmanager.html')) return '#/';
    if (rawHash.includes(documentPath)) return '#/';
    if (rawHash.includes(gatewayBase)) return '#/';

    return '#/';
  };

  const getRouteFromHash = () => {
    const rawHash = window.location.hash || '';
    if (rawHash === '#' || rawHash === '') return '/';
    if (!rawHash.startsWith('#/')) return '/';
    const normalized = rawHash.slice(1);
    return sanitizeRoutePath(normalized.startsWith('/') ? normalized : '/');
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

  const OFFICIAL = {
    chainId: 1,
    explorerBaseUrl: 'https://etherscan.io',
    baseIpfsUrl: 'https://ipfs.io/ipfs/',
    rpcUrls: ['https://eth.llamarpc.com', 'https://ethereum-rpc.publicnode.com'],
    contracts: {
      agiJobManager: '0xB3AAeb69b630f0299791679c063d68d6687481d1',
      ensJobPages: '0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94',
      agiToken: '0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA'
    }
  };

  const SETTINGS_KEY = 'agijobmanager.runtime.settings.v1';
  const WALLET_PROVIDER_KEY = 'agijobmanager.runtime.walletProvider.v1';
  const DEFAULT_SETTINGS = {
    rpcUrls: OFFICIAL.rpcUrls,
    explorerBaseUrl: OFFICIAL.explorerBaseUrl,
    ipfsGatewayBaseUrl: OFFICIAL.baseIpfsUrl,
    demoMode: false,
    agentMode: false,
    allowInsecureHttpLinks: false
  };

  const walletState = {
    provider: null,
    providerLabel: null,
    providerId: null,
    account: null,
    chainId: null,
    ensName: null,
    connected: false,
    error: null,
    providers: [],
    boundProvider: null
  };

  const loadSettings = () => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        rpcUrls: Array.isArray(parsed.rpcUrls) && parsed.rpcUrls.length ? parsed.rpcUrls : DEFAULT_SETTINGS.rpcUrls
      };
    } catch (_error) {
      return { ...DEFAULT_SETTINGS };
    }
  };

  let settings = loadSettings();
  const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

  const normalizeRouteForView = (routePath) => {
    if (!routePath || routePath === '/') return '/';
    if (routePath.startsWith('/jobs/')) return '/jobs';
    return routeViewCopy[routePath] ? routePath : '/';
  };

  const isJobDetailRoute = (routePath) => routePath.startsWith('/jobs/') && routePath.length > '/jobs/'.length;

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
    '/': '<section data-testid="route-dashboard"><h2>Dashboard · Sovereign Ops Console</h2><div id="wallet-panel"></div><p id="rpc-status">Read-only mainnet hydration active.</p><ul><li>Owner: <code id="hyd-owner">loading</code></li><li>Next Job ID: <code id="hyd-next-job-id">loading</code></li><li>Token Symbol: <code id="hyd-token-symbol">loading</code></li><li>Wallet Balance: <code id="hyd-token-balance">-</code></li></ul></section>',
    '/jobs': '<section data-testid="route-jobs"><h2>Jobs Ledger</h2><p>Live mainnet ledger hydrated from AGIJobManager ABI reads. Demo fixtures render only when Demo mode is explicitly enabled.</p><p id="jobs-status">Loading jobs ledger…</p><table><thead><tr><th>ID</th><th>Status</th><th>Payout</th><th>Employer</th><th>Agent</th><th>ENS Name</th></tr></thead><tbody id="jobs-ledger-body"></tbody></table></section>',
    '/identity': '<section data-testid="route-identity"><h2>Identity Layer Console</h2><p>Root: <code>alpha.jobs.agi.eth</code> · format <code>job-&lt;jobId&gt;.alpha.jobs.agi.eth</code></p><ul><li>ENSJobPages: <code>0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94</code></li><li>Resolver: <code>0xF29100983E058B709F3D539b0c765937B804AC15</code></li><li>Wired job manager: <code id="hyd-ens-job-manager">resolving…</code> <button id="identity-retry" type="button">Retry</button></li><li id="identity-wiring-status">Checking ABI-backed wiring state…</li></ul></section>',
    '/admin': '<section data-testid="route-admin"><h2>Admin Ops Console</h2><p>Simulation-first write flow: Prepare → Simulate → Sign → Pending → Confirmed/Failed.</p><div style="display:grid;gap:0.5rem"><p>Connected chain: <code id="hyd-chain">read-only</code></p><p>Role gate: <strong id="hyd-owner-match">Not authorized</strong></p><p id="admin-write-guidance">Connect MetaMask on Ethereum Mainnet for write actions. Read-only telemetry is always available.</p><div style="display:flex;gap:0.5rem;flex-wrap:wrap"><button id="admin-pause" disabled title="Connect wallet + owner authorization required">Pause protocol</button><button id="admin-unpause" disabled title="Connect wallet + owner authorization required">Unpause protocol</button><button id="admin-settlement" disabled title="Connect wallet + owner authorization required">Toggle settlement pause</button></div></div><details><summary>Settings</summary><div><label>RPC endpoints (newline)</label><textarea id="settings-rpc" rows="4" style="width:100%"></textarea><label>Explorer URL</label><input id="settings-explorer" style="width:100%"/><label>IPFS gateway URL</label><input id="settings-ipfs" style="width:100%"/><label><input type="checkbox" id="settings-demo"/> Demo mode</label><label><input type="checkbox" id="settings-agent"/> Agent mode</label><label><input type="checkbox" id="settings-http"/> Allow insecure HTTP links</label><div><button id="settings-save">Save</button><button id="settings-reset">Reset official defaults</button><button id="settings-export">Export JSON</button><button id="settings-import">Import JSON</button></div></div></details></section>',
    '/advanced': '<section data-testid="route-advanced"><h2>Advanced Contract Console</h2><p>ABI-driven method explorer for AGIJobManager, ENSJobPages, and AGI ALPHA token flows.</p><p>Export agent-ready payload JSON for deterministic execution.</p><pre>{"simulateFirst":true,"chainId":1,"functionName":"approve"}</pre></section>',
    '/design': '<section data-testid="route-design"><h2>Design System Gallery</h2><p>ASI Sovereign Purple palette, typography, contrast checks, and reduced-motion examples.</p><p>This route is the canonical visual demo for CI and docs.</p><ul><li>Palette anchors</li><li>Typography scale</li><li>Focus-visible states</li></ul></section>',
    '/deployment': '<section data-testid="route-deployment"><h2>Deployment Registry</h2><p>Mainnet artifact-derived addresses, owner/deployer roles, linked libraries, and constructor evidence.</p><p>Includes release and explorer references.</p><dl><dt>AGIJobManager</dt><dd>0xB3AAeb69b630f0299791679c063d68d6687481d1</dd><dt>ENSJobPages</dt><dd>0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94</dd></dl></section>',
    '/demo': '<section data-testid="route-demo"><h2>Deterministic Demo Mode</h2><p>Fixtures cover lifecycle edge-cases, malformed URI blocking, and degraded RPC behavior.</p><p>Writes are disabled while preserving operator-visible action panels.</p><p>Actors: visitor, employer, agent, validator, moderator, owner.</p></section>'
  };

  const routeJobDetailMarker = 'data-testid="route-job-detail"';

  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value);
  };


  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const ensureHeaderWalletHost = () => {
    const existing = document.getElementById('wallet-header-panel');
    if (existing) return existing;
    const header = document.querySelector('header') || document.body;
    const host = document.createElement('div');
    host.id = 'wallet-header-panel';
    host.style.padding = '0.5rem 1rem';
    host.style.borderTop = '1px solid rgba(169,160,180,0.2)';
    host.style.fontFamily = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    header.append(host);
    return host;
  };

  const toChecksumDisplay = (addr) => (addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : 'not connected');
  const padHex = (value) => value.toString(16).padStart(64, '0');
  const methodId = (sig) => ({
    'owner()': '0x8da5cb5b',
    'nextJobId()': '0x0f10cc36',
    'jobManager()': '0x3df395a3',
    'agiToken()': '0xec9f4f8d',
    'ensJobPages()': '0x9f58f6ff',
    'symbol()': '0x95d89b41',
    'resolver(bytes32)': '0x0178b8bf',
    'name(bytes32)': '0x691f3431',
    'balanceOf(address)': '0x70a08231',
    'getJobCore(uint256)': '0x0a0f704e'
  }[sig]);

  const decodeAddress = (hex) => (hex && hex.length >= 66 ? '0x' + hex.slice(-40) : null);
  const decodeUint = (hex) => (hex && hex.length >= 66 ? BigInt(hex).toString() : '0');
  const decodeString = (hex) => {
    if (!hex || hex === '0x') return '';
    if (hex.length < 130) return '';
    const len = Number(BigInt('0x' + hex.slice(66, 130)));
    const data = hex.slice(130, 130 + len * 2);
    try {
      return decodeURIComponent(data.replace(/(..)/g, '%$1'));
    } catch (_error) {
      return '';
    }
  };
  const decodeBool = (hex) => (hex && hex.length >= 66 ? BigInt(hex) !== 0n : false);
  const decodeJobCore = (hex) => {
    if (!hex || hex.length < 2 + (9 * 64)) return null;
    const words = [];
    for (let i = 2; i + 64 <= hex.length && words.length < 9; i += 64) {
      words.push('0x' + hex.slice(i, i + 64));
    }
    if (words.length < 9) return null;
    return {
      employer: decodeAddress(words[0]),
      agent: decodeAddress(words[1]),
      payout: BigInt(words[2]),
      deadline: BigInt(words[4]),
      active: decodeBool(words[5]),
      completed: decodeBool(words[6]),
      disputed: decodeBool(words[7]),
      statusCode: Number(BigInt(words[8]))
    };
  };

  const rpcCall = async (method, params) => {
    let lastError = null;
    for (const rpcUrl of settings.rpcUrls) {
      try {
        const res = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) });
        const json = await res.json();
        if (json.error) throw new Error(json.error.message || 'RPC error');
        return json.result;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('All RPC endpoints failed');
  };

  const ethCall = async (to, data) => rpcCall('eth_call', [{ to, data }, 'latest']);

  const hydrateReadOnly = async () => {
    try {
      const blockHex = await rpcCall('eth_blockNumber', []);
      setText('rpc-status', 'Read-only mainnet connected · block ' + parseInt(blockHex, 16) + ' · ' + new Date().toISOString());
      setText('hyd-chain', walletState.chainId ? walletState.chainId : '1 (read-only)');
      const owner = decodeAddress(await ethCall(OFFICIAL.contracts.agiJobManager, methodId('owner()')));
      setText('hyd-owner', owner);
      setText('hyd-next-job-id', decodeUint(await ethCall(OFFICIAL.contracts.agiJobManager, methodId('nextJobId()'))));
      setText('hyd-token-symbol', decodeString(await ethCall(OFFICIAL.contracts.agiToken, methodId('symbol()'))) || 'AGI');
      const ownerMatch = walletState.account && owner && walletState.account.toLowerCase() === owner.toLowerCase();
      setText('hyd-owner-match', ownerMatch ? 'You are owner' : 'Not authorized');
      setText('admin-write-guidance', ownerMatch ? 'Owner privileges detected. Keep simulation-first enabled for every write.' : 'Connect owner wallet on Ethereum Mainnet for writes. Read-only telemetry remains available.');
      if (walletState.account) {
        const data = methodId('balanceOf(address)') + padHex(BigInt(walletState.account).toString(16));
        setText('hyd-token-balance', decodeUint(await ethCall(OFFICIAL.contracts.agiToken, data)));
      } else {
        setText('hyd-token-balance', '-');
      }
      hydrateIdentityWiring();
      hydrateJobsLedger();
    } catch (error) {
      setText('rpc-status', 'Degraded RPC mode: ' + (error && error.message ? error.message : 'unknown error'));
    }
  };

  const jobStatusLabel = (core) => {
    if (!core) return 'unavailable';
    if (core.completed) return 'Completed';
    if (core.disputed) return 'Disputed';
    if (core.active) return 'Open';
    return 'Closed';
  };

  const hydrateJobsLedger = async () => {
    const tbody = document.getElementById('jobs-ledger-body');
    const status = document.getElementById('jobs-status');
    if (!tbody || !status) return;
    tbody.innerHTML = '';
    try {
      const nextJobIdHex = await ethCall(OFFICIAL.contracts.agiJobManager, methodId('nextJobId()'));
      const nextJobId = Number(BigInt(nextJobIdHex));
      if (nextJobId === 0) {
        status.textContent = 'No jobs found on-chain.';
        return;
      }
      const start = Math.max(0, nextJobId - 25);
      for (let jobId = start; jobId < nextJobId; jobId += 1) {
        const data = methodId('getJobCore(uint256)') + padHex(BigInt(jobId).toString(16));
        let core = null;
        try {
          core = decodeJobCore(await ethCall(OFFICIAL.contracts.agiJobManager, data));
        } catch (_error) {
          core = null;
        }
        if (!core || !core.employer || /^0x0{40}$/i.test(core.employer)) continue;
        const row = document.createElement('tr');
        row.innerHTML = '<td>' + jobId + '</td><td>' + escapeHtml(jobStatusLabel(core)) + '</td><td>' + escapeHtml(core.payout.toString()) + ' AGI</td><td><code>' + escapeHtml(toChecksumDisplay(core.employer)) + '</code></td><td><code>' + escapeHtml(toChecksumDisplay(core.agent)) + '</code></td><td><code>' + escapeHtml('job-' + jobId + '.alpha.jobs.agi.eth') + '</code></td>';
        tbody.appendChild(row);
      }
      status.textContent = tbody.children.length ? 'Live on-chain jobs loaded: ' + tbody.children.length : 'No readable job slots in the latest window.';
    } catch (error) {
      status.textContent = 'Jobs ledger unavailable: ' + (error && error.message ? error.message : 'RPC error');
    }
  };

  const hydrateIdentityWiring = async (attempt = 0) => {
    const target = document.getElementById('hyd-ens-job-manager');
    const status = document.getElementById('identity-wiring-status');
    if (!target || !status) return;
    status.textContent = 'Resolving ENSJobPages wiring…';
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
      const wiringHex = await Promise.race([ethCall(OFFICIAL.contracts.ensJobPages, methodId('jobManager()')), timeout]);
      const wired = decodeAddress(wiringHex);
      if (!wired) throw new Error('method returned empty address');
      target.textContent = wired;
      status.textContent = wired.toLowerCase() === OFFICIAL.contracts.agiJobManager.toLowerCase()
        ? 'Verified: ENSJobPages is wired to the expected AGIJobManager.'
        : 'Mismatch: wiring differs from expected AGIJobManager address.';
    } catch (error) {
      if (attempt < 2) {
        status.textContent = 'Retrying wiring lookup…';
        setTimeout(() => hydrateIdentityWiring(attempt + 1), 500 * (attempt + 1));
        return;
      }
      target.textContent = 'unavailable';
      status.textContent = 'Wiring read failed: ' + (error && error.message ? error.message : 'unknown error') + '. Click Retry.';
    }
  };

  const renderJobDetail = (routePath, host) => {
    const rawJobId = routePath.slice('/jobs/'.length);
    let jobId = rawJobId;
    try {
      jobId = decodeURIComponent(rawJobId);
    } catch (_error) {
      jobId = rawJobId;
    }

    const section = document.createElement('section');
    section.setAttribute('data-testid', 'route-job-detail');
    section.setAttribute('data-marker', routeJobDetailMarker);

    const title = document.createElement('h2');
    title.textContent = 'Job Detail · ' + jobId;

    const description = document.createElement('p');
    description.textContent = 'Route-specific detail panels: core state, dispute posture, spec/completion URI safety, and ENS identity snapshot.';

    const eligibility = document.createElement('p');
    eligibility.textContent = 'Eligibility and write safety require simulation-first preflight checks.';

    section.append(title, description, eligibility);
    host.replaceChildren(section);
  };

  const updatePrimaryView = (routePath) => {
    const normalizedRoute = sanitizeRoutePath(routePath);
    const normalized = normalizeRouteForView(normalizedRoute);
    const main = document.querySelector('main');
    if (!main) return;
    const existing = main.querySelector('[data-ipfs-main-outlet="true"]');
    const host = existing || (() => {
      main.innerHTML = '';
      const wrapper = document.createElement('article');
      wrapper.setAttribute('data-ipfs-main-outlet', 'true');
      wrapper.style.padding = '1rem';
      wrapper.style.maxWidth = '74rem';
      wrapper.style.margin = '0 auto';
      main.append(wrapper);
      return wrapper;
    })();

    if (isJobDetailRoute(normalizedRoute)) {
      renderJobDetail(normalizedRoute, host);
      return;
    }

    host.innerHTML = routeContent[normalized] || routeContent['/'];

    if (normalized === '/') renderWalletPanel();
    if (normalized === '/admin') wireSettingsPanel();
    if (normalized === '/jobs') hydrateJobsLedger();
    if (normalized === '/identity') {
      const retry = document.getElementById('identity-retry');
      if (retry) retry.onclick = () => hydrateIdentityWiring(0);
      hydrateIdentityWiring(0);
    }
  };

  const setWalletError = (message) => {
    walletState.error = message;
    renderWalletPanel();
  };

  const utf8ToHex = (text) => {
    const bytes = new TextEncoder().encode(text);
    let hex = '';
    for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
    return '0x' + hex;
  };

  const hashHex = async (hexValue) => {
    const result = await rpcCall('web3_sha3', [hexValue]);
    return typeof result === 'string' ? result : null;
  };

  const namehash = async (name) => {
    const labels = name.split('.').filter(Boolean);
    let node = '0x' + '00'.repeat(32);
    for (let i = labels.length - 1; i >= 0; i -= 1) {
      const labelHash = await hashHex(utf8ToHex(labels[i]));
      if (!labelHash) return null;
      node = await hashHex(node + labelHash.slice(2));
      if (!node) return null;
    }
    return node;
  };

  const bindProviderEvents = (provider) => {
    if (!provider || typeof provider.on !== 'function') return;
    if (walletState.boundProvider === provider) return;
    provider.on('accountsChanged', () => {
      walletState.account = null;
      walletState.connected = false;
      renderWalletPanel();
      refreshWalletState();
    });
    provider.on('chainChanged', () => {
      walletState.chainId = null;
      renderWalletPanel();
      refreshWalletState();
    });
    provider.on('disconnect', () => disconnectWallet());
    walletState.boundProvider = provider;
  };

  const resolveEnsName = async (account) => {
    try {
      const reverseName = account.toLowerCase().replace(/^0x/, '') + '.addr.reverse';
      const reverseNode = await namehash(reverseName);
      if (!reverseNode) return null;

      const resolverHex = await ethCall(
        '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
        methodId('resolver(bytes32)') + reverseNode.slice(2)
      );
      const resolver = decodeAddress(resolverHex);
      if (!resolver || /^0x0{40}$/i.test(resolver)) return null;

      const nameHex = await ethCall(resolver, methodId('name(bytes32)') + reverseNode.slice(2));
      const resolved = decodeString(nameHex);
      return resolved || null;
    } catch (_error) {
      return null;
    }
  };

  const providerLabelFromInfo = (entry) => {
    const rdns = String(entry && entry.info && entry.info.rdns ? entry.info.rdns : '').toLowerCase();
    const provider = entry && entry.provider ? entry.provider : null;
    if ((provider && provider.isMetaMask) || rdns.includes('metamask')) return 'MetaMask';
    if ((provider && provider.isPhantom) || rdns.includes('phantom')) return 'Phantom';
    const fromInfo = entry && entry.info && entry.info.name ? String(entry.info.name) : '';
    return fromInfo || 'Injected EVM Wallet';
  };

  const selectProvider = (discovered) => {
    const preferredId = localStorage.getItem(WALLET_PROVIDER_KEY);
    const byPreference = preferredId ? discovered.find((entry) => entry.id === preferredId) : null;
    const metaMask = discovered.find((entry) => providerLabelFromInfo(entry) === 'MetaMask');
    const selected = byPreference || metaMask || discovered[0] || null;
    walletState.provider = selected ? selected.provider : null;
    walletState.providerLabel = selected ? providerLabelFromInfo(selected) : null;
    walletState.providerId = selected ? selected.id : null;
    if (walletState.providerId) localStorage.setItem(WALLET_PROVIDER_KEY, walletState.providerId);
    bindProviderEvents(walletState.provider);
  };

  const detectProviders = async () => {
    const discovered = [];
    const providerSeen = new Set();
    window.addEventListener('eip6963:announceProvider', (event) => {
      if (event && event.detail && event.detail.provider && !providerSeen.has(event.detail.provider)) {
        providerSeen.add(event.detail.provider);
        discovered.push(event.detail);
      }
    });
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    await new Promise((resolve) => setTimeout(resolve, 64));
    if (window.ethereum && !providerSeen.has(window.ethereum)) {
      discovered.push({ provider: window.ethereum, info: { name: 'Injected EVM Wallet', rdns: '' }, id: 'window.ethereum' });
    }
    walletState.providers = discovered;
    selectProvider(discovered);
  };

  const refreshWalletState = async () => {
    if (!walletState.provider) return;
    try {
      const chainHex = await walletState.provider.request({ method: 'eth_chainId' });
      walletState.chainId = parseInt(chainHex, 16);
      const accounts = await walletState.provider.request({ method: 'eth_accounts' });
      walletState.account = Array.isArray(accounts) && accounts[0] ? accounts[0] : null;
      walletState.connected = Boolean(walletState.account);
      walletState.ensName = walletState.account ? await resolveEnsName(walletState.account) : null;
      renderWalletPanel();
      hydrateReadOnly();
    } catch (error) {
      setWalletError(error && error.message ? error.message : 'Wallet state refresh failed');
    }
  };

  const connectWallet = async () => {
    try {
      if (!walletState.provider) await detectProviders();
      if (!walletState.provider) throw new Error('No EIP-1193 wallet provider detected.');
      await walletState.provider.request({ method: 'eth_requestAccounts' });
      await refreshWalletState();
    } catch (error) {
      setWalletError(error && error.message ? error.message : 'Connection failed');
    }
  };

  const disconnectWallet = () => {
    walletState.account = null;
    walletState.connected = false;
    walletState.ensName = null;
    walletState.chainId = null;
    walletState.error = null;
    localStorage.removeItem(WALLET_PROVIDER_KEY);
    renderWalletPanel();
    hydrateReadOnly();
  };

  const switchMainnet = async () => {
    if (!walletState.provider) return;
    try {
      await walletState.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
      await refreshWalletState();
    } catch (error) {
      setWalletError('Unable to switch chain automatically. Please change network to Ethereum Mainnet in wallet.');
    }
  };

  const renderWalletPanel = () => {
    const dashboardHost = document.getElementById('wallet-panel');
    const headerHost = document.getElementById('wallet-header-panel');
    if (dashboardHost && headerHost) headerHost.remove();
    const host = dashboardHost || ensureHeaderWalletHost();

    const mismatch = walletState.connected && walletState.chainId !== OFFICIAL.chainId;
    const fileOrigin = window.location.protocol === 'file:';
    const safeProviderLabel = escapeHtml(walletState.providerLabel || 'none detected');
    const safeAccountDisplay = escapeHtml(toChecksumDisplay(walletState.account));
    const safeEnsName = escapeHtml(walletState.ensName || '-');
    const safeChainDisplay = escapeHtml(walletState.chainId || 'read-only');
    const safeWalletError = walletState.error ? escapeHtml(walletState.error) : '';
    host.innerHTML = '<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap"><button type="button" id="wallet-connect">' + (walletState.connected ? 'Connected' : 'Connect Wallet') + '</button><button type="button" id="wallet-disconnect">Disconnect / Reset UI</button><span>Provider: <code>' + safeProviderLabel + '</code></span><select id="wallet-provider-select" ' + (walletState.providers.length > 1 ? '' : 'disabled') + '><option value="">Auto</option>' + walletState.providers.map((entry, idx) => { const label = escapeHtml(providerLabelFromInfo(entry)); const id = escapeHtml(entry.id || String(idx)); const selected = walletState.providerId && walletState.providerId === (entry.id || String(idx)) ? ' selected' : ''; return '<option value="' + id + '"' + selected + '>' + label + '</option>'; }).join('') + '</select><span>Account: <code id="wallet-address-value">' + safeAccountDisplay + '</code></span><button type="button" id="wallet-copy" ' + (walletState.account ? '' : 'disabled') + '>Copy</button><span>ENS: <code>' + safeEnsName + '</code></span><span>Chain: <code>' + safeChainDisplay + '</code></span>' + (mismatch ? '<button type="button" id="wallet-switch">Switch to Mainnet</button><strong style="color:#f5b">Wrong network</strong>' : '') + '</div>' + (safeWalletError ? '<p style="color:#ff8080">' + safeWalletError + '</p>' : '') + (fileOrigin ? '<p style="color:#ffd27f">file:// origin: wallet writes require HTTPS hosting.</p>' : '');
    const connectBtn = host.querySelector('#wallet-connect');
    const disconnectBtn = host.querySelector('#wallet-disconnect');
    if (connectBtn) connectBtn.addEventListener('click', connectWallet);
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnectWallet);
    const switchBtn = host.querySelector('#wallet-switch');
    if (switchBtn) switchBtn.addEventListener('click', switchMainnet);
    const copyBtn = host.querySelector('#wallet-copy');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      if (!walletState.account) return;
      try { await navigator.clipboard.writeText(walletState.account); } catch (_error) {}
    });
    const providerSelect = host.querySelector('#wallet-provider-select');
    if (providerSelect) providerSelect.addEventListener('change', async (event) => {
      const nextId = event && event.target ? event.target.value : '';
      if (!nextId) {
        localStorage.removeItem(WALLET_PROVIDER_KEY);
      } else {
        localStorage.setItem(WALLET_PROVIDER_KEY, nextId);
      }
      await detectProviders();
      await refreshWalletState();
    });
  };

  const wireSettingsPanel = () => {
    const rpc = document.getElementById('settings-rpc');
    const exp = document.getElementById('settings-explorer');
    const ipfs = document.getElementById('settings-ipfs');
    const demo = document.getElementById('settings-demo');
    const agent = document.getElementById('settings-agent');
    const http = document.getElementById('settings-http');
    if (!rpc || !exp || !ipfs || !demo || !agent || !http) return;
    rpc.value = settings.rpcUrls.join('\\n');
    exp.value = settings.explorerBaseUrl;
    ipfs.value = settings.ipfsGatewayBaseUrl;
    demo.checked = Boolean(settings.demoMode);
    agent.checked = Boolean(settings.agentMode);
    http.checked = Boolean(settings.allowInsecureHttpLinks);
    const save = document.getElementById('settings-save');
    const reset = document.getElementById('settings-reset');
    const expBtn = document.getElementById('settings-export');
    const impBtn = document.getElementById('settings-import');
    if (save) save.onclick = () => {
      settings = {
        rpcUrls: String(rpc.value || '').split('\\n').map((s) => s.trim()).filter(Boolean),
        explorerBaseUrl: String(exp.value || '').trim() || OFFICIAL.explorerBaseUrl,
        ipfsGatewayBaseUrl: String(ipfs.value || '').trim() || OFFICIAL.baseIpfsUrl,
        demoMode: demo.checked,
        agentMode: agent.checked,
        allowInsecureHttpLinks: http.checked
      };
      saveSettings();
      hydrateReadOnly();
    };
    if (reset) reset.onclick = () => { settings = { ...DEFAULT_SETTINGS }; saveSettings(); updatePrimaryView('/admin'); };
    if (expBtn) expBtn.onclick = () => { navigator.clipboard.writeText(JSON.stringify(settings, null, 2)); };
    if (impBtn) impBtn.onclick = () => {
      const raw = prompt('Paste settings JSON');
      if (!raw) return;
      try { settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }; saveSettings(); updatePrimaryView('/admin'); } catch (_error) {}
    };
  };

  const startupCanonicalHash = getStartupCanonicalHash(window.location.hash || '');
  if (startupCanonicalHash) {
    rawReplaceState(history.state, '', documentUrl + startupCanonicalHash);
  }

  window.addEventListener('hashchange', () => {
    const routePath = getRouteFromHash();
    const canonicalHash = '#' + routePath;
    if (window.location.hash !== canonicalHash) {
      rawReplaceState(history.state, '', documentUrl + canonicalHash);
    }
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
    const routePath = sanitizeRoutePath(hashRoute.slice(1));
    navigateHashRoute(routePath, { mode: 'push' });
    updateRoutePanel(routePath);
    updatePrimaryView(routePath);
  }, true);

  const startupRoute = getRouteFromHash();
  updateRoutePanel(startupRoute);
  updatePrimaryView(startupRoute);
  detectProviders().then(refreshWalletState).then(hydrateReadOnly);
  bindProviderEvents(walletState.provider);
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

function assertRouterHelperDeclarations(singleFileHtml) {
  const scriptBodies = [...singleFileHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  const routerScript = scriptBodies.find((body) => (
    body.includes('const normalizeHashHref = (input) => {')
    && body.includes('const parseRouteInput = (routeInput) => {')
    && body.includes('const toHashUrl = (routeInput) => {')
    && body.includes('const getRouteFromHash = () => {')
    && body.includes('const navigateHashRoute = (nextRoute, options = {}) => {')
  ));

  if (!routerScript) {
    throw new Error('Router bootstrap script is missing parseRouteInput/toHashUrl/getRouteFromHash/navigateHashRoute helper declarations.');
  }

  const parseRouteInputIndex = routerScript.indexOf('const parseRouteInput = (routeInput) => {');
  const toHashUrlIndex = routerScript.indexOf('const toHashUrl = (routeInput) => {');
  const getRouteFromHashIndex = routerScript.indexOf('const getRouteFromHash = () => {');
  const navigateHashRouteIndex = routerScript.indexOf('const navigateHashRoute = (nextRoute, options = {}) => {');

  if (parseRouteInputIndex < 0 || toHashUrlIndex < 0 || getRouteFromHashIndex < 0 || navigateHashRouteIndex < 0) {
    throw new Error('Router bootstrap helper declaration indexes could not be resolved.');
  }

  if (parseRouteInputIndex > toHashUrlIndex) {
    throw new Error('Router bootstrap declares toHashUrl before parseRouteInput, which can break parseability and runtime routing.');
  }

  if (!routerScript.includes('const parsedHashRoute = parseRouteInput(routeInput);')) {
    throw new Error('toHashUrl no longer parses routes through parseRouteInput(routeInput).');
  }

  if (!routerScript.includes('const routePath = getRouteFromHash();')) {
    throw new Error('Router bootstrap no longer derives routePath via getRouteFromHash().');
  }

  if (!routerScript.includes('navigateHashRoute(routePath, { mode: \'push\' });')) {
    throw new Error('Router click interception no longer routes through navigateHashRoute(routePath, { mode: \'push\' }).');
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

  const gatewayPathnameDeclarations = routerWindow.match(/\bconst\s+gatewayPathname\s*=/g) ?? [];
  if (gatewayPathnameDeclarations.length > 0) {
    throw new Error('Router bootstrap must not declare gatewayPathname; internal route transitions must preserve the current document pathname and filename exactly.');
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

function assertAllInlineScriptsParseable(singleFileHtml) {
  const scriptTags = [...singleFileHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (let index = 0; index < scriptTags.length; index += 1) {
    const attrs = scriptTags[index][1] || '';
    const body = scriptTags[index][2] || '';

    if (!body.trim()) continue;
    if (/type=["']application\/(?:ld\+json|json)["']/i.test(attrs)) continue;
    if (/id=["']__NEXT_DATA__["']/i.test(attrs)) continue;

    try {
      new Function(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Inline script #${index + 1} is not parseable: ${message}`);
    }
  }
}

html = sanitizeForbiddenDataUris(html);
assertNoDuplicateNextFlightBootstrap(html);
assertNoPrematureDocumentClose(html);
assertHashRoutingBootstrapClosed(html);
assertParseableNavigateHashRoute(html);
assertRouterHelperDeclarations(html);
assertRouterBootstrapCoherence(html);
assertNormalizeHashHrefParsedBinding(html);
assertNoNavigateInvocationWithoutDeclaration(html);
assertAllInlineScriptsParseable(html);

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
