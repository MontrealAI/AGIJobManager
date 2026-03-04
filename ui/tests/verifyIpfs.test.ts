import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const verifierPath = path.resolve(__dirname, '../scripts/verify-ipfs.mjs');
const tmpRoots: string[] = [];

function runVerifierWithHtml(html: string, options?: { rootHtml?: string; writeRoot?: boolean }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-ipfs-'));
  tmpRoots.push(root);
  const dist = path.join(root, 'dist-ipfs');
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, 'agijobmanager.html'), html, 'utf8');

  const writeRoot = options?.writeRoot ?? true;
  if (writeRoot) {
    const rootHtml = options?.rootHtml ?? html;
    fs.writeFileSync(path.join(path.resolve(root, '..'), 'agijobmanager.html'), rootHtml, 'utf8');
  }

  return () =>
    execFileSync(process.execPath, [verifierPath], {
      cwd: root,
      stdio: 'pipe',
      encoding: 'utf8'
    });
}


function stripKnownNextScriptInterleave(source: string): string | null {
  if (!source.includes('</script>')) return source;
  const hasNextMarkers = /__next_f|_next\/static|buildId|webpackChunk_N_E|_N_E=/.test(source);
  if (!hasNextMarkers) return null;

  const withoutScriptTags = source.replace(/<\/?script[^>]*>/gi, '');
  return withoutScriptTags.replace(/self\.__next_f[^\n]*(?:\n|$)/g, '');
}

function normalizeKnownNextInterleaves(source: string): string {
  if (!source.includes('</script>')) return source;
  return source
    .replace(/<script\b[^>]*>\s*(?:["']use strict["']\s*;\s*)?[-!;]*\s*\(self\.webpackChunk_N_E=self\.webpackChunk_N_E\|\|\[\]\)\.push\([\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*>\s*self\.__next_f\.push\([\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*>\s*\(self\.__next_f\s*=\s*self\.__next_f\s*\|\|\s*\[\]\)\.push\(\[0\]\)\s*;\s*self\.__next_f\.push\(\[2\s*,\s*null\]\)\s*<\/script>/gi, '')
    .replace(/<\/script>\s*<script\b[^>]*>/gi, '');
}

function extractArrowFunctionBody(source: string, constName: string): string | null {
  const declarationPatterns = [
    new RegExp(`\\b(?:const|let|var)\\s+${constName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{`),
    new RegExp(`\\bfunction\\s+${constName}\\s*\\([^)]*\\)\\s*\\{`),
    new RegExp(`\\b${constName}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{`),
    new RegExp(`\\b${constName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{`)
  ];
  const matchedDeclaration = declarationPatterns
    .map((pattern) => pattern.exec(source))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];
  if (!matchedDeclaration) return null;

  const openingBraceIndex = (matchedDeclaration.index ?? 0)
    + matchedDeclaration[0].lastIndexOf('{');
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

function extractArrowFunctionBodies(source: string, constName: string): string[] {
  const declarationPattern = new RegExp(
    `\\b(?:const|let|var)\\s+${constName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{|\\bfunction\\s+${constName}\\s*\\([^)]*\\)\\s*\\{|\\b${constName}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{|\\b${constName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{`,
    'g'
  );

  const bodies: string[] = [];
  for (const declarationMatch of source.matchAll(declarationPattern)) {
    const openingBraceIndex = (declarationMatch.index ?? 0)
      + declarationMatch[0].lastIndexOf('{');
    if (openingBraceIndex < 0) continue;

    let depth = 0;
    for (let i = openingBraceIndex; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          bodies.push(source.slice(openingBraceIndex + 1, i));
          break;
        }
      }
    }
  }

  return bodies;
}




function assertInlineScriptsParseable(html: string): void {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    const attrs = match[1] ?? '';
    const body = match[2] ?? '';
    if (/type=["']application\/(?:ld\+json|json)["']/i.test(attrs)) continue;
    if (/id=["']__NEXT_DATA__["']/i.test(attrs)) continue;
    expect(() => new Function(body)).not.toThrow();
  }
}

function extractBootstrapScripts(html: string): string[] {
  return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .filter((body) => body.includes('const detectGatewayBase = (pathname) => {'));
}

function extractRouterBootstrapScript(html: string): string | null {
  const scriptBodies = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  return scriptBodies.find((body) => (
    body.includes('const normalizeHashHref = (input) => {')
    && body.includes('const navigateHashRoute = (nextRoute, options = {}) => {')
    && body.includes("addEventListener('hashchange'")
  )) ?? null;
}

function extractArrowFunctionBodyFromHtml(html: string, constName: string): string | null {
  const declarationPattern = new RegExp(`\\b(?:const|let|var|function)\\s+${constName}\\b|\\b${constName}\\s*=\\s*(?:function|\\()`, 'm');
  const scriptBodies = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const hasHashchangeListener = /\b(?:window\.)?addEventListener\(\s*['"]hashchange['"]/.test(html);

  if (!hasHashchangeListener) {
    return null;
  }

  const candidates = scriptBodies
    .filter((body) => declarationPattern.test(body))
    .filter((body) => /\b(?:window\.)?addEventListener\(\s*['"]hashchange['"]|\brawPushState\b|\brawReplaceState\b/.test(body))
    .map((body) => extractArrowFunctionBody(body, constName))
    .filter((body): body is string => Boolean(body));

  const strongestCandidate = candidates.find((body) => /\brawReplaceState\b/.test(body) && /\brawPushState\b/.test(body));
  if (strongestCandidate) return strongestCandidate;
  if (candidates.length > 0) return candidates[0];

  // Deterministic fallback for committed artifacts:
  // inspect each declaration window and only accept a clean helper body.
  const fallbackDeclarationPattern = new RegExp(
    String.raw`(?:const|let|var)\s+${constName}\s*=\s*\([^)]*\)\s*=>\s*\{|function\s+${constName}\s*\([^)]*\)\s*\{`,
    'g'
  );
  const hashchangePattern = /(?:window\.)?addEventListener\(\s*['"`]hashchange['"`]/g;

  for (const declarationMatch of html.matchAll(fallbackDeclarationPattern)) {
    const declarationIndex = declarationMatch.index ?? -1;
    if (declarationIndex < 0) continue;

    hashchangePattern.lastIndex = declarationIndex;
    for (let hashMatch = hashchangePattern.exec(html); hashMatch; hashMatch = hashchangePattern.exec(html)) {
      const hashchangeIndex = hashMatch.index;
      if (hashchangeIndex <= declarationIndex) continue;

      const helperWindow = html.slice(declarationIndex, hashchangeIndex);
      const normalizedWindow = stripKnownNextScriptInterleave(helperWindow);
      if (!normalizedWindow) continue;

      const candidateBody = extractArrowFunctionBody(normalizedWindow, constName);
      if (
        candidateBody
        && !candidateBody.includes('</script>')
        && !/\brawHash\b/.test(candidateBody)
        && /\bmode\b/.test(candidateBody)
        && /\brawReplaceState\b/.test(candidateBody)
        && /\brawPushState\b/.test(candidateBody)
      ) {
        return candidateBody;
      }
    }
  }

  const normalizedHtml = stripKnownNextScriptInterleave(normalizeKnownNextInterleaves(html));
  if (normalizedHtml) {
    const directBodies = extractArrowFunctionBodies(normalizedHtml, constName);
    for (const directBody of directBodies) {
      if (
        directBody
        && !directBody.includes('</script>')
        && !/\brawHash\b/.test(directBody)
        && /\bmode\b/.test(directBody)
        && /\brawReplaceState\b/.test(directBody)
        && /\brawPushState\b/.test(directBody)
      ) {
        return directBody;
      }
    }
  }

  const hasFrameworkMarkers = /__next_f|_next\/static|buildId|webpackChunk_N_E|_N_E=/.test(html);
  if (hasFrameworkMarkers) {
    const aggressivelyNormalizedHtml = html
      .replace(/<\/script>\s*<script\b[^>]*>/gi, '')
      .replace(/<\/?script[^>]*>/gi, '')
      .replace(/self\.__next_f[^\n]*(?:\n|$)/g, '');

    const directBodies = extractArrowFunctionBodies(aggressivelyNormalizedHtml, constName);
    for (const directBody of directBodies) {
      if (
        directBody
        && !directBody.includes('</script>')
        && !/\brawHash\b/.test(directBody)
        && /\bmode\b/.test(directBody)
        && /\brawReplaceState\b/.test(directBody)
        && /\brawPushState\b/.test(directBody)
      ) {
        return directBody;
      }
    }
  }

  return null;
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

  it('passes when repository agijobmanager.html matches dist artifact', () => {
    const run = runVerifierWithHtml(secureHtml, { rootHtml: secureHtml });
    expect(run).not.toThrow();
  });

  it('fails when repository agijobmanager.html is stale', () => {
    const run = runVerifierWithHtml(secureHtml, { rootHtml: `${secureHtml}\n<!-- stale -->` });
    expect(run).toThrow(/Repository agijobmanager\.html is stale/);
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
      const navigateHashRoute = (nextRoute, options = {}) => {
        if (!nextRoute || !nextRoute.startsWith('/')) return;
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
      const navigateHashRoute = (nextRoute, options = {}) => {
        if (!nextRoute || !nextRoute.startsWith('/')) return;
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
      const navigateHashRoute = (nextRoute, options = {}) => {
        if (!nextRoute || !nextRoute.startsWith('/')) return;
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
    expect(run).toThrow(/Unable to parse navigateHashRoute body|IPFS bootstrap script is incomplete or malformed|invokes navigateHashRoute but no navigateHashRoute declaration exists in the same script body/);
  });


  it('fails when router handlers call navigateHashRoute but helper declaration is missing', () => {
    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>
      const normalizeHashHref = (input) => input?.startsWith('#/') ? input : null;
      window.addEventListener('hashchange', () => {
        const rawHash = window.location.hash || '';
        if (!rawHash.startsWith('#/')) return;
        navigateHashRoute(rawHash.slice(1), 'replace');
      });
      document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (!target) return;
        const href = target.getAttribute('href') || '';
        const hashRoute = normalizeHashHref(href);
        if (!hashRoute) return;
        navigateHashRoute(routePath, { mode: 'push' });
      }, true);
    </script></body></html>`);

    expect(run).toThrow(/Router bootstrap script must keep normalizeHashHref, navigateHashRoute, and click\/hash handlers in one parseable script body|Hash routing guard is missing|invokes navigateHashRoute but no navigateHashRoute declaration exists in the same script body/);
  });

  it('fails when navigateHashRoute is invoked in a script body without local declaration', () => {
    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>
      window.addEventListener('hashchange', () => {
        const rawHash = window.location.hash || '';
        if (!rawHash.startsWith('#/')) return;
        navigateHashRoute(rawHash.slice(1), 'replace');
      });
      history.pushState({}, '', '/jobs');
    </script></body></html>`);

    expect(run).toThrow(/invokes navigateHashRoute but no navigateHashRoute declaration exists in the same script body/);
  });

  it('fails when a leaked hashUrl guard appears at top-level near click interception code', () => {
    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>
      const normalizeHashHref = (input) => input?.startsWith('#/') ? input : null;
      const rawReplaceState = history.replaceState.bind(history);

      if (!hashUrl) return;
      suppressRewrite = true;
      rawReplaceState(history.state, '', hashUrl);

      document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (!target) return;
        const href = target.getAttribute('href') || '';
        const hashRoute = normalizeHashHref(href);
        if (!hashRoute) return;
        navigateHashRoute(routePath, { mode: 'push' });
      }, true);
    </script></body></html>`);

    expect(run).toThrow(/Router bootstrap script must keep normalizeHashHref, navigateHashRoute, and click\/hash handlers in one parseable script body|Hash routing guard is missing|invokes navigateHashRoute but no navigateHashRoute declaration exists in the same script body/);
  });

  it('fails when navigateHashRoute lacks push/replace rewrite logic', () => {

    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>
      const navigateHashRoute = (nextRoute, options = {}) => {
        if (!nextRoute || !nextRoute.startsWith('/')) return;
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


  it('does not stitch navigateHashRoute across script tag boundaries', () => {
    const html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body>
      <script>
      const navigateHashRoute = (nextRoute, options = {}) => {
        if (!nextRoute || !nextRoute.startsWith('/')) return;
        if (mode === 'replace') {
          history.replaceState({}, '', routePath);
      </script><script>
        } else {
          history.pushState({}, '', routePath);
        }
      };
      window.addEventListener('hashchange', () => {
        const rawHash = window.location.hash || '';
        if (!rawHash.startsWith('#/')) return;
      });
      </script>
    </body></html>`;

    expect(extractArrowFunctionBodyFromHtml(html, 'navigateHashRoute')).toBeNull();
  });



  it('fallback parses minified helper declaration across known Next interleave', () => {
    const html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>
      const rawPushState = history.pushState.bind(history);
      const rawReplaceState = history.replaceState.bind(history);
      const navigateHashRoute=(routePath,mode)=>{if(!routePath||!routePath.startsWith('/'))return;if(mode==='replace'){rawReplaceState(history.state,'',routePath);}else{rawPushState(history.state,'',routePath);}}
      </script><script>(self.__next_f=self.__next_f||[]).push([0]);self.__next_f.push([2,null])</script><script>self.__next_f.push([1,"buildId:_next/static __next_f"])</script><script>
      ;window.addEventListener("hashchange",()=>{const rawHash=window.location.hash||'';if(!rawHash.startsWith('#/'))return;navigateHashRoute(rawHash.slice(1),'replace');});
    </script></body></html>`;

    const navigateBody = extractArrowFunctionBodyFromHtml(html, 'navigateHashRoute');
    expect(navigateBody).not.toBeNull();
    const body = navigateBody ?? '';
    expect(body).not.toContain('</script>');
    expect(body).not.toMatch(/\brawHash\b/);
    expect(body).toMatch(/\bmode\b/);
    expect(body).toMatch(/\brawReplaceState\b/);
    expect(body).toMatch(/\brawPushState\b/);
  });

  it('fallback skips earlier hashchange markers and finds parseable helper window', () => {
    const html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>
      const rawPushState = history.pushState.bind(history);
      const rawReplaceState = history.replaceState.bind(history);
      const navigateHashRoute = (nextRoute, options = {}) => {
        if (!nextRoute || !nextRoute.startsWith('/')) return;
      </script><script>(self.__next_f=self.__next_f||[]).push([1,"hashchange buildId _next/static __next_f"])</script><script>
        if (mode === 'replace') {
          rawReplaceState(history.state, '', routePath);
        } else {
          rawPushState(history.state, '', routePath);
        }
      };
      window.addEventListener('hashchange', () => {
        const rawHash = window.location.hash || '';
        if (!rawHash.startsWith('#/')) return;
        navigateHashRoute(rawHash.slice(1), 'replace');
      });
    </script></body></html>`;

    const navigateBody = extractArrowFunctionBodyFromHtml(html, 'navigateHashRoute');
    expect(navigateBody).not.toBeNull();
    const body = navigateBody ?? '';
    expect(body).not.toContain('</script>');
    expect(body).not.toMatch(/\brawHash\b/);
    expect(body).toMatch(/\bmode\b/);
    expect(body).toMatch(/\brawReplaceState\b/);
    expect(body).toMatch(/\brawPushState\b/);
  });

  it('parses helper window when only known next script interleave is present', () => {
    const html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>
      const rawPushState = history.pushState.bind(history);
      const rawReplaceState = history.replaceState.bind(history);
      const navigateHashRoute = (nextRoute, options = {}) => {
        if (!nextRoute || !nextRoute.startsWith('/')) return;
        if (mode === 'replace') {
          rawReplaceState(history.state, '', routePath);
        }
      </script><script>(self.__next_f=self.__next_f||[]).push([0]);self.__next_f.push([2,null])</script><script>self.__next_f.push([1,"buildId:_next/static __next_f"])</script><script>
        else {
          rawPushState(history.state, '', routePath);
        }
      };
      window.addEventListener('hashchange', () => {
        const rawHash = window.location.hash || '';
        if (!rawHash.startsWith('#/')) return;
        navigateHashRoute(rawHash.slice(1), 'replace');
      });
    </script></body></html>`;

    const navigateBody = extractArrowFunctionBodyFromHtml(html, 'navigateHashRoute');
    expect(navigateBody).not.toBeNull();
    const body = navigateBody ?? '';
    expect(body).not.toContain('</script>');
    expect(body).not.toMatch(/\brawHash\b/);
    expect(body).toMatch(/\brawReplaceState\b/);
    expect(body).toMatch(/\brawPushState\b/);
  });

  it('fallback prefers clean helper when earlier declaration window is tainted', () => {
    const html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body>
      <script>
      const rawPushState = history.pushState.bind(history);
      const rawReplaceState = history.replaceState.bind(history);
      const navigateHashRoute = (nextRoute, options = {}) => {
        if (!nextRoute || !nextRoute.startsWith('/')) return;
        if (!rawHash.startsWith('#/')) return;
      </script><script>(self.__next_f=self.__next_f||[]).push([0]);self.__next_f.push([1,"buildId _next/static __next_f"])</script><script>
      };
      window.addEventListener('hashchange', () => {
        const rawHash = window.location.hash || '';
        if (!rawHash.startsWith('#/')) return;
      });
      </script>
      <script>
      const rawPushState = history.pushState.bind(history);
      const rawReplaceState = history.replaceState.bind(history);
      const navigateHashRoute = (nextRoute, options = {}) => {
        if (!nextRoute || !nextRoute.startsWith('/')) return;
        if (mode === 'replace') {
          rawReplaceState(history.state, '', routePath);
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
    </body></html>`;

    const navigateBody = extractArrowFunctionBodyFromHtml(html, 'navigateHashRoute');
    expect(navigateBody).not.toBeNull();
    const body = navigateBody ?? '';
    expect(body).not.toMatch(/\brawHash\b/);
    expect(body).toMatch(/\bmode\b/);
    expect(body).toMatch(/\brawReplaceState\b/);
    expect(body).toMatch(/\brawPushState\b/);
  });





  it('committed artifacts do not contain malformed catch-to-if pattern in normalizeHashHref', () => {
    const rootArtifactPath = path.resolve(__dirname, '../../agijobmanager.html');
    const distArtifactPath = path.resolve(__dirname, '../dist-ipfs/agijobmanager.html');

    for (const artifactPath of [rootArtifactPath, distArtifactPath]) {
      const artifactHtml = fs.readFileSync(artifactPath, 'utf8');
      const routerScript = extractRouterBootstrapScript(artifactHtml);
      expect(routerScript).toBeTruthy();

      const malformedPattern = /catch \(_error\) \{\n\s*return null;\n\s*if \(parsed\.origin !== window\.location\.origin\) return null;/;
      expect(routerScript).not.toMatch(malformedPattern);
    }
  });

  it('committed artifacts keep normalizeHashHref outside detectGatewayBase and available to click handler', () => {
    const rootArtifactPath = path.resolve(__dirname, '../../agijobmanager.html');
    const distArtifactPath = path.resolve(__dirname, '../dist-ipfs/agijobmanager.html');

    for (const artifactPath of [rootArtifactPath, distArtifactPath]) {
      const artifactHtml = fs.readFileSync(artifactPath, 'utf8');
      const scripts = extractBootstrapScripts(artifactHtml);
      expect(scripts.length).toBeGreaterThan(0);

      const routerScript = scripts.find((body) => body.includes('const normalizeHashHref = (input) => {'));
      expect(routerScript).toBeTruthy();

      const detectBaseMatch = (routerScript ?? '').match(/const detectGatewayBase = \(pathname\) => \{([\s\S]*?)\n  \};/);
      const detectBaseBody = detectBaseMatch?.[1] ?? '';
      expect(detectBaseBody).not.toContain('const href = input;');
      expect(detectBaseBody).not.toContain('normalizeHashHref');

      const normalizeIndex = (routerScript ?? '').indexOf('const normalizeHashHref = (input) => {');
      const clickUseIndex = (routerScript ?? '').indexOf('const hashRoute = normalizeHashHref(href);');
      expect(normalizeIndex).toBeGreaterThanOrEqual(0);
      expect(clickUseIndex).toBeGreaterThan(normalizeIndex);
    }
  });

  it('committed root and dist artifacts keep router bootstrap catch block closed and scripts parseable', () => {
    const rootArtifactPath = path.resolve(__dirname, '../../agijobmanager.html');
    const distArtifactPath = path.resolve(__dirname, '../dist-ipfs/agijobmanager.html');
    const rootArtifactHtml = fs.readFileSync(rootArtifactPath, 'utf8');
    const distArtifactHtml = fs.readFileSync(distArtifactPath, 'utf8');

    for (const [label, artifactHtml] of [['root', rootArtifactHtml], ['dist', distArtifactHtml]] as const) {
      const bootstrapScripts = extractBootstrapScripts(artifactHtml);
      expect(bootstrapScripts.length, `${label} artifact should include bootstrap scripts`).toBeGreaterThan(0);

      const routerScript = bootstrapScripts.find((body) => body.includes('const normalizeHashHref = (input) => {'));
      expect(routerScript, `${label} artifact router bootstrap should exist`).toBeTruthy();
      expect(routerScript).toContain('if (parsed.origin !== window.location.origin) return null;');
      expect(routerScript).toContain("if (parsed.hash && parsed.hash.startsWith('#/')) {");
      expect(routerScript).toMatch(/catch \(_error\) \{\n\s*return null;\n\s*\}\n\n\s*if \(parsed\.origin !== window\.location\.origin\) return null;/);
    }

    assertInlineScriptsParseable(rootArtifactHtml);
    assertInlineScriptsParseable(distArtifactHtml);
  });

  it('committed bootstrap scripts keep normalizeHashHref catch block structurally closed', () => {
    const artifactPath = path.resolve(__dirname, '../../agijobmanager.html');
    const artifactHtml = fs.readFileSync(artifactPath, 'utf8');

    const bootstrapScripts = extractBootstrapScripts(artifactHtml);
    expect(bootstrapScripts.length).toBeGreaterThan(0);

    const routerScript = bootstrapScripts.find((body) => body.includes('const normalizeHashHref = (input) => {'));
    expect(routerScript, 'router bootstrap script should exist in committed artifact').toBeTruthy();
    expect(routerScript).toContain("} catch (_error) {");
    expect(routerScript).toMatch(/return null;\n\s*}\n\n\s*if \(parsed\.origin !== window\.location\.origin\) return null;/);
    expect(() => new Function(routerScript ?? '')).not.toThrow();
  });

  it('committed artifact router bootstrap script remains syntactically parseable', () => {
    const artifactPath = path.resolve(__dirname, '../../agijobmanager.html');
    const artifactHtml = fs.readFileSync(artifactPath, 'utf8');

    const routerScript = extractRouterBootstrapScript(artifactHtml);
    expect(routerScript, 'router bootstrap script should exist in committed artifact').not.toBeNull();
    expect(() => new Function(routerScript ?? '')).not.toThrow();
  });

  it('committed artifact keeps rawHash out of navigateHashRoute helper', () => {
    const artifactPath = path.resolve(__dirname, '../../agijobmanager.html');
    const artifactHtml = fs.readFileSync(artifactPath, 'utf8');
    expect(artifactHtml).toContain("addEventListener('hashchange'");
    expect(artifactHtml).toContain("startsWith('#/')");

    const navigateBody = extractArrowFunctionBodyFromHtml(artifactHtml, 'navigateHashRoute');
    expect(navigateBody, 'navigateHashRoute body should be parseable in committed artifact').not.toBeNull();

    const body = navigateBody ?? '';
    expect(body).not.toContain('</script>');
    expect(body).not.toMatch(/\brawHash\b/);
    expect(body).toMatch(/\bmode\b/);
    expect(body).toMatch(/\brawReplaceState\b/);
    expect(body).toMatch(/\brawPushState\b/);
  });

  it('committed artifact includes required top navigation hash routes', () => {
    const artifactPath = path.resolve(__dirname, '../../agijobmanager.html');
    const artifactHtml = fs.readFileSync(artifactPath, 'utf8');

    const requiredTabs = [
      ['Dashboard', '#/'],
      ['Jobs', '#/jobs'],
      ['Identity', '#/identity'],
      ['Admin', '#/admin'],
      ['Advanced', '#/advanced'],
      ['Design', '#/design'],
      ['Deployment', '#/deployment']
    ] as const;

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    for (const [label, hashHref] of requiredTabs) {
      const pairedAnchorPattern = new RegExp(
        `<a\\b[^>]*\\bhref=["']${escapeRegExp(hashHref)}["'][^>]*>\\s*${escapeRegExp(label)}\\s*<\\/a>`,
        'i'
      );
      expect(artifactHtml).toMatch(pairedAnchorPattern);
    }
  });

  it('committed artifact router bootstrap keeps click/hash handling without pathname-derived boot routes', () => {
    const artifactPath = path.resolve(__dirname, '../../agijobmanager.html');
    const artifactHtml = fs.readFileSync(artifactPath, 'utf8');
    const routerScript = extractRouterBootstrapScript(artifactHtml);
    expect(routerScript).toBeTruthy();

    const body = routerScript ?? '';
    expect(body).toContain("document.addEventListener('click'");
    expect(body).toContain('const hashRoute = normalizeHashHref(href);');
    expect(body).toContain("navigateHashRoute(routePath, { mode: 'push' });");
    expect(body).toContain("window.addEventListener('hashchange', () => {");
    expect(body).toContain('const routePath = getRouteFromHash();');
    expect(body).toContain('const startupRoute = getRouteFromHash();');
    expect(body).toContain("const startupCanonicalHash = getStartupCanonicalHash(window.location.hash || '');");
    expect(body).not.toContain("syncHashWithPath('replace');");
    expect(body).not.toContain('stripGatewayBase(window.location.pathname) + window.location.search');
    expect(body).toContain('window.dispatchEvent(new PopStateEvent(\'popstate\', { state }));');
  });


  it('committed artifact hash URLs preserve current pathname and avoid root-level hash corruption', () => {
    const artifactPath = path.resolve(__dirname, '../../agijobmanager.html');
    const artifactHtml = fs.readFileSync(artifactPath, 'utf8');
    const routerScript = extractRouterBootstrapScript(artifactHtml);
    expect(routerScript).toBeTruthy();

    const body = routerScript ?? '';
    expect(body).toContain('const documentUrl = documentPath + documentSearch;');
    expect(body).toContain("return documentUrl + '#' + parsedHashRoute.routeInput;");
    expect(body).not.toContain('const hashBaseUrl = isContentAddressedGateway ? gatewayBase : documentUrl;');
    expect(body).not.toContain("return '/#' + parsedHashRoute.routeInput;");
    expect(body).not.toContain('/#/#/');
  });
  it('committed artifact supports deep-link job detail route tokens', () => {
    const artifactPath = path.resolve(__dirname, '../../agijobmanager.html');
    const artifactHtml = fs.readFileSync(artifactPath, 'utf8');

    const routerScript = extractRouterBootstrapScript(artifactHtml);
    expect(routerScript).toBeTruthy();

    const body = routerScript ?? '';
    expect(body).toContain('if (!nextRoute || !nextRoute.startsWith(\'/\')) return;');
    expect(body).toContain('const queryIndex = withoutHash.indexOf(\'?\');');
    expect(body).toContain('const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;');
    expect(body).toContain('const hashUrl = toHashUrl(nextRoute);');
  });

  it('passes when navigateHashRoute only uses its own inputs', () => {
    const run = runVerifierWithHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; frame-ancestors 'none'"><meta name="referrer" content="no-referrer"></head><body><script>
      const navigateHashRoute = (nextRoute, options = {}) => {
        if (!nextRoute || !nextRoute.startsWith('/')) return;
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
