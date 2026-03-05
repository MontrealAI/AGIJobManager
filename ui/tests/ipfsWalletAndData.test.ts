import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

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

const bootRouter = (initialUrl: string, provider?: any) => {
  const dom = new JSDOM('<!doctype html><html><body><main></main></body></html>', { url: initialUrl, runScripts: 'outside-only' });
  const script = extractRouterBootstrapScript(readArtifactHtml());
  expect(script).toBeTruthy();
  (dom.window as any).fetch = vi.fn(async (url: string, init: any) => {
    const body = JSON.parse(String(init.body || '{}'));
    const method = body.method;
    if (method === 'eth_blockNumber') return { json: async () => ({ result: '0x1' }) } as any;
    if (method === 'eth_call') return { json: async () => ({ result: '0x' + '0'.repeat(64) }) } as any;
    return { json: async () => ({ result: '0x0' }) } as any;
  });
  if (provider) {
    (dom.window as any).ethereum = provider;
    dom.window.addEventListener('eip6963:requestProvider', () => {
      dom.window.dispatchEvent(new dom.window.CustomEvent('eip6963:announceProvider', { detail: { provider, info: { name: 'MetaMask', rdns: 'io.metamask' } } }));
    });
  }
  dom.window.eval(script ?? '');
  return dom;
};

describe('single-file runtime guards', () => {
  it('does not contain hardcoded placeholder job row in LIVE artifact', () => {
    const html = readArtifactHtml();
    expect(html.includes('job-245.alpha.jobs.agi.eth')).toBe(false);
    expect(html.includes('1,200 AGI')).toBe(false);
  });

  it('identity wiring is never left at perpetual loading label', () => {
    const html = readArtifactHtml();
    expect(html.includes('Wired job manager: <code id="hyd-ens-job-manager">loading</code>')).toBe(false);
  });

  it('labels injected MetaMask provider correctly and clears account after accountsChanged', async () => {
    const listeners: Record<string, Function[]> = {};
    let connectedAccounts = ['0x1111111111111111111111111111111111111111'];
    const provider = {
      isMetaMask: true,
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return '0x1';
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return connectedAccounts;
        return [];
      }),
      on: vi.fn((event: string, cb: Function) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      })
    };

    const dom = bootRouter('https://example.com/agijobmanager.html#/', provider);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const panelText = dom.window.document.body.textContent || '';
    expect(panelText).toContain('Provider:');
    expect(panelText).toContain('MetaMask');

    connectedAccounts = [];
    listeners.accountsChanged?.forEach((cb) => cb([]));
    await new Promise((resolve) => setTimeout(resolve, 30));
    const accountText = dom.window.document.getElementById('wallet-address-value')?.textContent || '';
    expect(accountText).toContain('not connected');
  });

  it('requests chain switch when wrong chain is detected', async () => {
    const provider = {
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return '0x89';
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return ['0x1111111111111111111111111111111111111111'];
        return [];
      }),
      on: vi.fn()
    };
    const dom = bootRouter('https://example.com/agijobmanager.html#/', provider);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const switchBtn = dom.window.document.getElementById('wallet-switch') as HTMLButtonElement | null;
    expect(switchBtn).toBeTruthy();
    switchBtn?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(provider.request).toHaveBeenCalledWith({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
  });
});
