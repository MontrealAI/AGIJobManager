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

// Always rebuild from the current environment to avoid stale artifacts from earlier workflow steps.
execSync('npm run build:ipfs', {
  cwd: uiRoot,
  stdio: 'inherit',
  env: { ...createDeterministicBuildEnv(), SKIP_ROOT_ARTIFACT_SYNC: '1' }
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
    && body.includes('const navigateHashRoute = (routePath, mode) => {')
    && body.includes("window.addEventListener('hashchange'")
  );

  if (!routerScript) {
    throw new Error(`${label}: router bootstrap script with normalizeHashHref/navigateHashRoute/hashchange was not found.`);
  }
  if (routerScript.includes('<script') || routerScript.includes('</script><script>')) {
    throw new Error(`${label}: router bootstrap script appears interleaved with script tags.`);
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
      '`cd ui && npm run build:ipfs` and commit the synchronized repository artifact.'
  );
}

console.log(
  `Committed agijobmanager.html matches ui/dist-ipfs/agijobmanager.html (sha256=${builtHash}, bytes=${built.length}).`
);
