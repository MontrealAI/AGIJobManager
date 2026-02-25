import fs from 'node:fs';
import path from 'node:path';

const uiRoot = process.cwd();
const nextHtmlPath = path.join(uiRoot, '.next/server/app/index.html');
const outDir = path.join(uiRoot, 'dist-ipfs');
const outPath = path.join(outDir, 'index.html');

if (!fs.existsSync(nextHtmlPath)) {
  throw new Error(`Next build output missing: ${nextHtmlPath}. Run npm run build first.`);
}

let html = fs.readFileSync(nextHtmlPath, 'utf8');

const resolveLocalPath = (urlPath) => {
  const withoutQuery = urlPath.split('?')[0];
  if (withoutQuery.startsWith('/_next/')) {
    return path.join(uiRoot, '.next', withoutQuery.slice('/_next/'.length));
  }
  if (withoutQuery === '/icon.svg') {
    const candidate = path.join(uiRoot, '.next/server/app/icon.svg.body');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

html = html.replace(/<link\b[^>]*rel=["']preload["'][^>]*>/gi, '');

html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (full, href) => {
  const localPath = resolveLocalPath(href);
  if (!localPath || !fs.existsSync(localPath)) {
    throw new Error(`Stylesheet not found for inlining: ${href}`);
  }
  const css = fs.readFileSync(localPath, 'utf8');
  return `<style>\n${css}\n</style>`;
});

html = html.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi, (full, src) => {
  const localPath = resolveLocalPath(src);
  if (!localPath || !fs.existsSync(localPath)) {
    throw new Error(`Script not found for inlining: ${src}`);
  }
  const js = fs.readFileSync(localPath, 'utf8');
  return `<script>\n${js}\n</script>`;
});

html = html.replace(/<link\b[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["'][^>]*>/i, (full, href) => {
  const localPath = resolveLocalPath(href);
  if (!localPath || !fs.existsSync(localPath)) {
    return '<link rel="icon" href="data:," />';
  }
  const svg = fs.readFileSync(localPath, 'utf8');
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');
  return `<link rel="icon" href="data:image/svg+xml,${encoded}" type="image/svg+xml" sizes="any"/>`;
});

const insertBeforeHeadClose = (snippet) => {
  html = html.replace('</head>', `${snippet}\n</head>`);
};

if (!/http-equiv=["']Content-Security-Policy["']/i.test(html)) {
  insertBeforeHeadClose('  <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; connect-src \'self\' https:; frame-ancestors \'none\'; base-uri \'none\'; form-action \'self\'">');
}

if (!/name=["']referrer["']/i.test(html)) {
  insertBeforeHeadClose('  <meta name="referrer" content="no-referrer">');
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html);

console.log(`Built single-file IPFS artifact from Next output: ${path.relative(uiRoot, outPath)}`);
