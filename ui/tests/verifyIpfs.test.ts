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

  it('fails when script uses valueless src attribute', () => {
    const run = runVerifierWithHtml(`${secureHtml}<script src></script>`);
    expect(run).toThrow(/External script references found/);
  });

  it('fails when script uses empty assignment src=', () => {
    const run = runVerifierWithHtml(`${secureHtml}<script src=></script>`);
    expect(run).toThrow(/External script references found/);
  });

  it('does not accept CSP/referrer strings only inside script text', () => {
    const html = `<!doctype html><html><head></head><body><script>const a="http-equiv=content-security-policy"; const b="name=referrer";</script></body></html>`;
    const run = runVerifierWithHtml(html);
    expect(run).toThrow(/CSP meta tag is missing/);
  });

  it('fails when non-anchor tags reference remote http(s) assets', () => {
    const run = runVerifierWithHtml(`${secureHtml}<img src="https://cdn.example.com/logo.svg">`);
    expect(run).toThrow(/Relative or unsupported asset references found/);
  });

  it('fails when non-anchor srcset includes remote URLs', () => {
    const run = runVerifierWithHtml(`${secureHtml}<img srcset="https://cdn.example.com/logo-1x.png 1x, https://cdn.example.com/logo-2x.png 2x">`);
    expect(run).toThrow(/Relative or unsupported asset references found/);
  });

  it('fails when CSP meta content is weak', () => {
    const weakCsp = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src *"><meta name="referrer" content="no-referrer"></head><body>ok</body></html>`;
    const run = runVerifierWithHtml(weakCsp);
    expect(run).toThrow(/frame-ancestors 'none'/);
  });

  it('fails when referrer policy is unsafe', () => {
    const unsafeReferrer = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; frame-ancestors 'none'"><meta name="referrer" content="unsafe-url"></head><body>ok</body></html>`;
    const run = runVerifierWithHtml(unsafeReferrer);
    expect(run).toThrow(/Referrer policy meta content must be no-referrer/);
  });

  it('fails when inline CSS contains remote url() references', () => {
    const run = runVerifierWithHtml(`${secureHtml}<style>body{background-image:url(https://cdn.example.com/a.png)}</style>`);
    expect(run).toThrow(/Unsupported CSS url\(\) references found/);
  });


  it('fails when inline style attribute contains remote url() references', () => {
    const run = runVerifierWithHtml(`${secureHtml}<div style="background-image:url(https://cdn.example.com/a.png)"></div>`);
    expect(run).toThrow(/Unsupported inline style url\(\) references found/);
  });

  it('fails when script body performs local sidecar fetches', () => {
    const run = runVerifierWithHtml(`${secureHtml}<script>fetch("./abi/AGIJobManager.json")</script>`);
    expect(run).toThrow(/Local sidecar fetches detected in script bodies/);
  });


  it('fails when script body fetches parent-directory sidecars via template literals', () => {
    const run = runVerifierWithHtml(`${secureHtml}<script>fetch(\`../abi/AGIJobManager.json\`)</script>`);
    expect(run).toThrow(/Local sidecar fetches detected in script bodies/);
  });



  it('fails when script body injects local script src via DOM APIs', () => {
    const run = runVerifierWithHtml(`${secureHtml}<script>const s=document.createElement('script'); s.src='/_next/chunk.js'; document.body.appendChild(s);</script>`);
    expect(run).toThrow(/Local sidecar fetches detected in script bodies/);
  });

});
