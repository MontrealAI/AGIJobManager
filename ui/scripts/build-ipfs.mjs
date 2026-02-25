import fs from 'node:fs';
import path from 'node:path';

const uiRoot = process.cwd();
const nextServerRoot = path.join(uiRoot, '.next', 'server', 'app');
const nextStaticRoot = path.join(uiRoot, '.next', 'static');
const sourcePath = path.join(nextServerRoot, 'index.html');
const outDir = path.join(uiRoot, 'dist-ipfs');
const outPath = path.join(outDir, 'index.html');

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Source HTML not found: ${sourcePath}. Run npm run build first.`);
}

let html = fs.readFileSync(sourcePath, 'utf8');

function resolveAsset(assetUrl) {
  const withoutQuery = assetUrl.split('?')[0];
  if (withoutQuery.startsWith('/_next/static/')) {
    return path.join(nextStaticRoot, withoutQuery.replace('/_next/static/', ''));
  }
  if (withoutQuery === '/icon.svg') {
    return path.join(uiRoot, 'src', 'app', 'icon.svg');
  }
  return null;
}

html = html.replace(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, (full, src) => {
  const resolved = resolveAsset(src);
  if (!resolved || !fs.existsSync(resolved)) {
    throw new Error(`Unsupported or missing script asset during IPFS build: ${src}`);
  }
  return `<script>\n${fs.readFileSync(resolved, 'utf8')}\n</script>`;
});

html = html.replace(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (full, href) => {
  const resolved = resolveAsset(href);
  if (!resolved || !fs.existsSync(resolved)) {
    throw new Error(`Unsupported or missing stylesheet asset during IPFS build: ${href}`);
  }
  return `<style>\n${fs.readFileSync(resolved, 'utf8')}\n</style>`;
});

html = html.replace(/<link\s+[^>]*rel=["']preload["'][^>]*as=["']script["'][^>]*>/gi, '');

html = html.replace(/<link\s+[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (full, href) => {
  const resolved = resolveAsset(href);
  if (!resolved || !fs.existsSync(resolved)) {
    throw new Error(`Unsupported or missing icon asset during IPFS build: ${href}`);
  }
  const svg = fs.readFileSync(resolved, 'utf8');
  const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return `<link rel="icon" href="${dataUri}" type="image/svg+xml" sizes="any"/>`;
});

const insertBeforeHeadClose = (snippet) => {
  html = html.replace('</head>', `${snippet}\n</head>`);
};

if (!/http-equiv=["']Content-Security-Policy["']/i.test(html)) {
  insertBeforeHeadClose('  <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; connect-src \'self\'; frame-ancestors \'none\'; base-uri \'none\'; form-action \'self\'">');
}

if (!/name=["']referrer["']/i.test(html)) {
  insertBeforeHeadClose('  <meta name="referrer" content="no-referrer">');
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html);

console.log(`Built single-file IPFS artifact: ${path.relative(uiRoot, outPath)}`);
