import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const uiRoot = process.cwd();
const repoRoot = path.resolve(uiRoot, '..');
const builtHtml = path.join(uiRoot, 'dist-ipfs', 'agijobmanager.html');
const committedHtml = path.join(repoRoot, 'agijobmanager.html');

function createDeterministicBuildEnv() {
  const sanitized = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
  for (const key of Object.keys(sanitized)) {
    if (key.startsWith('NEXT_PUBLIC_')) {
      delete sanitized[key];
    }
  }
  return sanitized;
}

// Rebuild dist artifact without mutating committed root artifact; freshness must compare against currently committed bytes.
const deterministicEnv = createDeterministicBuildEnv();
execSync('npm run build', { cwd: uiRoot, stdio: 'inherit', env: deterministicEnv });
execSync('node scripts/build-ipfs.mjs', {
  cwd: uiRoot,
  stdio: 'inherit',
  env: { ...deterministicEnv, BUILD_IPFS_SKIP_ROOT_SYNC: '1' }
});

if (!fs.existsSync(builtHtml)) {
  throw new Error(`Missing build artifact ${path.relative(repoRoot, builtHtml)} after build:ipfs.`);
}

if (!fs.existsSync(committedHtml)) {
  throw new Error(`Missing committed artifact ${path.relative(repoRoot, committedHtml)}. Copy from ui/dist-ipfs/agijobmanager.html.`);
}

const built = fs.readFileSync(builtHtml);
const committed = fs.readFileSync(committedHtml);
const builtHash = createHash('sha256').update(built).digest('hex');
const committedHash = createHash('sha256').update(committed).digest('hex');

function assertNavigateHashRouteParseable(html, label) {
  const source = html.toString('utf8');
  const declaration = /(?:const|let|var)\s+navigateHashRoute\s*=\s*\([^)]*\)\s*=>\s*\{|function\s+navigateHashRoute\s*\([^)]*\)\s*\{/;
  const declarationMatch = declaration.exec(source);
  if (!declarationMatch) {
    throw new Error(`${label}: navigateHashRoute declaration missing from artifact.`);
  }

  const start = declarationMatch.index + declarationMatch[0].lastIndexOf('{');
  let depth = 0;
  let body = '';
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) {
      body = source.slice(start + 1, i);
      break;
    }
  }

  if (!body) {
    throw new Error(`${label}: navigateHashRoute body is not parseable.`);
  }

  if (!/\bmode\b/.test(body) || !/\brawPushState\b/.test(body) || !/\brawReplaceState\b/.test(body)) {
    throw new Error(`${label}: navigateHashRoute body is missing mode/rawPushState/rawReplaceState invariants.`);
  }

  if (/\brawHash\b/.test(body)) {
    throw new Error(`${label}: navigateHashRoute body unexpectedly references rawHash.`);
  }
}

function assertSingleTerminalClose(html, label) {
  const source = html.toString('utf8');
  const closeTag = '</body></html>';
  const firstClose = source.indexOf(closeTag);
  const lastClose = source.lastIndexOf(closeTag);

  if (firstClose < 0) {
    throw new Error(`${label}: terminal ${closeTag} marker missing.`);
  }
  if (firstClose !== lastClose) {
    throw new Error(`${label}: duplicate ${closeTag} marker detected.`);
  }
  if (source.slice(firstClose + closeTag.length).trim().length > 0) {
    throw new Error(`${label}: unexpected trailing content after terminal ${closeTag}.`);
  }
}

function assertRouterBootstrapScript(html, label) {
  const source = html.toString('utf8');
  const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

  const routerScript = scripts.find((body) =>
    body.includes('const normalizeHashHref = (input) => {')
    && body.includes('const baseRoutes = new Set([')
    && body.includes('const sanitizeRoutePath = (routePath) => {')
    && body.includes('const navigateHashRoute = (nextRoute, options = {}) => {')
    && body.includes("window.addEventListener('hashchange'")
  );

  if (!routerScript) {
    throw new Error(`${label}: router bootstrap script with normalizeHashHref/navigateHashRoute/hashchange was not found.`);
  }
  if (routerScript.includes('<script') || routerScript.includes('</script><script>')) {
    throw new Error(`${label}: router bootstrap script appears interleaved with script tags.`);
  }

  if (!routerScript.includes('const hashRoute = normalizeHashHref(href);')) {
    throw new Error(`${label}: click interception no longer uses normalizeHashHref(href) in router bootstrap script.`);
  }

  if (!routerScript.includes('const startupHashLooksLeaky = (rawHash, lowerHash) => {')) {
    throw new Error(`${label}: startupHashLooksLeaky helper missing from router bootstrap script.`);
  }
  if (!routerScript.includes('if (startupHashLooksLeaky(rawHash, lowerHash)) return \'#/\';')) {
    throw new Error(`${label}: getStartupCanonicalHash no longer routes leaky startup hashes through startupHashLooksLeaky.`);
  }

  const navigateHashRouteIndex = routerScript.indexOf('const navigateHashRoute = (nextRoute, options = {}) => {');
  const toHashUrlIndex = routerScript.indexOf('const toHashUrl = (routeInput) => {');
  const dispatchRouteUpdateIndex = routerScript.indexOf('const dispatchRouteUpdate = (state) => {');
  if (toHashUrlIndex < 0 || dispatchRouteUpdateIndex < 0 || navigateHashRouteIndex < 0) {
    throw new Error(`${label}: router bootstrap missing toHashUrl/dispatchRouteUpdate/navigateHashRoute declarations.`);
  }

  const baseRoutesIndex = routerScript.indexOf('const baseRoutes = new Set([');
  const sanitizeRoutePathIndex = routerScript.indexOf('const sanitizeRoutePath = (routePath) => {');
  if (baseRoutesIndex < 0 || sanitizeRoutePathIndex < 0) {
    throw new Error(`${label}: router bootstrap missing baseRoutes/sanitizeRoutePath declarations.`);
  }
  if (baseRoutesIndex > sanitizeRoutePathIndex || sanitizeRoutePathIndex > navigateHashRouteIndex) {
    throw new Error(`${label}: router bootstrap helper ordering changed; sanitizeRoutePath/navigateHashRoute may resolve incorrectly.`);
  }

  const malformedHtmlSuffixBranch = /if \(lower === 'agijobmanager' \|\| lower === 'index\.html' \|\| lower === 'agijobmanager\.html'\) \{\s*if \(lower\.endsWith\('\.html'\)\) \{/m;
  if (malformedHtmlSuffixBranch.test(routerScript)) {
    throw new Error(`${label}: malformed recoverPrefixedRoute HTML guard detected (may trigger illegal top-level continue).`);
  }

  if (!routerScript.includes("if (lower.endsWith('.html')) {\n        continue;\n      }\n      normalizedSegments.push(segment);")) {
    throw new Error(`${label}: recoverPrefixedRoute .html suffix branch no longer matches expected guarded-continue structure.`);
  }

  const parseCandidate = routerScript
    .replace(/<\/script>\s*<script\b[^>]*>/gi, '')
    .replace(/<\/?script[^>]*>/gi, '')
    .trim();
  const parseInput = parseCandidate
    .replace(/self\.__next_f[^\n]*(?:\n|$)/g, '')
    .replace(/\(self\.webpackChunk_N_E=self\.webpackChunk_N_E\|\|\[\]\)\.push\([\s\S]*?\);?/g, '');
  try {
    // Parse-only guard: catches syntax regressions like illegal top-level `continue` in bootstrap script.
    // eslint-disable-next-line no-new, no-new-func
    new Function(parseInput);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label}: router bootstrap script is not syntactically parseable (${detail}).`);
  }
}

assertNavigateHashRouteParseable(built, 'dist-ipfs/agijobmanager.html');
assertNavigateHashRouteParseable(committed, 'agijobmanager.html');

assertSingleTerminalClose(built, 'dist-ipfs/agijobmanager.html');
assertSingleTerminalClose(committed, 'agijobmanager.html');
assertRouterBootstrapScript(built, 'dist-ipfs/agijobmanager.html');
assertRouterBootstrapScript(committed, 'agijobmanager.html');

if (Buffer.compare(built, committed) !== 0) {
  throw new Error(
    `agijobmanager.html is stale (built sha256=${builtHash}, committed sha256=${committedHash}). Run ` +
      '`cd ui && npm run build:ipfs` to sync root artifact and commit the result.'
  );
}

console.log(
  `Committed agijobmanager.html matches ui/dist-ipfs/agijobmanager.html (sha256=${builtHash}, bytes=${built.length}).`
);
