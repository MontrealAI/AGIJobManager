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


  it('starts hash bootstrap as a dedicated body script without pre-bootstrap helper interleaving', () => {
    const html = fs.readFileSync(artifactPath, 'utf8');
    const bootstrapStart = '</script></head><body><script>(function(){';
    const startIndex = html.indexOf(bootstrapStart);

    expect(startIndex).toBeGreaterThan(0);

    const preBootstrap = html.slice(0, startIndex);
    expect(preBootstrap).not.toMatch(/\bconst\s+normalizeHashHref\s*=\s*\(input\)\s*=>\s*\{/);

    const normalizeCount = (html.match(/\bconst\s+normalizeHashHref\s*=\s*\(input\)\s*=>\s*\{/g) || []).length;
    expect(normalizeCount).toBe(1);
  });

});
