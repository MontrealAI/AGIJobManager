import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const uiRoot = process.cwd();
const artifact = path.join(uiRoot, 'dist-ipfs', 'agijobmanager.html');

function normalizeHtml(html) {
  return html
    // Next.js injects a per-build identifier in the streamed bootstrap payload.
    .replace(/"buildId":"[^"]+"/g, '"buildId":"<normalized-build-id>"')
    .replace(/\\"buildId\\":\\"[^\\"]+\\"/g, '\\"buildId\\":\\"<normalized-build-id>\\"');
}

function runBuild() {
  execSync('npm run build:ipfs', { cwd: uiRoot, stdio: 'inherit' });
  if (!fs.existsSync(artifact)) {
    throw new Error('Expected artifact missing after build: dist-ipfs/agijobmanager.html');
  }
  const bytes = fs.readFileSync(artifact);
  const normalized = Buffer.from(normalizeHtml(bytes.toString('utf8')), 'utf8');
  return {
    bytes,
    hash: crypto.createHash('sha256').update(bytes).digest('hex'),
    normalizedHash: crypto.createHash('sha256').update(normalized).digest('hex')
  };
}

const first = runBuild();
const second = runBuild();

if (!first.bytes.equals(second.bytes)) {
  if (first.normalizedHash !== second.normalizedHash) {
    throw new Error([
      'IPFS artifact is not deterministic across two consecutive builds (after normalization).',
      `First hash:          ${first.hash}`,
      `Second hash:         ${second.hash}`,
      `First normalized:    ${first.normalizedHash}`,
      `Second normalized:   ${second.normalizedHash}`
    ].join('\n'));
  }

  console.log([
    'Deterministic check passed with controlled normalization for Next.js buildId.',
    `First raw hash:       ${first.hash}`,
    `Second raw hash:      ${second.hash}`,
    `Stable normalized:    ${first.normalizedHash}`
  ].join('\n'));
  process.exit(0);
}

console.log(`Deterministic build verified. SHA-256: ${first.hash}`);
