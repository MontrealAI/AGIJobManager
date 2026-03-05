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
  const dom = new JSDOM('<!doctype html><html><body><main></main></body></html>', { url: initialUrl, runScripts: 'outside-only' });
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
  it('renders distinct main-route content when switching tabs inside the same document', () => {
    const { dom } = bootRouter('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/');

    const getMainText = () => {
      const outlet = dom.window.document.querySelector('[data-ipfs-main-outlet="true"]')
        ?? dom.window.document.querySelector('[data-testid^="route-"]');
      expect(outlet, 'router route content should exist').toBeTruthy();
      return (outlet?.textContent ?? '').replace(/\s+/g, ' ').trim();
    };

    const dashboardText = getMainText();
    expect(dashboardText).toContain('Dashboard · Sovereign Ops Console');

    dom.window.location.hash = '#/jobs';
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
    const jobsText = getMainText();
    expect(jobsText).toContain('Jobs Ledger');
    expect(jobsText).not.toBe(dashboardText);

    dom.window.location.hash = '#/deployment';
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
    const deploymentText = getMainText();
    expect(deploymentText).toContain('Deployment Registry');
    expect(deploymentText).not.toBe(jobsText);
  });

  it('is filename-agnostic when the exact artifact is served as /index.html', () => {
    const { dom } = bootRouter('https://montrealai.github.io/AGIJobManager/index.html#/');

    const anchor = dom.window.document.createElement('a');
    anchor.setAttribute('href', '#/deployment');
    dom.window.document.body.appendChild(anchor);

    const clickEvent = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    anchor.dispatchEvent(clickEvent);

    expect(dom.window.location.href).toBe('https://montrealai.github.io/AGIJobManager/index.html#/deployment');
    expect(dom.window.location.pathname).toBe('/AGIJobManager/index.html');
  });

  it('preserves arbitrary nested static prefixes and mutates only the hash fragment', () => {
    const { dom } = bootRouter('https://example.com/nested/demo/AGIJobManager/agijobmanager.html#/');

    const anchor = dom.window.document.createElement('a');
    anchor.setAttribute('href', '#/advanced');
    dom.window.document.body.appendChild(anchor);

    const clickEvent = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    anchor.dispatchEvent(clickEvent);

    expect(dom.window.location.href).toBe('https://example.com/nested/demo/AGIJobManager/agijobmanager.html#/advanced');
    expect(dom.window.location.pathname).toBe('/nested/demo/AGIJobManager/agijobmanager.html');
  });

  it('preserves full IPFS gateway document path and filename while changing only hash', () => {
    const { dom } = bootRouter('https://gateway.example/ipfs/bafybeigdyrzt/agijobmanager.html#/');

    const anchor = dom.window.document.createElement('a');
    anchor.setAttribute('href', '#/deployment');
    dom.window.document.body.appendChild(anchor);

    const clickEvent = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    anchor.dispatchEvent(clickEvent);

    expect(dom.window.location.href).toBe('https://gateway.example/ipfs/bafybeigdyrzt/agijobmanager.html#/deployment');
    expect(dom.window.location.pathname).toBe('/ipfs/bafybeigdyrzt/agijobmanager.html');
  });

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
    expect(dom.window.location.pathname).toBe('/agijobmanager.html');
  });

  it('never emits root-relative path navigation while switching tabs', () => {
    const { dom } = bootRouter('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/');

    const anchor = dom.window.document.createElement('a');
    anchor.setAttribute('href', '/jobs');
    dom.window.document.body.appendChild(anchor);

    const clickEvent = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    anchor.dispatchEvent(clickEvent);

    expect(dom.window.location.href).toBe('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/jobs');
    expect(dom.window.location.pathname).toBe('/AGIJobManager/agijobmanager.html');
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

  it('normalizes malformed #/#/... startup hashes to a canonical dashboard route', () => {
    const { dom, calls } = bootRouter('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/#/AGIJobManager/agijobmanager.html');
    expect(calls.replaceState).toBeGreaterThan(0);
    expect(dom.window.location.href).toBe('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/');
    expect(dom.window.document.body.getAttribute('data-hash-route')).toBe('/');
  });

  it('recovers known routes from malformed prefixed startup hashes without pathname leakage', () => {
    const { dom, calls } = bootRouter('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/AGIJobManager/jobs');
    expect(calls.replaceState).toBeGreaterThan(0);
    expect(dom.window.location.href).toBe('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/jobs');
    expect(dom.window.document.body.getAttribute('data-hash-route')).toBe('/jobs');
  });

  it('recovers job detail routes from malformed prefixed startup hashes', () => {
    const { dom, calls } = bootRouter('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/AGIJobManager/jobs/123');
    expect(calls.replaceState).toBeGreaterThan(0);
    expect(dom.window.location.href).toBe('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/jobs/123');
    expect(dom.window.document.body.getAttribute('data-hash-route')).toBe('/jobs');
    expect(dom.window.location.hash).toBe('#/jobs/123');
  });

  it('recovers canonical routes from nested legacy startup hashes that include filename fragments', () => {
    const { dom, calls } = bootRouter('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/AGIJobManager/agijobmanager.html#/jobs/9');
    expect(calls.replaceState).toBeGreaterThan(0);
    expect(dom.window.location.href).toBe('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/jobs/9');
    expect(dom.window.document.body.getAttribute('data-hash-route')).toBe('/jobs');
    expect(dom.window.location.hash).toBe('#/jobs/9');
  });


  it('removes stale header wallet host to avoid duplicate wallet control ids', () => {
    const { dom } = bootRouter('https://example.com/agijobmanager.html#/');

    const syntheticHeader = dom.window.document.createElement('div');
    syntheticHeader.id = 'wallet-header-panel';
    syntheticHeader.innerHTML = '<button id="wallet-connect">stale connect</button>';
    dom.window.document.body.appendChild(syntheticHeader);

    dom.window.location.hash = '#/jobs';
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
    dom.window.location.hash = '#/';
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));

    const walletConnectNodes = dom.window.document.querySelectorAll('#wallet-connect');
    expect(walletConnectNodes.length).toBe(1);
    expect(dom.window.document.querySelector('#wallet-panel #wallet-connect')).toBeTruthy();
    expect(dom.window.document.querySelector('#wallet-header-panel')).toBeNull();
  });

  it('keeps hash history coherent for browser back/forward route traversal', () => {
    const { dom } = bootRouter('https://montrealai.github.io/AGIJobManager/agijobmanager.html#/');

    dom.window.location.hash = '#/jobs';
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
    expect(dom.window.document.body.getAttribute('data-hash-route')).toBe('/jobs');

    dom.window.location.hash = '#/admin';
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
    expect(dom.window.document.body.getAttribute('data-hash-route')).toBe('/admin');

    dom.window.location.hash = '#/jobs';
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
    expect(dom.window.document.body.getAttribute('data-hash-route')).toBe('/jobs');
  });
});
