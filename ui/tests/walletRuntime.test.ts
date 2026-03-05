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
  throw new Error('router bootstrap script not found');
};

const wait = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

describe('wallet/runtime integration in single-file artifact', () => {
  it('invokes wallet_switchEthereumChain when connected account is on wrong network', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main></main></body></html>', { url: 'https://example.com/agijobmanager.html#/', runScripts: 'outside-only' });

    const onHandlers = new Map<string, (...args: unknown[]) => void>();
    const provider = {
      isMetaMask: true,
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return '0x5';
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return ['0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201'];
        if (method === 'wallet_switchEthereumChain') return null;
        return '0x0';
      }),
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        onHandlers.set(event, cb);
      })
    };

    dom.window.addEventListener('eip6963:requestProvider', () => {
      dom.window.dispatchEvent(new dom.window.CustomEvent('eip6963:announceProvider', { detail: { id: 'metamask', provider, info: { name: 'MetaMask', rdns: 'io.metamask' } } }));
    });

    dom.window.eval(extractRouterBootstrapScript(html));
    await wait();

    const connect = dom.window.document.getElementById('wallet-connect') as HTMLButtonElement;
    connect.click();
    await wait(120);

    const switchBtn = dom.window.document.getElementById('wallet-switch') as HTMLButtonElement;
    expect(switchBtn).toBeTruthy();
    switchBtn.click();
    await wait();

    expect(provider.request).toHaveBeenCalledWith({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
  });

  it('renders admin defaults and disabled controls for read-only mode', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main></main></body></html>', { url: 'https://example.com/agijobmanager.html#/admin', runScripts: 'outside-only' });
    dom.window.eval(extractRouterBootstrapScript(html));
    await wait(120);

    const pause = dom.window.document.getElementById('admin-pause') as HTMLButtonElement;
    const settlement = dom.window.document.getElementById('admin-settlement') as HTMLButtonElement;
    const rpc = dom.window.document.getElementById('settings-rpc') as HTMLTextAreaElement;

    expect(pause.disabled).toBe(true);
    expect(settlement.disabled).toBe(true);
    expect(dom.window.document.body.textContent).toContain('Not authorized');
    expect(dom.window.document.body.textContent).toContain('Connect MetaMask on Ethereum Mainnet for write actions');
    expect(rpc.value).toContain('https://eth.llamarpc.com');
    expect(rpc.value).toContain('https://ethereum-rpc.publicnode.com');
  });
});
