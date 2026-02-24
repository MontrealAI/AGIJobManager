import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const verifierPath = path.resolve(__dirname, '../scripts/verify-ipfs.mjs');
const tmpRoots: string[] = [];

function runVerifierWithHtml(html: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-ipfs-'));
  tmpRoots.push(root);
  const dist = path.join(root, 'dist-ipfs');
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), html, 'utf8');

  return () =>
    execFileSync(process.execPath, [verifierPath], {
      cwd: root,
      stdio: 'pipe',
      encoding: 'utf8'
    });
}

const secureHtml = `<!doctype html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; frame-ancestors 'none'">
<meta name="referrer" content="no-referrer">
</head><body><h1>ok</h1></body></html>`;

afterEach(() => {
  for (const root of tmpRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('verify-ipfs script src attribute hardening', () => {
  it('passes on secure single-file html', () => {
    const run = runVerifierWithHtml(secureHtml);
    expect(run).not.toThrow();
  });


  it('accepts unquoted csp and referrer meta attributes', () => {
    const unquotedMetaHtml = `<!doctype html><html><head>
<meta http-equiv=Content-Security-Policy content="default-src 'self'; frame-ancestors 'none'">
<meta name=referrer content=no-referrer>
</head><body><h1>ok</h1></body></html>`;
    const run = runVerifierWithHtml(unquotedMetaHtml);
    expect(run).not.toThrow();
  });

  it('fails when script uses valueless src attribute', () => {
    const run = runVerifierWithHtml(`${secureHtml}<script src></script>`);
    expect(run).toThrow(/External script references found/);
  });

  it('fails when script uses empty assignment src=', () => {
    const run = runVerifierWithHtml(`${secureHtml}<script src=></script>`);
    expect(run).toThrow(/External script references found/);
  });
});
