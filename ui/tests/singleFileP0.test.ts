import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

const html = fs.readFileSync(path.resolve(__dirname, '../../agijobmanager.html'), 'utf8');

const extractRouterBootstrapScript = (source: string) => {
  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(source)) !== null) {
    const body = match[1] ?? '';
    const hasRouterDeclaration = body.includes('const navigateHashRoute = (nextRoute, options = {}) => {');
    const hasRouterHandlers = body.includes("window.addEventListener('hashchange'") || body.includes("document.addEventListener('click'");
    if (hasRouterDeclaration && hasRouterHandlers) {
      return body;
    }
  }
  return '';
};

describe('single-file P0 safeguards', () => {

  it('ships full inlined runtime markers and is not stub-sized', () => {
    const bytes = Buffer.byteLength(html, 'utf8');
    expect(bytes).toBeGreaterThanOrEqual(1000000);
    expect(html).toContain('AGI_SINGLE_FILE_RUNTIME_BOOTSTRAP_V1');
    expect(html).toContain('AGI_CONTRACT_ABI_REGISTRY_V1');
    expect(html).toContain('AGI_FULL_APP_MOUNT_V1');
    expect(html).toContain('window.__AGI_APP_BOOTSTRAP__=function AGIAppBootstrap()');
    expect(html).toContain('window.__AGI_RUNTIME_BUNDLE__=');
    expect(html).toContain('Connect Wallet');
  });

  it('does not contain legacy hardcoded jobs placeholder row', () => {
    expect(html).not.toContain('<td>245</td><td>Open</td><td>1,200 AGI</td>');
  });

  it('identity wiring status is bounded and retryable', () => {
    expect(html).toContain('id="identity-retry"');
    expect(html).toContain('Wiring read failed: ');
    expect(html).not.toContain('Wired job manager: <code id="hyd-ens-job-manager">loading</code>');
  });

  it('prefers MetaMask label when MetaMask-like provider is present', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main></main></body></html>', { url: 'https://example.com/agijobmanager.html#/', runScripts: 'outside-only' });
    const script = extractRouterBootstrapScript(html);
    expect(script).toBeTruthy();

    const metamaskProvider = {
      isMetaMask: true,
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return '0x1';
        if (method === 'eth_accounts') return ['0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201'];
        return '0x';
      }),
      on: vi.fn()
    };
    const phantomProvider = { isPhantom: true, request: vi.fn(async () => '0x1'), on: vi.fn() };

    dom.window.addEventListener('eip6963:requestProvider', () => {
      dom.window.dispatchEvent(new dom.window.CustomEvent('eip6963:announceProvider', { detail: { id: 'phantom', provider: phantomProvider, info: { name: 'Phantom', rdns: 'app.phantom' } } }));
      dom.window.dispatchEvent(new dom.window.CustomEvent('eip6963:announceProvider', { detail: { id: 'metamask', provider: metamaskProvider, info: { name: 'MetaMask', rdns: 'io.metamask' } } }));
    });

    dom.window.eval(script);
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(dom.window.document.body.textContent).toContain('Provider: MetaMask');
  });
});
