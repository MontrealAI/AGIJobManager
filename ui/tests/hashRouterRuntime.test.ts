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
    if (body.includes('const navigateHashRoute = (nextRoute, options = {}) => {') && body.includes("document.addEventListener('click'")) {
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
  it('keeps navigation anchored to the current document under nested GitHub Pages paths', () => {
    const { dom } = bootRouter('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/');

    const anchor = dom.window.document.createElement('a');
    anchor.setAttribute('href', '#/jobs');
    dom.window.document.body.appendChild(anchor);

    const clickEvent = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    anchor.dispatchEvent(clickEvent);

    expect(dom.window.location.href).toBe('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/jobs');
    expect(dom.window.location.pathname).toBe('/AGIJobManager/agijobmanager.html');
  });

  it('handles top-nav hash clicks via router interception', () => {
    const { dom, calls } = bootRouter('https://example.com/agijobmanager.html#/');
    const before = { ...calls };
    const anchor = dom.window.document.createElement('a');
    anchor.setAttribute('href', '#/jobs');
    dom.window.document.body.appendChild(anchor);

    const clickEvent = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    const dispatchResult = anchor.dispatchEvent(clickEvent);

    expect(dispatchResult).toBe(false);
    expect(clickEvent.defaultPrevented).toBe(true);
    expect(calls.pushState).toBeGreaterThan(before.pushState);
    expect(dom.window.location.hash).toBe('#/jobs');
  });

  it('hashchange handler updates the in-document route without pathname rewrites', () => {
    const { dom, calls } = bootRouter('https://example.com/agijobmanager.html#/');
    const before = { ...calls };

    dom.window.location.hash = '#/identity';
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));

    expect(calls.replaceState).toBe(before.replaceState);
    expect(dom.window.location.hash).toBe('#/identity');
  });

  it('startup sanitizer normalizes malformed #/... hash routes that leak pathname/file details', () => {
    const { dom, calls } = bootRouter('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/AGIJobManager/agijobmanager.html');
    expect(calls.replaceState).toBeGreaterThan(0);
    expect(dom.window.location.href).toBe('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/');
    expect(dom.window.location.pathname).toBe('/AGIJobManager/agijobmanager.html');
  });

  it('treats bare # as dashboard without startup hash rewrite', () => {
    const { dom, calls } = bootRouter('https://montrealai.github.io/AGIJobManager/agijobmanager.html#');
    expect(calls.replaceState).toBe(0);
    expect(dom.window.location.href).toBe('https://montrealai.github.io/AGIJobManager/agijobmanager.html#');
    expect(dom.window.document.body.getAttribute('data-hash-route')).toBe('/');
  });
});
