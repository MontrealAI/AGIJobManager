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
  const calls = { pushState: 0, replaceState: 0 };
  const rawPushState = dom.window.history.pushState.bind(dom.window.history);
  const rawReplaceState = dom.window.history.replaceState.bind(dom.window.history);

  dom.window.history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
    calls.pushState += 1;
    rawPushState(data, unused, url);
  }) as History['pushState'];

  dom.window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
    calls.replaceState += 1;
    rawReplaceState(data, unused, url);
  }) as History['replaceState'];

  const script = extractRouterBootstrapScript(readArtifactHtml());
  expect(script, 'router bootstrap script should exist in committed artifact').toBeTruthy();
  dom.window.eval(script ?? '');

  return { dom, calls };
};

describe('single-file hash router runtime behavior', () => {
  it('click interceptor prevents native anchor navigation and routes via history rewrite', () => {
    const { dom, calls } = bootRouter('https://example.com/agijobmanager.html#/');
    const before = { ...calls };
    const anchor = dom.window.document.createElement('a');
    anchor.setAttribute('href', '#/jobs');
    dom.window.document.body.appendChild(anchor);

    const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    const defaultNotPrevented = anchor.dispatchEvent(event);

    expect(defaultNotPrevented).toBe(false);
    expect(calls.pushState).toBeGreaterThan(before.pushState);
    expect(calls.replaceState).toBeGreaterThan(before.replaceState);
    expect(dom.window.location.hash).toBe('#/jobs');
  });

  it('hashchange handler performs history rewrites for deep-link navigation', () => {
    const { dom, calls } = bootRouter('https://example.com/agijobmanager.html#/');
    const before = { ...calls };

    dom.window.location.hash = '#/identity';
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));

    expect(calls.replaceState).toBeGreaterThan(before.replaceState);
    expect(dom.window.location.hash).toBe('#/identity');
  });

  it('popstate handler syncs hash when browsing path-only URLs', () => {
    const { dom, calls } = bootRouter('https://example.com/agijobmanager.html#/');
    const before = { ...calls };

    dom.reconfigure({ url: 'https://example.com/admin' });
    expect(dom.window.location.hash).toBe('');

    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));

    expect(calls.replaceState).toBeGreaterThan(before.replaceState);
    expect(dom.window.location.hash).toBe('#/admin');
  });
});
