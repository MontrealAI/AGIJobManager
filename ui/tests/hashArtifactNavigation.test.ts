import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const artifactPath = path.resolve(__dirname, '../../agijobmanager.html');

describe('committed single-file hash navigation', () => {
  it('contains top navigation hash routes for all primary tabs', () => {
    const html = fs.readFileSync(artifactPath, 'utf8');
    const expectedRoutes = [
      '#/',
      '#/jobs',
      '#/identity',
      '#/admin',
      '#/advanced',
      '#/design',
      '#/deployment'
    ];

    for (const route of expectedRoutes) {
      expect(html).toContain(`href="${route}"`);
    }
  });

  it('ships stable hash navigation helpers for route changes', () => {
    const html = fs.readFileSync(artifactPath, 'utf8');
    expect(html).toContain('const navigateHashRoute = (routePath, mode) => {');
    expect(html).toContain('window.addEventListener(\'hashchange\'');
    expect(html).toContain('const normalizeHashHref = (input) => {');
  });

  it('contains a single terminal document close marker without trailing content', () => {
    const html = fs.readFileSync(artifactPath, 'utf8');
    const closeTag = '</body></html>';
    const firstClose = html.indexOf(closeTag);
    const lastClose = html.lastIndexOf(closeTag);

    expect(firstClose).toBeGreaterThan(0);
    expect(lastClose).toBe(firstClose);
    expect(html.slice(firstClose + closeTag.length).trim()).toBe('');
  });

  it('keeps normalizeHashHref and navigateHashRoute in the same router bootstrap script', () => {
    const html = fs.readFileSync(artifactPath, 'utf8');
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

    const routerScript = scripts.find((body) =>
      body.includes('const normalizeHashHref = (input) => {')
      && body.includes('const navigateHashRoute = (routePath, mode) => {')
      && body.includes("window.addEventListener('hashchange'")
    );

    expect(routerScript).toBeTruthy();
    expect(routerScript).not.toContain('<script');
    expect(routerScript).not.toContain('</script><script>');
  });

});
