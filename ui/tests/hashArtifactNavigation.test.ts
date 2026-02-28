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


  it('does not contain premature document close before routing/bootstrap scripts complete', () => {
    const html = fs.readFileSync(artifactPath, 'utf8');
    expect((html.match(/<\/html>/gi) || []).length).toBe(1);
    expect((html.match(/<\/body>/gi) || []).length).toBe(1);
    expect(html).not.toMatch(/<\/body>\s*<\/html>\s*<script/gi);

    const closeIndex = html.toLowerCase().lastIndexOf('</body></html>');
    const navHelperIndex = html.indexOf('const navigateHashRoute = (routePath, mode) => {');
    expect(navHelperIndex).toBeGreaterThan(-1);
    expect(navHelperIndex).toBeLessThan(closeIndex);
  });
});
