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
    }
  });

  it('ships stable hash navigation helpers for route changes', () => {
    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      expect(html, `${label} missing navigateHashRoute`).toContain('const navigateHashRoute = (routePath, mode) => {');
      expect(html, `${label} missing dispatchRouteUpdate`).toContain("window.dispatchEvent(new PopStateEvent('popstate', { state }));");
      expect(html, `${label} missing hashchange listener`).toContain('window.addEventListener(\'hashchange\'');
      expect(html, `${label} missing normalizeHashHref`).toContain('const normalizeHashHref = (input) => {');
    }
  });

  it('keeps deep-link conversion logic for static-hosting direct loads', () => {
    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      expect(html, `${label} missing initial-load rewrite guard`).toContain("if (!window.location.hash && !window.location.pathname.startsWith('/_next')) {");
      expect(html, `${label} missing gateway-path normalization`).toContain('const routePath = stripGatewayBase(window.location.pathname);');
      expect(html, `${label} missing initial hash rewrite`).toContain("rawReplaceState(history.state, '', hashUrl);");
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

  it('keeps normalizeHashHref free of duplicate parsed redeclarations', () => {
    const declaration = 'const normalizeHashHref = (input) => {';

    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
      const routerScript = scripts.find((body) => body.includes(declaration));
      expect(routerScript, `${label} missing normalizeHashHref helper`).toBeTruthy();

      const scriptBody = routerScript ?? '';
      const declarationIndex = scriptBody.indexOf(declaration);
      expect(declarationIndex, `${label} missing normalizeHashHref declaration index`).toBeGreaterThan(-1);

      const openBraceIndex = scriptBody.indexOf('{', declarationIndex);
      expect(openBraceIndex, `${label} missing normalizeHashHref opening brace`).toBeGreaterThan(-1);

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

      expect(closeBraceIndex, `${label} normalizeHashHref wrapper should be parseable`).toBeGreaterThan(-1);
      const normalizeBody = scriptBody.slice(openBraceIndex + 1, closeBraceIndex);

      const parsedDeclarations = normalizeBody.match(/\b(?:const|let|var)\s+parsed\b/g) ?? [];
      expect(
        parsedDeclarations.length,
        `${label} normalizeHashHref redeclares parsed and can become a parse-time SyntaxError`
      ).toBeLessThanOrEqual(1);
    }
  });

  it('contains a single terminal document close marker without trailing content', () => {
    const closeTag = '</body></html>';

    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      const firstClose = html.indexOf(closeTag);
      const lastClose = html.lastIndexOf(closeTag);

      expect(firstClose, `${label} missing ${closeTag}`).toBeGreaterThan(0);
      expect(lastClose, `${label} has duplicate ${closeTag}`).toBe(firstClose);
      expect(html.slice(firstClose + closeTag.length).trim(), `${label} has trailing content after terminal close`).toBe('');
    }
  });

  it('keeps normalizeHashHref and navigateHashRoute in the same router bootstrap script', () => {
    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

      const routerScript = scripts.find((body) =>
        body.includes('const normalizeHashHref = (input) => {')
        && body.includes('const navigateHashRoute = (routePath, mode) => {')
        && body.includes("window.addEventListener('hashchange'")
      );

      expect(routerScript, `${label} missing router bootstrap script`).toBeTruthy();
      expect(routerScript, `${label} has nested script marker`).not.toContain('<script');
      expect(routerScript, `${label} has interleaved script boundary`).not.toContain('</script><script>');

      const scriptBody = routerScript ?? '';
      expect(scriptBody, `${label} has injected DOM markup inside router bootstrap script`).not.toContain('<div data-rk');
      expect(scriptBody.trimEnd(), `${label} router bootstrap script should terminate as an IIFE`).toMatch(/\}\)\(\);$/);
      const declaration = 'const navigateHashRoute = (routePath, mode) => {';
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
