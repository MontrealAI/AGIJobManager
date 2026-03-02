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

type HistoryCall = { method: 'pushState' | 'replaceState'; url: string };

const bootRouter = (initialUrl: string) => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: initialUrl, runScripts: 'outside-only' });
  const historyCalls: HistoryCall[] = [];

  const rawPushState = dom.window.history.pushState.bind(dom.window.history);
  const rawReplaceState = dom.window.history.replaceState.bind(dom.window.history);

  dom.window.history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
    historyCalls.push({ method: 'pushState', url: String(url ?? '') });
    rawPushState(data, unused, url);
  }) as History['pushState'];

  dom.window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
    historyCalls.push({ method: 'replaceState', url: String(url ?? '') });
    rawReplaceState(data, unused, url);
  }) as History['replaceState'];

  const script = extractRouterBootstrapScript(readArtifactHtml());
  expect(script, 'router bootstrap script should exist in committed artifact').toBeTruthy();
  dom.window.eval(script ?? '');
  return { dom, historyCalls };
};

describe('single-file hash router runtime behavior', () => {
  it('handles top-nav hash clicks without leaving the document', () => {
    const { dom, historyCalls } = bootRouter('https://example.com/agijobmanager.html#/');
    const anchor = dom.window.document.createElement('a');
    anchor.setAttribute('href', '#/jobs');
    dom.window.document.body.appendChild(anchor);

    anchor.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

    expect(dom.window.location.hash).toBe('#/jobs');
    expect(historyCalls.some((call) => call.method === 'pushState' && call.url === '/jobs')).toBe(true);
  });

  it('supports deep-link hashchange navigation by rewriting to path history first', () => {
    const { dom, historyCalls } = bootRouter('https://example.com/agijobmanager.html#/');
    const callsBefore = historyCalls.length;

    dom.window.location.hash = '#/identity';
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));

    const newCalls = historyCalls.slice(callsBefore);
    expect(newCalls.some((call) => call.method === 'replaceState' && call.url === '/identity')).toBe(true);
    expect(newCalls.some((call) => call.method === 'replaceState' && call.url.endsWith('/#/identity'))).toBe(true);
  });

  it('syncs path-only url to hash when popstate fires outside hash mode', () => {
    const { dom, historyCalls } = bootRouter('https://example.com/agijobmanager.html#/');
    const callsBefore = historyCalls.length;

    dom.window.history.replaceState({}, '', '/admin');
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));

    const newCalls = historyCalls.slice(callsBefore);
    expect(newCalls.some((call) => call.method === 'replaceState' && call.url === '#/admin')).toBe(true);
    expect(dom.window.location.hash).toBe('#/admin');
  });
});
