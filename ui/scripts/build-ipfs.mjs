import fs from 'node:fs';
import path from 'node:path';

const uiRoot = process.cwd();
const repoRoot = path.resolve(uiRoot, '..');
const templatePath = path.join(uiRoot, 'scripts', 'singlefile-template.html');
const outDir = path.join(uiRoot, 'dist-ipfs');
const outPath = path.join(outDir, 'agijobmanager.html');
const repoArtifactPath = path.join(repoRoot, 'agijobmanager.html');

if (!fs.existsSync(templatePath)) {
  throw new Error(`Template missing at ${templatePath}`);
}

const html = fs.readFileSync(templatePath, 'utf8');

if (/data:image\//i.test(html) || /data:font\//i.test(html)) {
  throw new Error('Forbidden data:image/* or data:font/* URI detected in template.');
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html, 'utf8');
console.log(`Wrote ${outPath}`);

if (process.env.BUILD_IPFS_SKIP_ROOT_SYNC === '1') {
  console.log(`Skipped root sync for ${repoArtifactPath}`);
} else {
  fs.writeFileSync(repoArtifactPath, html, 'utf8');
  console.log(`Wrote ${repoArtifactPath}`);
}
