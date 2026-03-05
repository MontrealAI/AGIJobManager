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
    '/jobs': '<section data-testid="route-jobs"><h2>Jobs Ledger</h2><p>Live on-chain ledger (mainnet); no placeholder rows in LIVE mode.</p><div id="jobs-status">Loading jobs from chain…</div><table><thead><tr><th>ID</th><th>Status</th><th>Payout</th><th>Employer</th><th>Agent</th><th>ENS Name</th></tr></thead><tbody id="jobs-body"></tbody></table></section>',
    '/identity': '<section data-testid="route-identity"><h2>Identity Layer Console</h2><p>Root: <code>alpha.jobs.agi.eth</code> · format <code>job-&lt;jobId&gt;.alpha.jobs.agi.eth</code></p><ul><li>ENSJobPages: <code>0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94</code></li><li>Resolver: <code>0xF29100983E058B709F3D539b0c765937B804AC15</code></li><li>Wired job manager: <code id="hyd-ens-job-manager">resolving…</code> <button id="identity-retry" type="button">Retry</button></li><li>Status: <span id="hyd-ens-job-manager-status">pending</span></li></ul></section>',
    '/admin': '<section data-testid="route-admin"><h2>Admin Ops Console</h2><p>Simulation-first write flow: Prepare → Simulate → Sign → Pending → Confirmed/Failed.</p><div style="display:grid;gap:.5rem"><p>Connected chain: <code id="hyd-chain">read-only</code></p><p>Role gate: <code id="hyd-owner-match">read-only</code></p><div><button id="admin-owner-action" type="button" disabled title="Connect wallet on mainnet as owner">Owner-only action</button><button id="admin-simulate" type="button" disabled title="Connect wallet to enable writes">Run simulation</button></div></div><details><summary>Settings</summary><div><label>RPC endpoints (newline)</label><textarea id="settings-rpc" rows="4" style="width:100%"></textarea><label>Explorer URL</label><input id="settings-explorer" style="width:100%"/><label>IPFS gateway URL</label><input id="settings-ipfs" style="width:100%"/><label><input type="checkbox" id="settings-demo"/> Demo mode (opt-in)</label><label><input type="checkbox" id="settings-agent"/> Agent mode</label><label><input type="checkbox" id="settings-http"/> Allow insecure HTTP links</label><div><button id="settings-save">Save</button><button id="settings-reset">Reset official defaults</button><button id="settings-export">Export JSON</button><button id="settings-import">Import JSON</button></div></div></details></section>',
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
    'nextJobId()': '0xb0c2aa5e',
    'jobManager()': '0x3df395a3',
    'agiToken()': '0x658bb543',
    'ensJobPages()': '0x275979d7',
    'getJobCore(uint256)': '0xc6b44fe7',
    'symbol()': '0x95d89b41',
    'name()': '0x06fdde03',
    'decimals()': '0x313ce567',
    'totalSupply()': '0x18160ddd',
    'allowance(address,address)': '0xdd62ed3e',
    'resolver(bytes32)': '0x0178b8bf',
    'name(bytes32)': '0x691f3431',
    'balanceOf(address)': '0x70a08231'
  }[sig]);

  const decodeAddress = (hex) => (hex && hex.length >= 66 ? '0x' + hex.slice(-40) : null);
  const decodeUint = (hex) => (hex && hex.length >= 66 ? BigInt(hex).toString() : '0');
  const decodeBool = (hex, index = 0) => {
    if (!hex || hex.length < 66 + index * 64) return false;
    const start = 2 + index * 64;
    return BigInt('0x' + hex.slice(start, start + 64)) !== 0n;
  };
  const decodeWordAddress = (hex, index = 0) => decodeAddress('0x' + hex.slice(2 + index * 64, 2 + (index + 1) * 64));
  const decodeWordUint = (hex, index = 0) => {
    if (!hex || hex.length < 66 + index * 64) return '0';
    const start = 2 + index * 64;
    return BigInt('0x' + hex.slice(start, start + 64)).toString();
  };
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
      setText('hyd-owner', decodeAddress(await ethCall(OFFICIAL.contracts.agiJobManager, methodId('owner()'))));
      setText('hyd-next-job-id', decodeUint(await ethCall(OFFICIAL.contracts.agiJobManager, methodId('nextJobId()'))));
      setText('hyd-ens-job-manager', decodeAddress(await ethCall(OFFICIAL.contracts.ensJobPages, methodId('jobManager()'))) || 'unavailable');
      setText('hyd-token-symbol', decodeString(await ethCall(OFFICIAL.contracts.agiToken, methodId('symbol()'))) || 'AGI');
      if (walletState.account) {
        const data = methodId('balanceOf(address)') + padHex(BigInt(walletState.account).toString(16));
        setText('hyd-token-balance', decodeUint(await ethCall(OFFICIAL.contracts.agiToken, data)));
      } else {
        setText('hyd-token-balance', '-');
      }
    } catch (error) {
      setText('rpc-status', 'Degraded RPC mode: ' + (error && error.message ? error.message : 'unknown error'));
    }
  };

  const hydrateJobs = async () => {
    const body = document.getElementById('jobs-body');
    const status = document.getElementById('jobs-status');
    if (!body || !status) return;
    body.innerHTML = '';
    try {
      const nextJobId = Number(decodeUint(await ethCall(OFFICIAL.contracts.agiJobManager, methodId('nextJobId()'))));
      if (!Number.isFinite(nextJobId) || nextJobId <= 0) {
        status.textContent = 'No jobs found on chain.';
        return;
      }
      const from = Math.max(0, nextJobId - 25);
      for (let jobId = from; jobId < nextJobId; jobId += 1) {
        const payload = methodId('getJobCore(uint256)') + padHex(jobId);
        const core = await ethCall(OFFICIAL.contracts.agiJobManager, payload);
        const employer = decodeWordAddress(core, 0);
        const agent = decodeWordAddress(core, 1);
        const payout = decodeWordUint(core, 2);
        if (!employer || /^0x0{40}$/i.test(employer)) continue;
        const completed = decodeBool(core, 5);
        const disputed = decodeBool(core, 6);
        const expired = decodeBool(core, 7);
        const statusLabel = completed ? 'Completed' : disputed ? 'Disputed' : expired ? 'Expired' : (agent && !/^0x0{40}$/i.test(agent) ? 'Assigned' : 'Open');
        const row = document.createElement('tr');
        row.innerHTML = '<td>' + jobId + '</td><td>' + statusLabel + '</td><td>' + payout + ' AGI</td><td><code>' + escapeHtml(toChecksumDisplay(employer)) + '</code></td><td><code>' + escapeHtml(toChecksumDisplay(agent)) + '</code></td><td><code>job-' + jobId + '.alpha.jobs.agi.eth</code></td>';
        body.appendChild(row);
      }
      status.textContent = body.children.length ? ('Live rows loaded: ' + body.children.length) : 'No initialized job slots in scanned range.';
    } catch (error) {
      status.textContent = 'Unable to hydrate jobs: ' + (error && error.message ? error.message : 'unknown error');
    }
  };

  const hydrateIdentity = async (attempt = 0) => {
    const status = document.getElementById('hyd-ens-job-manager-status');
    const value = document.getElementById('hyd-ens-job-manager');
    if (!status || !value) return;
    status.textContent = 'resolving';
    const timeoutMs = 4000;
    try {
      const withTimeout = Promise.race([
        ethCall(OFFICIAL.contracts.ensJobPages, methodId('jobManager()')),
        new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), timeoutMs))
      ]);
      const wired = decodeAddress(await withTimeout);
      value.textContent = wired || 'Not exposed by ABI';
      status.textContent = wired && wired.toLowerCase() === OFFICIAL.contracts.agiJobManager.toLowerCase() ? 'verified' : 'mismatch';
    } catch (error) {
      status.textContent = 'error';
      value.textContent = 'Error: ' + (error && error.message ? error.message : 'unknown');
      if (attempt < 1) setTimeout(() => hydrateIdentity(attempt + 1), 800);
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
    if (normalized === '/jobs') hydrateJobs();
    if (normalized === '/identity') hydrateIdentity(0);
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

  const providerDisplayName = (entry) => {
    const info = entry && entry.info ? entry.info : {};
    const provider = entry && entry.provider ? entry.provider : null;
    const rdns = String(info.rdns || '').toLowerCase();
    const name = String(info.name || '').toLowerCase();
    if ((provider && provider.isMetaMask) || rdns.includes('metamask') || name.includes('metamask')) return 'MetaMask';
    if (rdns.includes('phantom') || name.includes('phantom')) return 'Phantom';
    return info.name || 'Injected EVM Wallet';
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
      discovered.push({ provider: window.ethereum, info: { name: 'Injected wallet' } });
    }
    discovered.sort((a, b) => (providerDisplayName(a) === 'MetaMask' ? -1 : 0) - (providerDisplayName(b) === 'MetaMask' ? -1 : 0));
    walletState.providers = discovered;
    walletState.provider = discovered[0] ? discovered[0].provider : null;
    walletState.providerLabel = discovered[0] ? providerDisplayName(discovered[0]) : null;
    bindProviderEvents(walletState.provider);
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
      localStorage.setItem('agijobmanager.wallet.provider', walletState.providerLabel || 'Injected EVM Wallet');
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
    localStorage.removeItem('agijobmanager.wallet.provider');
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
    const providerOptions = walletState.providers.length > 1 ? '<label>Wallet <select id="wallet-provider-select">' + walletState.providers.map((p, i) => '<option value="' + i + '">' + escapeHtml(providerDisplayName(p)) + '</option>').join('') + '</select></label>' : '';
    host.innerHTML = '<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap"><button type="button" id="wallet-connect">' + (walletState.connected ? 'Connected' : 'Connect Wallet') + '</button><button type="button" id="wallet-disconnect">Disconnect / Reset UI</button>' + providerOptions + '<span>Provider: <code>' + safeProviderLabel + '</code></span><span>Account: <code id="wallet-address-value">' + safeAccountDisplay + '</code></span><button type="button" id="wallet-copy" ' + (walletState.account ? '' : 'disabled') + '>Copy</button><span>ENS: <code>' + safeEnsName + '</code></span><span>Chain: <code>' + safeChainDisplay + '</code></span>' + (mismatch ? '<button type="button" id="wallet-switch">Switch to Mainnet</button><strong style="color:#f5b">Wrong network</strong>' : '') + '</div>' + (safeWalletError ? '<p style="color:#ff8080">' + safeWalletError + '</p>' : '') + (fileOrigin ? '<p style="color:#ffd27f">file:// origin: wallet writes require HTTPS hosting.</p>' : '');
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
    if (providerSelect) providerSelect.addEventListener('change', (event) => {
      const idx = Number(event.target && event.target.value);
      const selected = walletState.providers[idx];
      if (!selected) return;
      walletState.provider = selected.provider;
      walletState.providerLabel = providerDisplayName(selected);
      bindProviderEvents(walletState.provider);
      refreshWalletState();
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
  detectProviders().then(refreshWalletState).then(hydrateReadOnly).then(hydrateJobs).then(() => hydrateIdentity(0));
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('#identity-retry') : null;
    if (!target) return;
    event.preventDefault();
    hydrateIdentity(0);
  });
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
