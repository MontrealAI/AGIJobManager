import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const readArtifactHtml = () => fs.readFileSync(path.resolve(__dirname, '../../agijobmanager.html'), 'utf8');

const extractRouterBootstrapScript = (html: string) => {
  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html)) !== null) {
    const body = match[1] ?? '';
    if (body.includes('const navigateHashRoute = (routePath, mode) => {') && body.includes("document.addEventListener('click'")) {
      return body;
    }
  }
  return null;
};

const bootRouter = (initialUrl: string) => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: initialUrl, runScripts: 'outside-only' });
  const script = extractRouterBootstrapScript(readArtifactHtml());
  expect(script, 'router bootstrap script should exist in committed artifact').toBeTruthy();
  dom.window.eval(script ?? '');
  return dom;
};

describe('single-file hash router runtime behavior', () => {
  it('handles top-nav hash clicks without leaving the document', () => {
    const dom = bootRouter('https://example.com/agijobmanager.html#/');
    const anchor = dom.window.document.createElement('a');
    anchor.setAttribute('href', '#/jobs');
    dom.window.document.body.appendChild(anchor);

    anchor.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

    expect(dom.window.location.hash).toBe('#/jobs');
  });

  it('supports deep-link hashchange navigation', () => {
    const dom = bootRouter('https://example.com/agijobmanager.html#/');

    dom.window.location.hash = '#/identity';
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));

    expect(dom.window.location.hash).toBe('#/identity');
  });

  it('keeps hash and path synchronized for back/forward style popstate events', () => {
    const dom = bootRouter('https://example.com/admin');

    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));

    expect(dom.window.location.hash).toBe('#/admin');
  });
});
