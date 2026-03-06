import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const artifactPath = path.resolve(__dirname, '../../agijobmanager.html');
const distArtifactPath = path.resolve(__dirname, '../dist-ipfs/agijobmanager.html');
const artifactTargets = [
  { label: 'repo root artifact', file: artifactPath },
  { label: 'ui/dist-ipfs artifact', file: distArtifactPath }
] as const;

describe('committed single-file hash navigation', () => {
  it('keeps repo root artifact byte-identical to ui/dist-ipfs artifact', () => {
    const rootHtml = fs.readFileSync(artifactPath, 'utf8');
    const distHtml = fs.readFileSync(distArtifactPath, 'utf8');
    expect(rootHtml).toBe(distHtml);
  });

  it('contains top navigation hash routes for all primary tabs', () => {
    const expectedRoutes = [
      '#/',
      '#/jobs',
      '#/identity',
      '#/admin',
      '#/advanced',
      '#/design',
      '#/deployment'
    ];

    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      for (const route of expectedRoutes) {
        expect(html, `${label} missing ${route}`).toContain(`href="${route}"`);
      }

      const hasDemoTab = html.includes('href="#/demo"');
      if (hasDemoTab) {
        expect(html, `${label} includes Demo tab but not hash route href`).toContain('href="#/demo"');
      }
    }
  });

  it('keeps top-nav tab hrefs unique to avoid dead-tab collisions', () => {
    const tabLabelToRoute = new Map([
      ['Dashboard', '#/'],
      ['Jobs', '#/jobs'],
      ['Identity', '#/identity'],
      ['Admin', '#/admin'],
      ['Advanced', '#/advanced'],
      ['Design', '#/design'],
      ['Deployment', '#/deployment'],
      ['Demo', '#/demo']
    ]);

    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      const navMatch = html.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i);
      expect(navMatch?.[1], `${label} missing top nav`).toBeTruthy();

      const navHtml = navMatch?.[1] ?? '';
      for (const [tabLabel, route] of tabLabelToRoute) {
        const exactAnchor = new RegExp(`<a[^>]*href=\"${route.replace('/', '\\/')}\"[^>]*>${tabLabel}<\\/a>`);
        expect(exactAnchor.test(navHtml), `${label} ${tabLabel} tab should map uniquely to ${route}`).toBe(true);
      }
    }
  });

  it('ships stable hash navigation helpers for route changes', () => {
    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      expect(html, `${label} missing navigateHashRoute`).toContain('const navigateHashRoute = (nextRoute, options = {}) => {');
      expect(html, `${label} missing dispatchRouteUpdate`).toContain("window.dispatchEvent(new PopStateEvent('popstate', { state }));");
      expect(html, `${label} missing hashchange listener`).toContain('window.addEventListener(\'hashchange\'');
      expect(html, `${label} missing normalizeHashHref`).toContain('const normalizeHashHref = (input) => {');
      expect(html, `${label} should not install pathname-derived popstate rewrites`).not.toContain("window.addEventListener('popstate'");
    }
  });

  it('keeps hash-only startup bootstrap guards and click navigation push handling', () => {
    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      expect(html, `${label} missing malformed startup hash sanitizer`).toContain("const startupCanonicalHash = getStartupCanonicalHash(window.location.hash || '');");
      expect(html, `${label} missing startup hash normalization`).toContain("rawReplaceState(history.state, '', documentUrl + startupCanonicalHash);");
      expect(html, `${label} must not derive startup hash from pathname`).not.toContain("if (!window.location.hash && !window.location.pathname.startsWith('/_next')) {");
      expect(html, `${label} must not sync from pathname-based popstate handler`).not.toContain("syncHashWithPath('replace');");
      expect(html, `${label} missing hash click navigation push`).toContain("navigateHashRoute(routePath, { mode: 'push' });");
    }
  });


  it('keeps parseRouteInput/toHashUrl/getRouteFromHash/navigateHashRoute declarations co-located in one router bootstrap script', () => {
    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
      const routerScript = scripts.find((body) => (
        body.includes('const normalizeHashHref = (input) => {')
        && body.includes('const parseRouteInput = (routeInput) => {')
        && body.includes('const toHashUrl = (routeInput) => {')
        && body.includes('const getRouteFromHash = () => {')
        && body.includes('const navigateHashRoute = (nextRoute, options = {}) => {')
        && body.includes("window.addEventListener('hashchange'")
      ));

      expect(routerScript, `${label} missing co-located hash-routing helper declarations`).toBeTruthy();
      const body = routerScript ?? '';
      expect(body, `${label} toHashUrl must parse route input`).toContain('const parsedHashRoute = parseRouteInput(routeInput);');
      expect(body, `${label} hashchange must derive route from hash-only helper`).toContain('const routePath = getRouteFromHash();');
    }
  });
  it('keeps deep-link conversion logic pathname-preserving and hash-only', () => {
    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      expect(html, `${label} missing stable pathname capture`).toContain('const documentUrl = documentPath + documentSearch;');
      expect(html, `${label} missing hash-only route parser`).toContain('const getRouteFromHash = () => {');
      expect(html, `${label} must not derive routePath from stripGatewayBase(pathname) bootstrap`).not.toContain('const routePath = stripGatewayBase(window.location.pathname);');
      expect(html, `${label} missing startup hash rewrite to canonical #/`).toContain("rawReplaceState(history.state, '', documentUrl + startupCanonicalHash);");
    }
  });

  it('does not hijack external hash-router URLs in link interception', () => {
    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      expect(html, `${label} missing URL parsing guard in normalizeHashHref`).toContain('parsed = new URL(input, window.location.href);');
      expect(html, `${label} missing same-origin guard in normalizeHashHref`).toContain('if (parsed.origin !== window.location.origin) return null;');
      expect(html, `${label} missing normalizeHashHref click interception`).toContain('const hashRoute = normalizeHashHref(href);');
    }
  });


  it('escapes provider metadata before wallet panel HTML interpolation', () => {
    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      expect(html, `${label} missing escapeHtml helper`).toContain('const escapeHtml = (value) => String(value)');
      expect(html, `${label} missing sanitized provider label binding`).toContain("const safeProviderLabel = escapeHtml(walletState.providerLabel || 'none detected');");
      expect(html, `${label} should not inject raw providerLabel into innerHTML`).not.toContain("<code>' + (walletState.providerLabel || 'none detected') + '</code>");
    }
  });

  it('contains a single terminal document close marker without trailing content', () => {
    const closeTag = '</body></html>';

    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      const firstClose = html.indexOf(closeTag);
      const lastClose = html.lastIndexOf(closeTag);

      expect(firstClose, `${label} missing ${closeTag}`).toBeGreaterThan(0);
      expect(lastClose, `${label} missing terminal ${closeTag}`).toBeGreaterThan(0);
      expect(html.slice(lastClose + closeTag.length).trim(), `${label} has trailing content after terminal close`).toBe('');
    }
  });

  it('keeps normalizeHashHref and navigateHashRoute in the same router bootstrap script', () => {
    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

      const routerScript = scripts.find((body) =>
        body.includes('const normalizeHashHref = (input) => {')
        && body.includes('const navigateHashRoute = (nextRoute, options = {}) => {')
        && body.includes("window.addEventListener('hashchange'")
      );

      expect(routerScript, `${label} missing router bootstrap script`).toBeTruthy();
      expect(routerScript, `${label} has nested script marker`).not.toContain('<script');
      expect(routerScript, `${label} has interleaved script boundary`).not.toContain('</script><script>');

      const scriptBody = routerScript ?? '';
      expect(scriptBody, `${label} has injected DOM markup inside router bootstrap script`).not.toContain('<div data-rk');
      expect(scriptBody.trimEnd(), `${label} router bootstrap script should terminate as an IIFE`).toMatch(/\}\)\(\);$/);
      const declaration = 'const navigateHashRoute = (nextRoute, options = {}) => {';
      const declarationIndex = scriptBody.indexOf(declaration);
      expect(declarationIndex, `${label} missing navigateHashRoute declaration inside router bootstrap script`).toBeGreaterThan(-1);

      const openBraceIndex = scriptBody.indexOf('{', declarationIndex);
      expect(openBraceIndex, `${label} missing navigateHashRoute opening brace`).toBeGreaterThan(-1);

      let depth = 0;
      let closeBraceIndex = -1;
      for (let i = openBraceIndex; i < scriptBody.length; i += 1) {
        const ch = scriptBody[i];
        if (ch === '{') depth += 1;
        if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            closeBraceIndex = i;
            break;
          }
        }
      }

      expect(closeBraceIndex, `${label} navigateHashRoute wrapper should be parseable in router bootstrap script`).toBeGreaterThan(-1);

      const outsideNavigate = scriptBody.slice(0, declarationIndex) + scriptBody.slice(closeBraceIndex + 1);
      const guardPattern = /if\s*\(\s*!hashUrl\s*\)\s*return\s*;/g;
      for (const match of outsideNavigate.matchAll(guardPattern)) {
        const idx = match.index ?? -1;
        expect(idx, `${label} leaked unscoped hashUrl guard index missing`).toBeGreaterThan(-1);
        const context = outsideNavigate.slice(Math.max(0, idx - 160), idx);
        expect(context, `${label} leaked top-level hashUrl guard outside navigateHashRoute`).toMatch(/(?:const|let|var)\s+hashUrl\s*=/);
      }

      const invokesNavigate = /\bnavigateHashRoute\s*\(/.test(scriptBody);
      expect(invokesNavigate, `${label} should invoke navigateHashRoute from hash/click handlers`).toBe(true);

      const hasLocalDeclaration = /\b(?:const|let|var)\s+navigateHashRoute\s*=\s*\([^)]*\)\s*=>\s*\{|\bfunction\s+navigateHashRoute\s*\(/.test(scriptBody);
      expect(hasLocalDeclaration, `${label} invokes navigateHashRoute but lacks local navigateHashRoute declaration`).toBe(true);

      expect(scriptBody, `${label} leaked detached routePath guard outside hashchange handler`).not.toContain(`if (routePath === stripGatewayBase(window.location.pathname)) return;
  window.addEventListener('popstate'`);

      expect(scriptBody, `${label} hashchange handler missing hash-only route extraction`).toContain('const routePath = getRouteFromHash();');
      expect(scriptBody, `${label} hashchange handler should not compare against pathname`).not.toContain('if (routePath === stripGatewayBase(window.location.pathname)) return;');
      expect(scriptBody, `${label} hashchange handler should not rewrite using replace navigation`).not.toContain("navigateHashRoute(routePath, { mode: 'replace' });");
    }
  });


  it('keeps normalizeHashHref parseable with a single parsed binding', () => {
    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      const declaration = 'const normalizeHashHref = (input) => {';
      const declarationIndex = html.indexOf(declaration);

      expect(declarationIndex, `${label} missing normalizeHashHref declaration`).toBeGreaterThan(-1);

      const openBraceIndex = html.indexOf('{', declarationIndex);
      expect(openBraceIndex, `${label} missing normalizeHashHref opening brace`).toBeGreaterThan(-1);

      let depth = 0;
      let closeBraceIndex = -1;
      for (let i = openBraceIndex; i < html.length; i += 1) {
        const ch = html[i];
        if (ch === '{') depth += 1;
        if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            closeBraceIndex = i;
            break;
          }
        }
      }

      expect(closeBraceIndex, `${label} normalizeHashHref body should be parseable`).toBeGreaterThan(-1);

      const helperBody = html.slice(openBraceIndex + 1, closeBraceIndex);
      expect(helperBody, `${label} missing let parsed declaration`).toMatch(/\blet\s+parsed\s*;/);
      expect(helperBody, `${label} normalizeHashHref must not redeclare parsed with parseRouteInput(routeInput)`).not.toMatch(/\bconst\s+parsed\s*=\s*parseRouteInput\(routeInput\)\s*;/);
      expect(html, `${label} router bootstrap must avoid const parsed=parseRouteInput(routeInput) entirely`).not.toMatch(/\bconst\s+parsed\s*=\s*parseRouteInput\(routeInput\)\s*;/);

      expect(helperBody, `${label} normalizeHashHref must not include gateway parser block`).not.toMatch(/\bconst\s+parsedGatewayRoute\s*=\s*parseRouteInput\(routeInput\)\s*;/);
      expect(helperBody, `${label} normalizeHashHref must not include basePath declaration`).not.toMatch(/\bconst\s+basePath\s*=/);
      const routerScriptStart = html.indexOf(declarationIndex >= 0 ? declaration : 'const normalizeHashHref = (input) => {');
      const routerScriptEnd = html.indexOf('</script>', routerScriptStart);
      const routerWindow = routerScriptEnd > routerScriptStart ? html.slice(routerScriptStart, routerScriptEnd) : html.slice(routerScriptStart);
      const basePathDeclarations = routerWindow.match(/\bconst\s+basePath\s*=/g) ?? [];
      expect(basePathDeclarations.length, `${label} router bootstrap should not declare basePath`).toBe(0);
      const gatewayPathnameDeclarations = routerWindow.match(/\bconst\s+gatewayPathname\s*=/g) ?? [];
      expect(gatewayPathnameDeclarations.length, `${label} router bootstrap should not declare gatewayPathname`).toBe(0);
    }
  });


  it('renders distinct route outlets with unique test ids in the single-file artifact router payload', () => {
    const requiredRouteMarkers = [
      'data-testid="route-dashboard"',
      'data-testid="route-jobs"',
      'data-testid="route-job-detail"',
      'data-testid="route-identity"',
      'data-testid="route-admin"',
      'data-testid="route-advanced"',
      'data-testid="route-design"',
      'data-testid="route-deployment"',
      'data-testid="route-demo"'
    ];

    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      for (const marker of requiredRouteMarkers) {
        expect(html, `${label} missing route marker ${marker}`).toContain(marker);
      }

      expect(html, `${label} should support hash canonicalization without pathname leakage`).toContain("const canonicalHash = '#' + routePath;");
      expect(html, `${label} should sanitize route paths for malformed hashes`).toContain('const sanitizeRoutePath = (routePath) => {');
      expect(html, `${label} should use dedicated route outlet replacement`).toContain('data-ipfs-main-outlet="true"');
    }
  });

  it('contains only syntactically parseable inline scripts', () => {
    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      const scriptBodies = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

      for (const [index, scriptBody] of scriptBodies.entries()) {
        expect(() => new Function(scriptBody), `${label} script #${index + 1} is not parseable`).not.toThrow();
      }
    }
  });

  it('does not contain router splice corruption signatures from malformed artifact merges', () => {
    const corruptionSignatures = [
      "? gatewayBase + parsedGatewayRoute.pathname\n   rewriteHistory('replaceState');",
      "const routePath = startupHash.slice(1);\n     navigateHashRoute(routePath, { mode: 'replace' });\n     updateRoutePanel(routePath);\n   } else {\n     updateRoutePanel('/');\n     const stripped = stripGatewayBase(pathname || '');",
    ];

    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      for (const signature of corruptionSignatures) {
        expect(html, `${label} contains known malformed router splice signature`).not.toContain(signature);
      }
    }
  });

  it('does not contain duplicated Next flight bootstrap markers', () => {
    const markers = [
      '(self.__next_f=self.__next_f||[]).push([0]);self.__next_f.push([2,null])',
      'self.__next_f.push([1,"0:[\"$\",\"$L3\"',
      'self.__next_f.push([1,"b:[['
    ];

    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      for (const marker of markers) {
        const first = html.indexOf(marker);
        if (first < 0) continue;
        const second = html.indexOf(marker, first + marker.length);
        expect(second, `${label} has duplicated Next flight/bootstrap marker: ${marker}`).toBe(-1);
      }
    }
  });

});
