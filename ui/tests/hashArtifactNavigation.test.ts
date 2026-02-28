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
      expect(html, `${label} missing hashchange listener`).toContain('window.addEventListener(\'hashchange\'');
      expect(html, `${label} missing normalizeHashHref`).toContain('const normalizeHashHref = (input) => {');
    }
  });


  it('contains a single app flight payload marker', () => {
    const marker = 'self.__next_f.push([1,"0:[';

    for (const { file, label } of artifactTargets) {
      const html = fs.readFileSync(file, 'utf8');
      const count = html.split(marker).length - 1;
      expect(count, `${label} has duplicated app flight payload`).toBe(1);
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
    }
  });
});
