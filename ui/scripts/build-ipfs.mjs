import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const sourcePath = path.join(repoRoot, 'docs/ui/agijobmanager.html');
const outDir = path.join(process.cwd(), 'dist-ipfs');
const outPath = path.join(outDir, 'index.html');

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Missing single-file source: ${sourcePath}`);
}

let html = fs.readFileSync(sourcePath, 'utf8');

html = html.replace(/<script[^>]*\ssrc=(['"])(.*?)\1[^>]*><\/script>/gi, (full, _q, src) => {
  if (/^(https?:|data:|ipfs:|ens:|#)/i.test(src)) {
    throw new Error(`External script source is not allowed in IPFS artifact: ${src}`);
  }
  const scriptPath = path.join(path.dirname(sourcePath), src);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Missing local script for inlining: ${src}`);
  }
  const script = fs.readFileSync(scriptPath, 'utf8');
  return `<script>\n${script}\n</script>`;
});

if (!html.includes('<!DOCTYPE html>')) {
  throw new Error('Source HTML must be a complete document.');
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html, 'utf8');

console.log(`IPFS single-file artifact written: ${path.relative(repoRoot, outPath)}`);
