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
  fs.writeFileSync(path.join(dist, 'agijobmanager.html'), html, 'utf8');

  return () =>
    execFileSync(process.execPath, [verifierPath], {
      cwd: root,
      stdio: 'pipe',
      encoding: 'utf8'
    });
}

function extractArrowFunctionBody(source: string, constName: string): string | null {
  const declarationPattern = new RegExp(`\\b(?:const|let|var)\\s+${constName}\\s*=\\s*\\(`);
  const markerMatch = declarationPattern.exec(source);
  const markerIndex = markerMatch?.index ?? -1;
  if (markerIndex < 0) return null;

  const openingBraceIndex = source.indexOf('{', markerIndex);
  if (openingBraceIndex < 0) return null;

  let depth = 0;
  for (let i = openingBraceIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openingBraceIndex + 1, i);
      }
    }
  }

  return null;
}

function extractArrowFunctionBodyFromHtml(html: string, constName: string): string | null {
  const declarationPattern = new RegExp(`\\b(?:const|let|var)\\s+${constName}\\s*=\\s*\\(`);
  const scriptBodies = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const hasHashchangeListener = /\bwindow\.addEventListener\(\s*['"]hashchange['"]/.test(html);

  const candidates = scriptBodies
    .filter((body) => declarationPattern.test(body))
    .map((body) => extractArrowFunctionBody(body, constName))
    .filter((body): body is string => Boolean(body));

  if (candidates.length === 0) return null;

  const strongestCandidate = candidates.find((body) => /\brawReplaceState\b/.test(body) && /\brawPushState\b/.test(body));
  return strongestCandidate ?? (hasHashchangeListener ? candidates[0] : null);
}

const secureHtml = `<!doctype html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'">
<meta name="referrer" content="no-referrer">
</head><body><h1>ok</h1><script>window.__IPFS_BOOTSTRAP_ROUTE__='/jobs';window.addEventListener('hashchange',()=>{if(window.location.hash){history.pushState({},'',window.location.hash.slice(1));}});</script></body></html>`;

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

  it('fails when CSP allows unsafe-eval', () => {
    const weakCsp = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-eval'"><meta name="referrer" content="no-referrer"></head><body><script>if(window.location.hash){history.pushState({},'',window.location.hash.slice(1));}</script></body></html>`;
    const run = runVerifierWithHtml(weakCsp);
    expect(run).toThrow(/must not include 'unsafe-eval'/);
  });

  it('fails when CSP is missing object-src none', () => {
    const weakCsp = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>if(window.location.hash){history.pushState({},'',window.location.hash.slice(1));}</script></body></html>`;
    const run = runVerifierWithHtml(weakCsp);
    expect(run).toThrow(/must include object-src 'none'/);
  });

  it('fails when referrer policy is unsafe', () => {
    const unsafeReferrer = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="unsafe-url"></head><body><script>if(window.location.hash){history.pushState({},'',window.location.hash.slice(1));}</script></body></html>`;
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


  it('fails when script body injects local script src via local-path variable', () => {
    const run = runVerifierWithHtml(`${secureHtml}<script>const p='/_next/chunk.js'; const s=document.createElement('script'); s.src=p; document.body.appendChild(s);</script>`);
    expect(run).toThrow(/Local sidecar fetches detected in script bodies/);
  });


  it('fails when script body injects local script src via object-member path', () => {
    const run = runVerifierWithHtml(`${secureHtml}<script>const cfg={src:'/_next/chunk.js'}; const s=document.createElement('script'); s.src=cfg.src; document.body.appendChild(s);</script>`);
    expect(run).toThrow(/Local sidecar fetches detected in script bodies/);
  });


  it('fails when script body injects local script src via concatenated local-path variable', () => {
    const run = runVerifierWithHtml(`${secureHtml}<script>const base='/_next/'; const file='chunk.js'; const s=document.createElement('script'); s.src=base+file; document.body.appendChild(s);</script>`);
    expect(run).toThrow(/Local sidecar fetches detected in script bodies/);
  });


  it('fails when script body injects local script src via intermediate variable', () => {
    const run = runVerifierWithHtml(`${secureHtml}<script>const base='/_next/'; const file='chunk.js'; const url=base+file; const s=document.createElement('script'); s.src=url; document.body.appendChild(s);</script>`);
    expect(run).toThrow(/Local sidecar fetches detected in script bodies/);
  });


  it('fails when routing tokens appear only inside string literals', () => {
    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>const a='window.location.hash'; const b='history.pushState'; const c='hashchange';</script></body></html>`);
    expect(run).toThrow(/Hash routing guard is missing/);
  });

  it('passes when routing uses hashchange listener without bootstrap sentinel variable', () => {
    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>window.addEventListener('hashchange',()=>{if(window.location.hash){history.pushState({},'',window.location.hash.slice(1));}});</script></body></html>`);
    expect(run).not.toThrow();
  });

  it('fails when hashchange hook only appears in comments', () => {
    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>if(window.location.hash){history.pushState({},'',window.location.hash.slice(1));}// window.addEventListener('hashchange',()=>{})</script></body></html>`);
    expect(run).toThrow(/Hash routing guard is missing/);
  });

  it('fails when hash routing bootstrap logic is absent', () => {
    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body>ok</body></html>`);
    expect(run).toThrow(/Hash routing guard is missing/);
  });


  it('fails when bootstrap hash script is prematurely terminated', () => {
    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body>
      <script>(function(){const detectGatewayBase=(pathname)=>pathname;const rawHash=window.location.hash||'';if(!rawHash.startsWith('#/')) return;</script>
      <script>window.addEventListener('hashchange',()=>{if(window.location.hash){history.pushState({},'',window.location.hash.slice(1));}});</script>
    </body></html>`);
    expect(run).toThrow(/IPFS bootstrap script is incomplete or malformed/);
  });

  it('fails when navigateHashRoute references rawHash from the hashchange scope', () => {
    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>
      const navigateHashRoute = (routePath, mode) => {
        if (!routePath || !routePath.startsWith('/')) return;
        if (!rawHash.startsWith('#/')) return;
        if (mode === 'replace') { history.replaceState({}, '', routePath); } else { history.pushState({}, '', routePath); }
      };
      window.addEventListener('hashchange', () => {
        const rawHash = window.location.hash || '';
        navigateHashRoute(rawHash.slice(1), 'replace');
      });
      if (window.location.hash) { history.pushState({}, '', window.location.hash.slice(1)); }
    </script></body></html>`);
    expect(run).toThrow(/references rawHash inside navigateHashRoute/);
  });


  it('fails when navigateHashRoute is present but unparseable', () => {
    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>
      const navigateHashRoute = (routePath, mode) => {
        if (!routePath || !routePath.startsWith('/')) return;
        if (!rawHash.startsWith('#/')) return;
      // truncated body intentionally (missing closing brace)
      window.addEventListener('hashchange', () => {
        const rawHash = window.location.hash || '';
        if (!rawHash.startsWith('#/')) return;
        history.pushState({}, '', rawHash.slice(1));
      });
    </script></body></html>`);
    expect(run).toThrow(/Unable to parse navigateHashRoute body/);
  });

  it('fails when navigateHashRoute bootstrap is split across script tags', () => {
    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body>
      <script>
      const rawPushState = history.pushState.bind(history);
      const rawReplaceState = history.replaceState.bind(history);
      const navigateHashRoute = (routePath, mode) => {
        if (!routePath || !routePath.startsWith('/')) return;
        if (mode === 'replace') {
          rawReplaceState(history.state, '', routePath);
      </script><script>
        } else {
          rawPushState(history.state, '', routePath);
        }
      };
      window.addEventListener('hashchange', () => {
        const rawHash = window.location.hash || '';
        if (!rawHash.startsWith('#/')) return;
        navigateHashRoute(rawHash.slice(1), 'replace');
      });
      </script>
    </body></html>`);
    expect(run).toThrow(/Unable to parse navigateHashRoute body|IPFS bootstrap script is incomplete or malformed/);
  });

  it('fails when navigateHashRoute lacks push/replace rewrite logic', () => {

    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>
      const navigateHashRoute = (routePath, mode) => {
        if (!routePath || !routePath.startsWith('/')) return;
      };
      window.addEventListener('hashchange', () => {
        const rawHash = window.location.hash || '';
        if (!rawHash.startsWith('#/')) return;
        navigateHashRoute(rawHash.slice(1), 'replace');
      });
      if (window.location.hash) { history.pushState({}, '', window.location.hash.slice(1)); }
    </script></body></html>`);
    expect(run).toThrow(/missing required push\/replace history rewrite logic/);
  });


  it('parses navigateHashRoute with minified declaration spacing', () => {
    const html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>const rawPushState=history.pushState.bind(history);const rawReplaceState=history.replaceState.bind(history);const navigateHashRoute=(routePath,mode)=>{if(!routePath||!routePath.startsWith('/'))return;if(mode==='replace'){rawReplaceState(history.state,'',routePath);}else{rawPushState(history.state,'',routePath);}};window.addEventListener('hashchange',()=>{const rawHash=window.location.hash||'';if(!rawHash.startsWith('#/'))return;navigateHashRoute(rawHash.slice(1),'replace');});</script></body></html>`;
    const navigateBody = extractArrowFunctionBodyFromHtml(html, 'navigateHashRoute');
    expect(navigateBody).not.toBeNull();
    const body = navigateBody ?? '';
    expect(body).toMatch(/\bmode\b/);
    expect(body).toMatch(/\brawReplaceState\b/);
    expect(body).toMatch(/\brawPushState\b/);
    expect(body).not.toMatch(/\brawHash\b/);
  });

  it('committed artifact keeps rawHash out of navigateHashRoute helper', () => {
    const artifactPath = path.resolve(__dirname, '../../agijobmanager.html');
    const artifactHtml = fs.readFileSync(artifactPath, 'utf8');
    const navigateBody = extractArrowFunctionBodyFromHtml(artifactHtml, 'navigateHashRoute');
    expect(navigateBody, 'navigateHashRoute body should be parseable in committed artifact').not.toBeNull();

    const body = navigateBody ?? '';
    expect(body).not.toContain('</script>');
    expect(body).not.toMatch(/\brawHash\b/);
    expect(body).toMatch(/\bmode\b/);
    expect(body).toMatch(/\brawReplaceState\b/);
    expect(body).toMatch(/\brawPushState\b/);
  });

  it('passes when navigateHashRoute only uses its own inputs', () => {
    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>
      const navigateHashRoute = (routePath, mode) => {
        if (!routePath || !routePath.startsWith('/')) return;
        if (mode === 'replace') { history.replaceState({}, '', routePath); } else { history.pushState({}, '', routePath); }
      };
      window.addEventListener('hashchange', () => {
        const rawHash = window.location.hash || '';
        if (!rawHash.startsWith('#/')) return;
        navigateHashRoute(rawHash.slice(1), 'replace');
      });
      if (window.location.hash) { history.pushState({}, '', window.location.hash.slice(1)); }
    </script></body></html>`);
    expect(run).not.toThrow();
  });

});
