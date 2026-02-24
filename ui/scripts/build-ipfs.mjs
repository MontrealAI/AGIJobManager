import fs from 'node:fs';
import path from 'node:path';

const uiRoot = process.cwd();
const repoRoot = path.resolve(uiRoot, '..');
const sourcePath = path.join(repoRoot, 'docs/ui/agijobmanager.html');
const outDir = path.join(uiRoot, 'dist-ipfs');
const outPath = path.join(outDir, 'index.html');

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Source HTML not found: ${sourcePath}`);
}

let html = fs.readFileSync(sourcePath, 'utf8');

const scriptRegex = /<script\s+src=["'](\.[^"']+)["']\s*><\/script>/g;
html = html.replace(scriptRegex, (full, relPath) => {
  const normalized = relPath.replace(/^\.\//, '');
  const scriptPath = path.join(repoRoot, 'docs/ui', normalized);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Referenced script not found: ${scriptPath}`);
  }
  const scriptBody = fs.readFileSync(scriptPath, 'utf8');
  return `<script>\n${scriptBody}\n</script>`;
});

const insertBeforeHeadClose = (snippet) => {
  html = html.replace('</head>', `${snippet}\n</head>`);
};

if (!/http-equiv=["']Content-Security-Policy["']/i.test(html)) {
  insertBeforeHeadClose('  <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https:; connect-src \'self\' https:; frame-ancestors \'none\'; base-uri \'none\'; form-action \'self\'">');
}

if (!/name=["']referrer["']/i.test(html)) {
  insertBeforeHeadClose('  <meta name="referrer" content="no-referrer">');
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html);

console.log(`Built single-file IPFS artifact: ${path.relative(uiRoot, outPath)}`);
